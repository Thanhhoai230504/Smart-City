/**
 * Dữ liệu demo cho app mobile — CHỈ chạy trên MongoDB cục bộ.
 *
 *   APP_DEMO_MONGODB_URI=mongodb://127.0.0.1:27017/smartcity_app_demo npm run seed:app-demo
 *
 * Dùng cho: (1) kiểm thử app end-to-end trên máy phát triển, (2) lấy fixture JSON
 * thật cho task 0.6 — fixture phải có phiếu đã phân công, đã `resolved` kèm ảnh
 * minh chứng và `statusHistory[].changedBy` đã populate, nếu không mọi field union
 * đều null và test parse "pass giả"; (3) tài khoản demo cho reviewer store (7.4).
 *
 * XOÁ SẠCH database đích trước khi seed, nên có rào chắn cứng: từ chối mọi URI
 * không phải localhost và KHÔNG đọc MONGODB_URI (biến đó trỏ Atlas thật).
 *
 * Tài khoản demo (mật khẩu chung: DEMO_PASSWORD bên dưới):
 *   nguoidan@demo.vn         người dân, có phiếu ở đủ 4 trạng thái
 *   nguoidan2@demo.vn        người dân thứ hai (ủng hộ, bình luận)
 *   canbo.giaothong@demo.vn  cán bộ Phòng Hạ tầng Giao thông (HTGT)
 *   canbo2.giaothong@demo.vn cán bộ thứ hai cùng đơn vị — thử tranh chấp nhận việc
 *   canbo.moitruong@demo.vn  cán bộ đơn vị khác — thử bó phạm vi đơn vị
 *   quantri@demo.vn          quản trị viên
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Issue = require('../models/Issue');
const Department = require('../models/Department');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const Place = require('../models/Place');
const RefreshSession = require('../models/RefreshSession');
const { DEPARTMENTS } = require('./seedDepartments');

const DEMO_PASSWORD = 'DemoSmartCity2026';
const HOUR = 60 * 60 * 1000;

/** Chỉ chấp nhận MongoDB trên chính máy này. */
const assertLocalMongoUri = (uri) => {
  if (typeof uri !== 'string' || !uri) {
    throw new Error('Thiếu APP_DEMO_MONGODB_URI (ví dụ mongodb://127.0.0.1:27017/smartcity_app_demo)');
  }
  const match = /^mongodb:\/\/(?:[^@/]+@)?([^/:?,]+)(?::\d+)?\/([^/?]+)/.exec(uri);
  if (!match) throw new Error('APP_DEMO_MONGODB_URI phải có dạng mongodb://host:port/tenDb (không nhận mongodb+srv)');
  const [, host, db] = match;
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) {
    throw new Error(`Từ chối seed vào host "${host}" — script này xoá sạch database, chỉ chạy trên máy cục bộ`);
  }
  return { host, db };
};

const photo = (seed) => ({ url: `https://picsum.photos/seed/${seed}/960/720`, publicId: null });

