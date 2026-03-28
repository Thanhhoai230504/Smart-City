const Issue = require('../models/Issue');
const User = require('../models/User');
const { sendEmail } = require('./emailService');

const CATEGORY_VI = { pothole: 'Ổ gà', garbage: 'Rác thải', streetlight: 'Đèn đường', flooding: 'Ngập nước', tree: 'Cây đổ', other: 'Khác' };
const STATUS_VI = { reported: 'Mới', processing: 'Đang xử lý', resolved: 'Đã xử lý', rejected: 'Từ chối' };

const generateReport = async (type = 'weekly') => {
  const now = new Date();
  const startDate = new Date(now);
  if (type === 'weekly') startDate.setDate(now.getDate() - 7);
  else startDate.setMonth(now.getMonth() - 1);

  const [totalAll, periodIssues, byStatus, byCategory, topVoted] = await Promise.all([
    Issue.countDocuments(),
    Issue.find({ createdAt: { $gte: startDate } }).lean(),
    Issue.aggregate([{ $match: { createdAt: { $gte: startDate } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Issue.aggregate([{ $match: { createdAt: { $gte: startDate } } }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    Issue.find().sort({ voteCount: -1 }).limit(5).select('title category voteCount location status').lean(),
  ]);

  const resolved = periodIssues.filter(i => i.status === 'resolved');
  const avgResolveTime = resolved.length > 0
    ? Math.round(resolved.reduce((sum, i) => sum + (new Date(i.resolvedAt || i.updatedAt) - new Date(i.createdAt)) / 3600000, 0) / resolved.length)
    : 0;

  const label = type === 'weekly' ? 'Tuần' : 'Tháng';
  const dateRange = `${startDate.toLocaleDateString('vi-VN')} — ${now.toLocaleDateString('vi-VN')}`;

  const html = `
  <div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;background:#1a1a2e;color:#eee;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#6C63FF,#3B82F6);padding:24px 32px">
      <h1 style="margin:0;font-size:22px;color:#fff">📊 Báo cáo ${label} — Smart City Đà Nẵng</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px">${dateRange}</p>
    </div>
    <div style="padding:24px 32px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr>
          <td style="padding:12px;background:#252540;border-radius:8px;text-align:center;width:25%">
            <div style="font-size:28px;font-weight:800;color:#6C63FF">${periodIssues.length}</div>
            <div style="font-size:11px;color:#999">Sự cố mới</div>
          </td>
          <td style="width:8px"></td>
          <td style="padding:12px;background:#252540;border-radius:8px;text-align:center;width:25%">
            <div style="font-size:28px;font-weight:800;color:#10B981">${resolved.length}</div>
            <div style="font-size:11px;color:#999">Đã xử lý</div>
          </td>
          <td style="width:8px"></td>
          <td style="padding:12px;background:#252540;border-radius:8px;text-align:center;width:25%">
            <div style="font-size:28px;font-weight:800;color:#F59E0B">${avgResolveTime}h</div>
            <div style="font-size:11px;color:#999">TB xử lý</div>
          </td>
          <td style="width:8px"></td>
          <td style="padding:12px;background:#252540;border-radius:8px;text-align:center;width:25%">
            <div style="font-size:28px;font-weight:800;color:#3B82F6">${totalAll}</div>
            <div style="font-size:11px;color:#999">Tổng cộng</div>
          </td>
        </tr>
      </table>

      <h3 style="color:#9CA3AF;font-size:13px;margin:16px 0 8px">📈 PHÂN BỔ TRẠNG THÁI</h3>
      <table style="width:100%;border-collapse:collapse">
        ${byStatus.map(s => `<tr><td style="padding:6px 12px;color:#ccc;font-size:13px">${STATUS_VI[s._id] || s._id}</td><td style="text-align:right;padding:6px 12px;font-weight:700;color:#fff;font-size:14px">${s.count}</td></tr>`).join('')}
      </table>

      <h3 style="color:#9CA3AF;font-size:13px;margin:16px 0 8px">📂 PHÂN LOẠI SỰ CỐ</h3>
      <table style="width:100%;border-collapse:collapse">
        ${byCategory.map(c => `<tr><td style="padding:6px 12px;color:#ccc;font-size:13px">${CATEGORY_VI[c._id] || c._id}</td><td style="text-align:right;padding:6px 12px;font-weight:700;color:#fff;font-size:14px">${c.count}</td></tr>`).join('')}
      </table>

      ${topVoted.length > 0 ? `
      <h3 style="color:#9CA3AF;font-size:13px;margin:16px 0 8px">🔥 TOP SỰ CỐ QUAN TRỌNG (theo vote)</h3>
      <table style="width:100%;border-collapse:collapse">
        ${topVoted.map((v, i) => `<tr><td style="padding:6px 12px;color:#ccc;font-size:13px">${i + 1}. ${v.title}</td><td style="text-align:right;padding:6px 12px;font-weight:700;color:#F59E0B;font-size:13px">👍 ${v.voteCount || 0}</td></tr>`).join('')}
      </table>` : ''}

      <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);text-align:center">
        <p style="font-size:11px;color:#666">Smart City Dashboard — Đà Nẵng • Tự động gửi ${type === 'weekly' ? 'hàng tuần' : 'hàng tháng'}</p>
      </div>
    </div>
  </div>`;

  return { html, stats: { total: periodIssues.length, resolved: resolved.length, avgResolveTime, dateRange } };
};

const sendReportToAdmins = async (type = 'weekly') => {
  const admins = await User.find({ role: 'admin', isActive: true }).select('email name').lean();
  if (!admins.length) return;

  const { html } = await generateReport(type);
  const label = type === 'weekly' ? 'Tuần' : 'Tháng';
  const subject = `📊 Báo cáo ${label} — Smart City Đà Nẵng — ${new Date().toLocaleDateString('vi-VN')}`;

  for (const admin of admins) {
    await sendEmail(admin.email, subject, html);
  }
  console.log(`📧 Sent ${type} report to ${admins.length} admin(s)`);
};

module.exports = { generateReport, sendReportToAdmins };
