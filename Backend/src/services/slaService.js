const Issue = require('../models/Issue');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getIO } = require('../config/socket');
const { sendEmail } = require('./emailService');
const { buildSlaReminderEmail, buildSlaEscalationEmail } = require('../utils/emailTemplates');
const { ESCALATION_LEVELS, getIntakeHours } = require('../utils/slaConfig');

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
    // `$gte` chứ không phải `===`: trước đây query chỉ khớp mức 1, nên phiếu sau
    // khi lên mức 2 là IM LẶNG VĨNH VIỄN — phiếu quá hạn 3 tháng nhận đúng số
    // thông báo bằng phiếu quá hạn 25 giờ. Giờ phiếu đã leo cấp vẫn được nhắc
    // lại mỗi 24 giờ cho tới khi được xử lý; `lastReminderAt` giữ nhịp.
    escalationLevel: { $gte: ESCALATION_LEVELS.REMINDED },
    lastReminderAt: { $ne: null, $lt: new Date(now.getTime() - 24 * HOUR_MS) },
  })
    .populate('departmentId', 'name')
    .select('title location dueAt departmentId escalationLevel');

  if (!issues.length) return { escalated: 0 };

  // Phân biệt lần leo cấp đầu với lần nhắc lại, để admin biết phiếu nào đã bị
  // bỏ qua nhiều vòng chứ không chỉ "có phiếu quá hạn".
  const repeated = issues.filter((i) => i.escalationLevel >= ESCALATION_LEVELS.ESCALATED).length;

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
      title: repeated ? 'Sự cố tồn đọng kéo dài' : 'Sự cố tồn đọng',
      message: `${rows.length} sự cố đã quá hạn dù đã nhắc đơn vị. Cần can thiệp hoặc chuyển đơn vị khác.`
        + (repeated ? ` Trong đó ${repeated} sự cố đã được báo từ các vòng trước mà vẫn chưa xử lý.` : ''),
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
 * Hạn tiếp nhận — nhắc admin về phiếu CHƯA PHÂN CÔNG đã quá hạn.
 *
 * Hai lượt quét trên đều lọc `departmentId: { $ne: null }`, nên trước đây một
 * phiếu nằm trong hàng chờ phân công không được đo gì cả và không ai bị nhắc,
 * dù tồn đọng bao lâu. `dueAt` chỉ được gán lúc phân công
 * (`assignmentService`), nghĩa là đồng hồ SLA chỉ bắt đầu chạy SAU khi việc
 * đã được giao — bỏ trống đúng giai đoạn dễ trễ nhất.
 *
 * Người nhận là admin vì chỉ admin có quyền phân công. Nhắc lại sau 24 giờ thay
 * vì một lần rồi im lặng — chuỗi leo cấp hiện tại dừng ở cấp 2 rồi không bao giờ
 * báo lại, và đó là lỗi cần tránh lặp lại.
 */
const remindUnassignedIssues = async (now = new Date()) => {
  const issues = await Issue.find({
    isDeleted: false,
    mergedInto: null,
    status: { $in: ['reported', 'processing'] },
    departmentId: null,
    intakeDueAt: { $ne: null, $lt: now },
    $or: [
      { intakeReminderAt: null },
      { intakeReminderAt: { $lt: new Date(now.getTime() - 24 * HOUR_MS) } },
    ],
  })
    .select('title location category intakeDueAt');

  if (!issues.length) return { unassigned: 0 };

  const rows = issues.map((issue) => ({
    _id: issue._id,
    title: issue.title,
    location: issue.location,
    // Tái dùng mẫu email leo cấp: cùng là "việc tồn đọng cần can thiệp", chỉ
    // khác là chưa có đơn vị nào để đổ trách nhiệm.
    departmentName: 'Chưa phân công',
    overdueHours: overdueHours(issue.intakeDueAt, now),
  }));

  const admins = await User.find({ role: 'admin', isActive: true }).select('name email');
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const shortestIntake = Math.min(...issues.map((i) => getIntakeHours(i.category)));

  for (const admin of admins) {
    if (admin.email) {
      sendEmail(
        admin.email,
        `📥 ${rows.length} sự cố chưa được phân công dù đã quá hạn tiếp nhận`,
        buildSlaEscalationEmail({ adminName: admin.name, issues: rows, clientUrl })
      );
    }
    await notify(admin._id, {
      type: 'intake_overdue',
      title: 'Sự cố chờ phân công quá hạn',
      message: `${rows.length} sự cố chưa được phân công dù đã quá hạn tiếp nhận `
        + `(ngắn nhất ${shortestIntake} giờ). Cần phân công để đồng hồ SLA bắt đầu chạy.`,
      issueId: issues[0]._id,
    });
  }

  await Issue.updateMany(
    { _id: { $in: issues.map((i) => i._id) } },
    { intakeReminderAt: now }
  );

  return { unassigned: issues.length };
};

/**
 * Một lượt quét hoàn chỉnh. Tách khỏi cron để test và chạy tay được.
 */
const runSlaCheck = async (now = new Date()) => {
  const reminder = await remindOverdueIssues(now);
  const escalation = await escalateOverdueIssues(now);
  const intake = await remindUnassignedIssues(now);
  return { ...reminder, ...escalation, ...intake };
};

module.exports = {
  remindOverdueIssues,
  escalateOverdueIssues,
  remindUnassignedIssues,
  runSlaCheck,
};
