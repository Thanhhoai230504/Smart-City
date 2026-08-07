const STATUS_LABELS = {
  processing: 'Đang xử lý',
  resolved: 'Đã xử lý',
  rejected: 'Từ chối',
};

const STATUS_COLORS = {
  processing: '#F59E0B',
  resolved: '#10B981',
  rejected: '#EF4444',
};

const STATUS_ICONS = {
  processing: '🔵',
  resolved: '✅',
  rejected: '❌',
};

const buildVerificationEmail = ({ userName, verificationUrl }) => `
  <div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;background:#1a1a2e;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#0EA5E9,#10B981);padding:30px 32px;text-align:center">
      <h1 style="margin:0;font-size:22px;color:#fff;font-weight:700">🏙️ Smart City Đà Nẵng</h1>
      <p style="margin:7px 0 0;color:rgba(255,255,255,0.85);font-size:14px">Xác thực địa chỉ email</p>
    </div>
    <div style="padding:30px 32px">
      <p style="color:#e2e8f0;font-size:15px;margin:0 0 18px">Xin chào <strong>${userName}</strong>,</p>
      <p style="color:#9CA3AF;font-size:14px;line-height:1.7;margin:0 0 22px">
        Cảm ơn bạn đã đăng ký. Hãy xác thực email để bảo vệ tài khoản và bắt đầu
        gửi, theo dõi các phản ánh đô thị.
      </p>
      <div style="text-align:center;margin:28px 0">
        <a href="${verificationUrl}" style="display:inline-block;background:linear-gradient(135deg,#0EA5E9,#0284C7);color:#fff;text-decoration:none;padding:13px 34px;border-radius:10px;font-size:14px;font-weight:700">
          Xác thực email
        </a>
      </div>
      <div style="background:#252540;border-radius:10px;padding:14px 16px;margin-top:20px">
        <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:1.6">
          Liên kết có hiệu lực trong 24 giờ. Nếu bạn không tạo tài khoản này, có thể bỏ qua email.
        </p>
      </div>
    </div>
  </div>`;

const buildStatusChangeEmail = ({ userName, issueTitle, newStatus, note, issueId, clientUrl }) => {
  const statusLabel = STATUS_LABELS[newStatus] || newStatus;
  const statusColor = STATUS_COLORS[newStatus] || '#6C63FF';
  const statusIcon = STATUS_ICONS[newStatus] || '🔔';
  const issueUrl = `${clientUrl}/issues/${issueId}`;

  return `
  <div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;background:#1a1a2e;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#3B82F6,#6C63FF);padding:28px 32px;text-align:center">
      <h1 style="margin:0;font-size:20px;color:#fff;font-weight:700">🏙️ Smart City Đà Nẵng</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px">Thông báo cập nhật sự cố</p>
    </div>
    <div style="padding:28px 32px">
      <p style="color:#e2e8f0;font-size:15px;margin:0 0 20px">Xin chào <strong>${userName}</strong>,</p>
      
      <div style="background:#252540;border-radius:12px;padding:20px;margin-bottom:20px;border-left:4px solid ${statusColor}">
        <p style="margin:0 0 8px;color:#9CA3AF;font-size:12px;text-transform:uppercase;letter-spacing:1px">Sự cố của bạn</p>
        <p style="margin:0 0 12px;color:#F1F5F9;font-size:16px;font-weight:600">${issueTitle}</p>
        <div style="display:inline-block;background:${statusColor}20;color:${statusColor};padding:4px 14px;border-radius:20px;font-size:13px;font-weight:600">
          ${statusIcon} ${statusLabel}
        </div>
      </div>

      ${note ? `
      <div style="background:#252540;border-radius:12px;padding:16px;margin-bottom:20px">
        <p style="margin:0 0 6px;color:#9CA3AF;font-size:12px">📝 Ghi chú từ quản trị viên</p>
        <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.6">${note}</p>
      </div>
      ` : ''}

      <div style="text-align:center;margin:24px 0">
        <a href="${issueUrl}" style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#2563EB);color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:600">
          Xem chi tiết sự cố →
        </a>
      </div>

      <p style="color:#6B7280;font-size:12px;margin:20px 0 0;text-align:center">
        Bạn nhận được email này vì đã báo cáo sự cố trên hệ thống Smart City Đà Nẵng.
      </p>
    </div>
  </div>`;
};

