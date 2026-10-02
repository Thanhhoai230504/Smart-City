#!/usr/bin/env node
/**
 * Chụp fixture JSON THẬT từ backend đang chạy cho test parse model (task 0.6).
 *
 *   # 1. seed DB demo cục bộ (xoá sạch DB đích — chỉ nhận localhost)
 *   cd Project/Backend
 *   APP_DEMO_MONGODB_URI=mongodb://127.0.0.1:27017/smartcity_app_demo npm run seed:app-demo
 *   # 2. chạy backend trỏ vào DB đó, rồi:
 *   node ../App/tool/capture_fixtures.js [http://localhost:5000/api]
 *
 * Vì sao không tự viết JSON: test parse chỉ bắt được lỗi lệch kiểu khi đầu vào
 * là thứ backend thật sự trả — field union (ObjectId chuỗi hay object populate),
 * số nguyên hay thực, field vắng mặt ở endpoint này nhưng có ở endpoint kia.
 * Token trong response bị thay bằng "<redacted>"; `stack` (chỉ có ở development)
 * bị bỏ trước khi ghi.
 */
const fs = require('fs');
const path = require('path');

const API = (process.argv[2] || 'http://localhost:5000/api').replace(/\/+$/, '');
const OUT = path.join(__dirname, '..', 'test', 'fixtures', 'api');
const { DEMO_PASSWORD } = require(path.join(__dirname, '..', '..', 'Backend', 'src', 'seeds', 'seedAppDemo.js'));

const redact = (value) => {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      // `stack` chỉ có ở NODE_ENV=development và chứa đường dẫn máy cục bộ.
      .filter(([k]) => k !== 'stack')
      .map(([k, v]) => [k, /token/i.test(k) && typeof v === 'string' ? '<redacted>' : redact(v)]));
  }
  return value;
};

const call = async (method, url, { token, body } = {}) => {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-App-Version': '1.0.0',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

const save = (name, payload) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.json`), `${JSON.stringify(redact(payload), null, 2)}\n`);
  console.log(`  ✓ ${name}.json`);
};

const login = async (email) => {
  const r = await call('POST', '/auth/login', {
    body: { email, password: DEMO_PASSWORD, deviceType: 'android', deviceName: 'capture_fixtures' },
  });
  if (r.status !== 200) throw new Error(`Đăng nhập ${email} thất bại: ${JSON.stringify(r.body)}`);
  return r;
};

(async () => {
  console.log(`Chụp fixture từ ${API}`);
  const citizen = await login('nguoidan@demo.vn');
  const staff = await login('canbo.giaothong@demo.vn');
  const ct = citizen.body.data.accessToken;
  const st = staff.body.data.accessToken;
  save('login_mobile', citizen.body);

  save('meta_enums', (await call('GET', '/meta/enums')).body);
  save('app_config', (await call('GET', '/app/config')).body);

  const guestList = await call('GET', '/issues?limit=20');
  save('issues_list_guest', guestList.body);
  save('issues_map', (await call('GET', '/issues?view=map&bounds=108.1,15.9,108.4,16.2&limit=500')).body);

  const issues = guestList.body.data.issues;
  const resolved = issues.find((i) => i.status === 'resolved');
  const rejected = issues.find((i) => i.status === 'rejected');
  const assigned = issues.find((i) => i.status === 'processing' && i.assigneeId);

  save('issue_detail_guest', (await call('GET', `/issues/${resolved._id}`)).body);
  save('issue_detail_staff', (await call('GET', `/issues/${assigned._id}`, { token: st })).body);
  save('issue_detail_rejected_reporter', (await call('GET', `/issues/${rejected._id}`, { token: ct })).body);
  save('work_list_staff', (await call('GET', '/issues/work?sort=-priorityScore', { token: st })).body);
  save('my_issues', (await call('GET', '/issues/my', { token: ct })).body);
  save('my_summary', (await call('GET', '/issues/my/summary', { token: ct })).body);
  save('nearby', (await call('GET', `/issues/nearby?lat=${resolved.latitude}&lng=${resolved.longitude}&radius=1000`)).body);
  save('comments', (await call('GET', `/issues/${resolved._id}/comments`)).body);
  save('notifications', (await call('GET', '/notifications', { token: ct })).body);
  save('statistics', (await call('GET', '/statistics')).body);
  save('badges_me', (await call('GET', '/badges/me', { token: ct })).body);
  save('leaderboard', (await call('GET', '/badges/leaderboard')).body);
  save('cameras', (await call('GET', '/cameras')).body);
  save('duplicate_candidates', (await call('POST', '/issues/duplicate-candidates', {
    token: ct,
    body: {
      title: 'Ổ gà lớn trên đường Lê Duẩn',
      description: 'Ổ gà sâu ngay làn xe máy, rất nguy hiểm khi trời mưa',
      category: 'pothole',
      latitude: 16.0712,
      longitude: 108.2165,
    },
  })).body);

  // Hình dạng lỗi — app phân nhánh theo `code`, không so chuỗi.
  save('error_login_wrong_password', (await call('POST', '/auth/login', {
    body: { email: 'nguoidan@demo.vn', password: 'sai-mat-khau', deviceType: 'android' },
  })).body);
  save('error_validation', (await call('POST', '/auth/register', { body: { email: 'khong-phai-email' } })).body);
  save('error_reject_reason_required', (await call('PATCH', `/issues/${assigned._id}/status`, {
    token: st, body: { status: 'rejected' },
  })).body);
  save('error_invalid_transition', (await call('PATCH', `/issues/${assigned._id}/status`, {
    token: st, body: { status: 'reported' },
  })).body);
  save('error_reopen_not_reporter', (await call('POST', `/issues/${resolved._id}/reopen`, {
    token: st, body: { reason: 'Kiểm tra mã lỗi khi không phải người báo cáo' },
  })).body);

  console.log('Xong.');
})().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