const buildIssues = ({ dan, dan2, staff, staff2, admin, htgt, mtdt }, now) => {
  const ago = (h) => new Date(now - h * HOUR);
  const history = (...entries) => entries.map(([status, by, h, note = '']) => ({
    status, changedBy: by._id, changedAt: ago(h), note,
  }));

  return [
    {
      title: 'Ổ gà lớn trước số 120 Lê Duẩn',
      description: 'Ổ gà sâu khoảng 15cm, rộng gần 1m ngay làn xe máy, trời mưa đọng nước rất nguy hiểm.',
      category: 'pothole',
      location: '120 Lê Duẩn, Hải Châu, Đà Nẵng',
      latitude: 16.0712, longitude: 108.2165,
      phone: '0905123456',
      images: [photo('pothole-le-duan'), photo('pothole-le-duan-2')],
      status: 'reported', userId: dan._id, followers: [dan._id],
      votes: [dan2._id], voteCount: 1,
      createdAt: ago(3),
      statusHistory: history(['reported', dan, 3, 'Sự cố được báo cáo']),
    },
    {
      title: 'Mặt đường lún sụt đoạn Nguyễn Văn Linh',
      description: 'Đoạn gần ngã tư Nguyễn Văn Linh – Hàm Nghi bị lún, xe tải đi qua rất rung.',
      category: 'pothole',
      location: '45 Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
      latitude: 16.0596, longitude: 108.2111,
      phone: '0912345678',
      images: [photo('nvl-subsidence')],
      status: 'processing', userId: dan._id, followers: [dan._id],
      departmentId: htgt._id, assigneeId: staff._id, assignedBy: admin._id,
      assignedAt: ago(10), dueAt: new Date(now + 50 * HOUR), adminId: staff._id,
      createdAt: ago(20),
      statusHistory: history(
        ['reported', dan, 20, 'Sự cố được báo cáo'],
        ['reported', admin, 10, 'Phân công cho Phòng Quản lý Hạ tầng Giao thông'],
        ['processing', staff, 6, 'Đã khảo sát hiện trường, chờ vật tư.'],
      ),
    },
    {
      title: 'Hố ga mất nắp trên đường Trần Phú',
      description: 'Hố ga không có nắp ngay vạch sang đường, ban đêm không có biển cảnh báo.',
      category: 'pothole',
      location: '210 Trần Phú, Hải Châu, Đà Nẵng',
      latitude: 16.0646, longitude: 108.2237,
      images: [photo('manhole-tran-phu')],
      status: 'processing', userId: dan2._id, followers: [dan2._id],
      departmentId: htgt._id, assignedBy: admin._id,
      assignedAt: ago(62), dueAt: new Date(now + 6 * HOUR),
      createdAt: ago(70),
      statusHistory: history(
        ['reported', dan2, 70, 'Sự cố được báo cáo'],
        ['reported', admin, 62, 'Phân công cho Phòng Quản lý Hạ tầng Giao thông'],
        ['processing', admin, 61, 'Ưu tiên xử lý trong ngày.'],
      ),
    },
    {
      title: 'Vỉa hè vỡ nhiều mảng trên Bạch Đằng',
      description: 'Gạch lát vỉa hè bong tróc cả đoạn dài, người đi bộ phải xuống lòng đường.',
      category: 'pothole',
      location: '30 Bạch Đằng, Hải Châu, Đà Nẵng',
      latitude: 16.0718, longitude: 108.2246,
      phone: '0935111222',
      images: [photo('sidewalk-bach-dang')],
      status: 'processing', userId: dan2._id, followers: [dan2._id],
      departmentId: htgt._id, assigneeId: staff2._id, assignedBy: admin._id,
      assignedAt: ago(100), dueAt: ago(28), escalationLevel: 1, lastReminderAt: ago(4),
      createdAt: ago(110),
      statusHistory: history(
        ['reported', dan2, 110, 'Sự cố được báo cáo'],
        ['reported', admin, 100, 'Phân công cho Phòng Quản lý Hạ tầng Giao thông'],
        ['processing', staff2, 90, ''],
      ),
    },
    {
      title: 'Ổ gà trước cổng trường Phan Châu Trinh',
      description: 'Ổ gà ngay cổng trường, giờ tan học học sinh đi xe đạp rất dễ ngã.',
      category: 'pothole',
      location: '154 Lê Lợi, Hải Châu, Đà Nẵng',
      latitude: 16.0748, longitude: 108.2203,
      images: [photo('school-gate-pothole')],
      resolutionImages: [
        { ...photo('school-gate-fixed'), uploadedBy: staff._id, uploadedAt: ago(30) },
        { ...photo('school-gate-fixed-2'), uploadedBy: staff._id, uploadedAt: ago(30) },
      ],
      status: 'resolved', userId: dan._id, followers: [dan._id], resolvedAt: ago(29),
      departmentId: htgt._id, assigneeId: staff._id, assignedBy: admin._id,
      assignedAt: ago(80), dueAt: ago(8), adminId: staff._id,
      votes: [dan2._id], voteCount: 1,
      createdAt: ago(90),
      statusHistory: history(
        ['reported', dan, 90, 'Sự cố được báo cáo'],
        ['reported', admin, 80, 'Phân công cho Phòng Quản lý Hạ tầng Giao thông'],
        ['processing', staff, 60, 'Đã rào chắn tạm thời.'],
        ['resolved', staff, 29, 'Đã vá bằng bê tông nhựa nóng, thông xe.'],
      ),
    },
    {
      title: 'Đường bị đào chưa hoàn trả ở Hùng Vương',
      description: 'Đơn vị cấp nước đào đường từ tuần trước nhưng chưa hoàn trả mặt bằng.',
      category: 'pothole',
      location: '88 Hùng Vương, Hải Châu, Đà Nẵng',
      latitude: 16.0681, longitude: 108.2189,
      status: 'rejected', userId: dan._id, followers: [dan._id],
      departmentId: htgt._id, assigneeId: staff._id, assignedBy: admin._id,
      assignedAt: ago(140), dueAt: ago(68), adminId: staff._id,
      createdAt: ago(150),
      statusHistory: history(
        ['reported', dan, 150, 'Sự cố được báo cáo'],
        ['reported', admin, 140, 'Phân công cho Phòng Quản lý Hạ tầng Giao thông'],
        ['rejected', staff, 120, 'Công trình thuộc Công ty Cấp nước, đã chuyển văn bản yêu cầu họ hoàn trả trước 15/10.'],
      ),
    },
    {
      title: 'Ổ gà tái xuất hiện ở Phan Đình Phùng',
      description: 'Đã báo xử lý nhưng sau một trận mưa ổ gà lại xuất hiện ở đúng chỗ cũ.',
      category: 'pothole',
      location: '12 Phan Đình Phùng, Hải Châu, Đà Nẵng',
      latitude: 16.0703, longitude: 108.2208,
      images: [photo('pdp-pothole')],
      resolutionImages: [{ ...photo('pdp-fixed'), uploadedBy: staff._id, uploadedAt: ago(200) }],
      status: 'processing', userId: dan2._id, followers: [dan2._id],
      departmentId: htgt._id, assigneeId: staff._id, assignedBy: admin._id,
      assignedAt: ago(24), dueAt: new Date(now + 40 * HOUR),
      reopenCount: 1, lastReopenedAt: ago(24),
      createdAt: ago(260),
      statusHistory: history(
        ['reported', dan2, 260, 'Sự cố được báo cáo'],
        ['processing', staff, 230, ''],
        ['resolved', staff, 199, 'Đã vá.'],
        ['processing', dan2, 24, 'Người dân mở lại: sau mưa ổ gà xuất hiện lại đúng chỗ cũ.'],
      ),
    },
    {
      title: 'Rác tồn đọng ở chân cầu Rồng',
      description: 'Rác sinh hoạt đổ trộm thành đống lớn, bốc mùi.',
      category: 'garbage',
      location: 'Chân cầu Rồng, Sơn Trà, Đà Nẵng',
      latitude: 16.0610, longitude: 108.2290,
      images: [photo('garbage-dragon-bridge')],
      status: 'processing', userId: dan._id, followers: [dan._id],
      departmentId: mtdt._id, assignedBy: admin._id,
      assignedAt: ago(5), dueAt: new Date(now + 19 * HOUR),
      createdAt: ago(8),
      statusHistory: history(
        ['reported', dan, 8, 'Sự cố được báo cáo'],
        ['reported', admin, 5, 'Phân công cho Công ty Môi trường Đô thị Đà Nẵng'],
      ),
    },
    {
      title: 'Ngập sâu đường Ông Ích Khiêm sau mưa',
      description: 'Nước ngập gần 40cm, xe máy chết máy hàng loạt.',
      category: 'flooding',
      location: '300 Ông Ích Khiêm, Thanh Khê, Đà Nẵng',
      latitude: 16.0671, longitude: 108.2112,
      status: 'reported', userId: dan2._id, followers: [dan2._id],
      createdAt: ago(1),
      statusHistory: history(['reported', dan2, 1, 'Sự cố được báo cáo']),
    },
  ];
};