const buildRatingRequestEmail = ({ userName, issueTitle, issueId, clientUrl }) => {
  const issueUrl = `${clientUrl}/issues/${issueId}`;

  return `
  <div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;background:#1a1a2e;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#10B981,#059669);padding:28px 32px;text-align:center">
      <h1 style="margin:0;font-size:20px;color:#fff;font-weight:700">⭐ Đánh giá chất lượng xử lý</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px">Smart City Đà Nẵng</p>
    </div>
    <div style="padding:28px 32px">
      <p style="color:#e2e8f0;font-size:15px;margin:0 0 20px">Xin chào <strong>${userName}</strong>,</p>
      
      <p style="color:#9CA3AF;font-size:14px;line-height:1.7;margin:0 0 20px">
        Sự cố <strong style="color:#F1F5F9">"${issueTitle}"</strong> của bạn đã được xử lý xong! 
        Hãy dành vài giây để đánh giá chất lượng xử lý, giúp chúng tôi cải thiện dịch vụ.
      </p>

      <div style="text-align:center;margin:28px 0">
        <div style="font-size:32px;margin-bottom:16px">⭐⭐⭐⭐⭐</div>
        <a href="${issueUrl}" style="display:inline-block;background:linear-gradient(135deg,#10B981,#059669);color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:600">
          Đánh giá ngay →
        </a>
      </div>

      <p style="color:#6B7280;font-size:12px;margin:20px 0 0;text-align:center">
        Đánh giá của bạn giúp nâng cao chất lượng phục vụ người dân thành phố.
      </p>
    </div>
  </div>`;
};

const CATEGORY_LABELS = {
  pothole: 'Đường hư hỏng',
  garbage: 'Rác thải',
  streetlight: 'Đèn đường',
  flooding: 'Ngập nước',
  tree: 'Cây xanh',
  other: 'Khác',
};

/** Định dạng ngày giờ Việt Nam cho email nhắc hạn */
const formatDeadline = (date) => {
  if (!date) return 'chưa xác định';
  return new Date(date).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
};

/**
 * Email gửi cán bộ/đơn vị khi admin phân công một sự cố mới.
 */
const buildAssignmentEmail = ({ departmentName, issueTitle, category, location, dueAt, slaHours, issueId, clientUrl }) => {
  const issueUrl = `${clientUrl}/issues/${issueId}`;

  return `
  <div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;background:#1a1a2e;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#6C63FF,#4F46E5);padding:28px 32px;text-align:center">
      <h1 style="margin:0;font-size:20px;color:#fff;font-weight:700">📋 Phân công xử lý sự cố</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px">Smart City Đà Nẵng</p>
    </div>
    <div style="padding:28px 32px">
      <p style="color:#e2e8f0;font-size:15px;margin:0 0 20px">
        Kính gửi <strong>${departmentName}</strong>,
      </p>
      <p style="color:#9CA3AF;font-size:14px;line-height:1.7;margin:0 0 20px">
        Đơn vị được phân công xử lý sự cố sau:
      </p>

      <div style="background:#252540;border-radius:12px;padding:20px;margin-bottom:20px;border-left:4px solid #6C63FF">
        <p style="margin:0 0 12px;color:#F1F5F9;font-size:16px;font-weight:600">${issueTitle}</p>
        <table style="width:100%;color:#9CA3AF;font-size:13px;line-height:1.9">
          <tr><td style="width:110px">Loại sự cố</td><td style="color:#e2e8f0">${CATEGORY_LABELS[category] || category}</td></tr>
          <tr><td>Địa điểm</td><td style="color:#e2e8f0">${location}</td></tr>
          <tr><td>Hạn xử lý</td><td style="color:#F59E0B;font-weight:600">${formatDeadline(dueAt)} (${slaHours} giờ)</td></tr>
        </table>
      </div>

      <div style="text-align:center;margin:24px 0">
        <a href="${issueUrl}" style="display:inline-block;background:linear-gradient(135deg,#6C63FF,#4F46E5);color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:600">
          Xem và xử lý →
        </a>
      </div>

      <p style="color:#6B7280;font-size:12px;margin:20px 0 0;text-align:center">
        Vui lòng cập nhật trạng thái và tải ảnh minh chứng khi hoàn thành.
      </p>
    </div>
  </div>`;
};

/**
 * Email nhắc hạn (cấp 1) gửi đơn vị khi sự cố quá hạn xử lý.
 */
