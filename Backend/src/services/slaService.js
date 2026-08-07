const Issue = require('../models/Issue');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getIO } = require('../config/socket');
const { sendEmail } = require('./emailService');
const { buildSlaReminderEmail, buildSlaEscalationEmail } = require('../utils/emailTemplates');
const { ESCALATION_LEVELS } = require('../utils/slaConfig');

const HOUR_MS = 60 * 60 * 1000;

/** Số giờ đã quá hạn, làm tròn để hiển thị trong email */
const overdueHours = (dueAt, now) => Math.round((now - new Date(dueAt)) / HOUR_MS);

/**
 * Gửi thông báo in-app; không để lỗi Socket làm dừng cả lượt quét.
 */
const notify = async (userId, { type, title, message, issueId }) => {
  try {
    const notification = await Notification.create({ userId, type, title, message, issueId });
    getIO().to(`user_${userId}`).emit('notification:new', notification);
  } catch (err) {
    console.warn('SLA notification error:', err.message);
  }
};

/**
 * Cấp 1 — nhắc đơn vị: sự cố đã quá hạn nhưng chưa nhắc lần nào.
 *
 * `escalationLevel` được nâng lên 1 sau khi nhắc để lượt quét sau không gửi
 * trùng. Gom sự cố theo đơn vị rồi gửi một email tổng hợp, thay vì mỗi sự cố
 * một email làm ngập hộp thư của cán bộ.
 */
const remindOverdueIssues = async (now = new Date()) => {
  const issues = await Issue.find({
    isDeleted: false,
    mergedInto: null,
    status: { $in: ['reported', 'processing'] },
    departmentId: { $ne: null },
    dueAt: { $ne: null, $lt: now },
    escalationLevel: 0,
  })
    .populate('departmentId', 'name email')
    .select('title location dueAt departmentId assigneeId');

  if (!issues.length) return { reminded: 0, departments: 0 };

  // Gom theo đơn vị
  const byDepartment = new Map();
  for (const issue of issues) {
    const dept = issue.departmentId;
    if (!dept) continue;
    const key = dept._id.toString();
    if (!byDepartment.has(key)) byDepartment.set(key, { department: dept, issues: [] });
    byDepartment.get(key).issues.push(issue);
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  for (const { department, issues: deptIssues } of byDepartment.values()) {
    const rows = deptIssues.map((issue) => ({
      _id: issue._id,
      title: issue.title,
      location: issue.location,
      overdueHours: overdueHours(issue.dueAt, now),
    }));

    // Email tới hộp thư đơn vị và tới từng cán bộ của đơn vị đó
    const staff = await User.find({
      departmentId: department._id,
      role: 'staff',
      isActive: true,
    }).select('name email');

    const recipients = [
      ...(department.email ? [{ name: department.name, email: department.email }] : []),
      ...staff,
    ];

    for (const person of recipients) {
      if (!person.email) continue;
      sendEmail(
        person.email,
        `⏰ ${rows.length} sự cố quá hạn xử lý`,
        buildSlaReminderEmail({ recipientName: person.name, issues: rows, clientUrl })
      );
    }

    // Thông báo in-app cho cán bộ, ưu tiên người được phân công trực tiếp
    for (const issue of deptIssues) {
      const targets = issue.assigneeId ? [issue.assigneeId] : staff.map((s) => s._id);
      for (const target of targets) {
        await notify(target, {
          type: 'sla_reminder',
          title: '⏰ Sự cố quá hạn xử lý',
          message: `Sự cố "${issue.title}" đã quá hạn ${overdueHours(issue.dueAt, now)} giờ.`,
          issueId: issue._id,
        });
      }
    }
  }

  // Đánh dấu đã nhắc để không gửi lại ở lượt quét sau
  await Issue.updateMany(
    { _id: { $in: issues.map((i) => i._id) } },
    { escalationLevel: ESCALATION_LEVELS.REMINDED, lastReminderAt: now }
  );

  return { reminded: issues.length, departments: byDepartment.size };
};

/**
 * Cấp 2 — leo cấp lên admin: đã nhắc đơn vị mà vẫn chưa xong, và thời gian
 * quá hạn đã vượt 24 giờ kể từ lúc nhắc. Ngưỡng này để đơn vị có thời gian
 * phản ứng trước khi bị báo lên trên.
 */
const escalateOverdueIssues = async (now = new Date()) => {
  const issues = await Issue.find({
    isDeleted: false,
    mergedInto: null,
    status: { $in: ['reported', 'processing'] },
    departmentId: { $ne: null },
    dueAt: { $ne: null, $lt: now },
    escalationLevel: ESCALATION_LEVELS.REMINDED,
    lastReminderAt: { $ne: null, $lt: new Date(now.getTime() - 24 * HOUR_MS) },
  })
    .populate('departmentId', 'name')
    .select('title location dueAt departmentId');

  if (!issues.length) return { escalated: 0 };

  const rows = issues.map((issue) => ({
    _id: issue._id,
    title: issue.title,
    departmentName: issue.departmentId?.name,
    overdueHours: overdueHours(issue.dueAt, now),
  }));

  const admins = await User.find({ role: 'admin', isActive: true }).select('name email');
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  for (const admin of admins) {
    if (admin.email) {
      sendEmail(
        admin.email,
        `🚨 ${rows.length} sự cố tồn đọng cần can thiệp`,
        buildSlaEscalationEmail({ adminName: admin.name, issues: rows, clientUrl })
      );
    }
    await notify(admin._id, {
      type: 'sla_escalated',
      title: '🚨 Sự cố tồn đọng',
      message: `${rows.length} sự cố đã quá hạn dù đã nhắc đơn vị. Cần can thiệp hoặc chuyển đơn vị khác.`,
      issueId: issues[0]._id,
    });
  }

  await Issue.updateMany(
    { _id: { $in: issues.map((i) => i._id) } },
    { escalationLevel: ESCALATION_LEVELS.ESCALATED, lastReminderAt: now }
  );

  return { escalated: issues.length };
};

/**
 * Một lượt quét hoàn chỉnh. Tách khỏi cron để test và chạy tay được.
 */
const runSlaCheck = async (now = new Date()) => {
  const reminder = await remindOverdueIssues(now);
  const escalation = await escalateOverdueIssues(now);
  return { ...reminder, ...escalation };
};

module.exports = { remindOverdueIssues, escalateOverdueIssues, runSlaCheck };