const run = async () => {
  const uri = process.env.APP_DEMO_MONGODB_URI;
  const { db } = assertLocalMongoUri(uri);
  await mongoose.connect(uri);
  console.log(`✅ Kết nối MongoDB cục bộ, database "${db}"`);

  await mongoose.connection.dropDatabase();
  await Promise.all([User.init(), Issue.init(), Place.init(), Department.init(), RefreshSession.init()]);

  const departments = await Department.insertMany(
    DEPARTMENTS.map((d) => ({ ...d, slaHours: null, isActive: true }))
  );
  const byCode = Object.fromEntries(departments.map((d) => [d.code, d]));

  const mk = (name, email, role = 'user', departmentId = null) => ({
    name, email, password: DEMO_PASSWORD, role, departmentId, isVerified: true, isActive: true,
  });
  // Cán bộ Môi trường (phần tử thứ 5) không cần biến — chỉ để thử bó phạm vi đơn vị.
  const [dan, dan2, staff, staff2, , admin] = await User.create([
    mk('Nguyễn Văn An', 'nguoidan@demo.vn'),
    mk('Trần Thị Bình', 'nguoidan2@demo.vn'),
    mk('Lê Minh Cường', 'canbo.giaothong@demo.vn', 'staff', byCode.HTGT._id),
    mk('Phạm Thu Dung', 'canbo2.giaothong@demo.vn', 'staff', byCode.HTGT._id),
    mk('Hoàng Văn Em', 'canbo.moitruong@demo.vn', 'staff', byCode.MTDT._id),
    mk('Quản trị Demo', 'quantri@demo.vn', 'admin'),
  ]);
  await User.updateOne({ _id: dan._id }, { watchedDistricts: ['Hải Châu'] });

  const now = Date.now();
  const issues = [];
  for (const data of buildIssues({ dan, dan2, staff, staff2, admin, htgt: byCode.HTGT, mtdt: byCode.MTDT }, now)) {
    // create() để hook pre-validate sinh district/geo/intakeDueAt như đường ghi thật.
    issues.push(await Issue.create(data));
  }

  await Place.insertMany([
    { name: 'Bệnh viện Đà Nẵng', type: 'hospital', address: '124 Hải Phòng, Hải Châu', latitude: 16.0720, longitude: 108.2140, isActive: true },
    { name: 'Trường THPT Phan Châu Trinh', type: 'school', address: '154 Lê Lợi, Hải Châu', latitude: 16.0750, longitude: 108.2200, isActive: true },
    { name: 'Công viên APEC', type: 'park', address: 'Bạch Đằng, Hải Châu', latitude: 16.0603, longitude: 108.2263, isActive: true },
  ]);

  const [pothole, , , , resolved] = issues;
  await Comment.insertMany([
    { issueId: pothole._id, userId: dan2._id, content: 'Tôi đi qua sáng nay, ổ gà còn to hơn hôm qua.' },
    { issueId: resolved._id, userId: staff._id, content: 'Đơn vị đã xử lý xong, cảm ơn người dân đã phản ánh.' },
    { issueId: resolved._id, userId: dan._id, content: 'Cảm ơn đơn vị đã xử lý nhanh!' },
  ]);

  await Notification.insertMany([
    { userId: dan._id, type: 'issue_resolved', title: 'Sự cố Đã xử lý', message: `Sự cố "${resolved.title}" đã được cập nhật trạng thái: Đã xử lý`, issueId: resolved._id },
    { userId: dan._id, type: 'comment', title: 'Bình luận mới', message: 'Cán bộ Lê Minh Cường đã bình luận trên sự cố của bạn', issueId: resolved._id, isRead: true },
    { userId: staff._id, type: 'issue_assigned', title: 'Được phân công', message: `Đơn vị được giao xử lý "${issues[1].title}"`, issueId: issues[1]._id },
    { userId: staff._id, type: 'issue_reopened', title: 'Sự cố được mở lại', message: `Người dân mở lại "${issues[6].title}"`, issueId: issues[6]._id },
  ]);

  // Điểm ưu tiên tính bằng đúng engine production (cần index 2dsphere ở trên).
  const { runPriorityBatch } = require('../services/priorityService');
  const priority = await runPriorityBatch({ limit: 100, concurrency: 3 });

  console.log(`👤 ${6} tài khoản demo · mật khẩu: ${DEMO_PASSWORD}`);
  console.log(`🏢 ${departments.length} đơn vị · 📌 ${issues.length} sự cố · ⚡ ưu tiên ${priority.updated}/${priority.scanned}`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch(async (err) => {
    console.error('❌ Seed demo thất bại:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { run, assertLocalMongoUri, DEMO_PASSWORD };