const buildSlaReminderEmail = ({ recipientName, issues, clientUrl }) => {
  const rows = issues.map((issue) => `
    <tr>
      <td style="padding:10px 8px;border-top:1px solid #33334d;color:#e2e8f0;font-size:13px">
        <a href="${clientUrl}/issues/${issue._id}" style="color:#93C5FD;text-decoration:none">${issue.title}</a>
      </td>
      <td style="padding:10px 8px;border-top:1px solid #33334d;color:#9CA3AF;font-size:12px">${issue.location}</td>
      <td style="padding:10px 8px;border-top:1px solid #33334d;color:#EF4444;font-size:12px;white-space:nowrap">
        quá ${issue.overdueHours} giờ
      </td>
    </tr>`).join('');

  return `
  <div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;max-width:640px;margin:0 auto;background:#1a1a2e;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#F59E0B,#D97706);padding:28px 32px;text-align:center">
      <h1 style="margin:0;font-size:20px;color:#fff;font-weight:700">⏰ Nhắc hạn xử lý sự cố</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px">Smart City Đà Nẵng</p>
    </div>
    <div style="padding:28px 32px">
      <p style="color:#e2e8f0;font-size:15px;margin:0 0 8px">Kính gửi <strong>${recipientName}</strong>,</p>
      <p style="color:#9CA3AF;font-size:14px;line-height:1.7;margin:0 0 20px">
        Có <strong style="color:#F59E0B">${issues.length}</strong> sự cố đã quá hạn xử lý và cần được cập nhật:
      </p>

      <table style="width:100%;border-collapse:collapse;background:#252540;border-radius:12px;overflow:hidden">
        <thead>
          <tr style="background:#2d2d4a">
            <th style="padding:10px 8px;text-align:left;color:#9CA3AF;font-size:12px;font-weight:600">Sự cố</th>
            <th style="padding:10px 8px;text-align:left;color:#9CA3AF;font-size:12px;font-weight:600">Địa điểm</th>
            <th style="padding:10px 8px;text-align:left;color:#9CA3AF;font-size:12px;font-weight:600">Trễ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <p style="color:#6B7280;font-size:12px;margin:20px 0 0;text-align:center">
        Nếu tiếp tục quá hạn, sự cố sẽ được báo cáo lên quản trị viên thành phố.
      </p>
    </div>
  </div>`;
};

/**
 * Email leo cấp (cấp 2) gửi admin khi đơn vị đã được nhắc mà vẫn chưa xử lý.
 */
const buildSlaEscalationEmail = ({ adminName, issues, clientUrl }) => {
  const rows = issues.map((issue) => `
    <tr>
      <td style="padding:10px 8px;border-top:1px solid #33334d;color:#e2e8f0;font-size:13px">
        <a href="${clientUrl}/issues/${issue._id}" style="color:#93C5FD;text-decoration:none">${issue.title}</a>
      </td>
      <td style="padding:10px 8px;border-top:1px solid #33334d;color:#9CA3AF;font-size:12px">${issue.departmentName || 'Chưa rõ đơn vị'}</td>
      <td style="padding:10px 8px;border-top:1px solid #33334d;color:#EF4444;font-size:12px;white-space:nowrap">
        quá ${issue.overdueHours} giờ
      </td>
    </tr>`).join('');

  return `
  <div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;max-width:640px;margin:0 auto;background:#1a1a2e;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#EF4444,#B91C1C);padding:28px 32px;text-align:center">
      <h1 style="margin:0;font-size:20px;color:#fff;font-weight:700">🚨 Leo cấp: sự cố tồn đọng</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px">Smart City Đà Nẵng</p>
    </div>
    <div style="padding:28px 32px">
      <p style="color:#e2e8f0;font-size:15px;margin:0 0 8px">Xin chào <strong>${adminName}</strong>,</p>
      <p style="color:#9CA3AF;font-size:14px;line-height:1.7;margin:0 0 20px">
        <strong style="color:#EF4444">${issues.length}</strong> sự cố đã được nhắc hạn nhưng đơn vị vẫn chưa xử lý xong.
        Cần can thiệp hoặc chuyển đơn vị khác.
      </p>

      <table style="width:100%;border-collapse:collapse;background:#252540;border-radius:12px;overflow:hidden">
        <thead>
          <tr style="background:#2d2d4a">
            <th style="padding:10px 8px;text-align:left;color:#9CA3AF;font-size:12px;font-weight:600">Sự cố</th>
            <th style="padding:10px 8px;text-align:left;color:#9CA3AF;font-size:12px;font-weight:600">Đơn vị</th>
            <th style="padding:10px 8px;text-align:left;color:#9CA3AF;font-size:12px;font-weight:600">Trễ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
};

module.exports = {
  buildVerificationEmail,
  buildStatusChangeEmail,
  buildRatingRequestEmail,
  buildAssignmentEmail,
  buildSlaReminderEmail,
  buildSlaEscalationEmail,
};
