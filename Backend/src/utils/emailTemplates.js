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

module.exports = { buildStatusChangeEmail, buildRatingRequestEmail };
