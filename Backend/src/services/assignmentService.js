const Issue = require('../models/Issue');
const Department = require('../models/Department');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ApiError = require('../utils/apiError');
const { getIO } = require('../config/socket');
const { sendEmail } = require('./emailService');
const { buildAssignmentEmail } = require('../utils/emailTemplates');
const { calculateDueAt, getSlaHours } = require('../utils/slaConfig');
const { parsePagination } = require('../utils/pagination');
const { enqueuePriorityRecalculation } = require('./priorityService');

const QUEUE_LIST_FIELDS = [
  'title', 'category', 'location', 'district', 'latitude', 'longitude',
  'imageUrl', 'status', 'userId', 'voteCount', 'createdAt', 'dueAt',
  'departmentId', 'assigneeId', 'priorityScore', 'priorityLevel',
  'priorityFactors', 'priorityVersion', 'priorityCalculatedAt',
].join(' ');

/**
 * Gửi thông báo realtime + email, nhưng không để lỗi hạ tầng làm fail nghiệp vụ:
 * phân công đã ghi vào DB rồi thì không được rollback vì Socket/SMTP chết.
 */
const notifyAssignment = async ({ issue, department, assignee }) => {
  try {
    const io = getIO();

    // Cán bộ nhận việc trực tiếp, hoặc toàn bộ cán bộ của đơn vị nếu chưa
    // chỉ định người cụ thể.
    const recipients = assignee
      ? [assignee]
      : await User.find({ departmentId: department._id, role: 'staff', isActive: true })
        .select('_id name email');

    const slaHours = getSlaHours(issue.category, department.slaHours);
    // Nội dung email giống nhau cho mọi người nhận nên dựng một lần.
    const assignmentHtml = buildAssignmentEmail({
      departmentName: department.name,
      issueTitle: issue.title,
      category: issue.category,
      location: issue.location,
      dueAt: issue.dueAt,
      slaHours,
      issueId: issue._id,
      clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
    });

    for (const person of recipients) {
      const notification = await Notification.create({
        userId: person._id,
        type: 'issue_assigned',
        title: '📋 Sự cố được phân công',
        message: `Sự cố "${issue.title}" đã được phân công cho ${department.name}. Hạn xử lý: ${slaHours} giờ.`,
        issueId: issue._id,
      });
      io.to(`user_${person._id}`).emit('notification:new', notification);

      if (person.email) {
        sendEmail(
          person.email,
          `[Phân công] ${issue.title}`,
          assignmentHtml
        );
      }
    }

    // Hộp thư chung của đơn vị (nếu có khai báo) — để đơn vị không phụ thuộc
    // vào việc cán bộ nào đang online.
    if (department.email) {
      sendEmail(department.email, `[Phân công] ${issue.title}`, assignmentHtml);
    }

    // Người báo cáo cũng nên biết việc của mình đã có đơn vị nhận
    const reporterId = issue.userId?._id || issue.userId;
    if (reporterId) {
      const reporterNotif = await Notification.create({
        userId: reporterId,
        type: 'issue_updated',
        title: 'Sự cố đã được phân công',
        message: `Sự cố "${issue.title}" đã được chuyển tới ${department.name} để xử lý.`,
        issueId: issue._id,
      });
      io.to(`user_${reporterId}`).emit('notification:new', reporterNotif);
    }

    io.to('admins').emit('issue:assigned', { issueId: issue._id, departmentId: department._id });
  } catch (err) {
    console.warn('Assignment notification error:', err.message);
  }
};

/**
 * Admin phân công sự cố cho một đơn vị (kèm cán bộ cụ thể nếu muốn).
 * Mốc SLA được tính từ THỜI ĐIỂM PHÂN CÔNG: đơn vị chỉ chịu trách nhiệm
 * từ khi nhận việc, nên phân công lại sẽ reset hạn và mức leo cấp.
 */
const assignIssue = async (issueId, { departmentId, assigneeId = null, note = '' }, actor) => {
  const issue = await Issue.findOne({ _id: issueId, isDeleted: false });
  if (!issue) throw ApiError.notFound('Sự cố không tồn tại');
  if (issue.mergedInto) {
    throw ApiError.badRequest('Sự cố này đã được gộp vào sự cố khác, không thể phân công');
  }
  if (issue.status === 'resolved' || issue.status === 'rejected') {
    throw ApiError.badRequest('Sự cố đã đóng, không thể phân công');
  }

  const department = await Department.findOne({ _id: departmentId, isActive: true });
  if (!department) throw ApiError.notFound('Đơn vị không tồn tại hoặc đã bị vô hiệu hoá');

  let assignee = null;
  if (assigneeId) {
    assignee = await User.findOne({ _id: assigneeId, role: 'staff', isActive: true })
      .select('_id name email departmentId');
    if (!assignee) throw ApiError.notFound('Cán bộ không tồn tại hoặc đã bị vô hiệu hoá');
    // Không cho phân việc cho cán bộ của đơn vị khác — sẽ tạo ra việc mà
    // chính cán bộ đó không có quyền xem theo phạm vi đơn vị.
    if (assignee.departmentId?.toString() !== department._id.toString()) {
      throw ApiError.badRequest('Cán bộ không thuộc đơn vị được phân công');
    }
  }

  const now = new Date();
  issue.departmentId = department._id;
  issue.assigneeId = assignee?._id || null;
  issue.assignedBy = actor.id;
  issue.assignedAt = now;
  issue.dueAt = calculateDueAt(issue.category, department.slaHours, now);
  // Reset chu kỳ nhắc hạn cho lần phân công mới
  issue.escalationLevel = 0;
  issue.lastReminderAt = null;

  // Nhận việc thì coi như bắt đầu xử lý, khỏi bắt admin bấm 2 lần
  if (issue.status === 'reported') {
    issue.status = 'processing';
  }
  issue.statusHistory.push({
    status: issue.status,
    changedBy: actor.id,
    changedAt: now,
    note: note || `Phân công cho ${department.name}${assignee ? ` — cán bộ ${assignee.name}` : ''}`,
  });

  await issue.save();
  enqueuePriorityRecalculation(issue._id);
  await issue.populate('userId', 'name email');

  await notifyAssignment({ issue, department, assignee });

  return issue;
};

/**
 * Bỏ phân công, đưa sự cố về hàng chờ của admin. Xoá luôn hạn xử lý vì
 * không còn đơn vị nào chịu trách nhiệm.
 */
const unassignIssue = async (issueId, { note = '' }, actor) => {
  const issue = await Issue.findOne({ _id: issueId, isDeleted: false });
  if (!issue) throw ApiError.notFound('Sự cố không tồn tại');
  if (!issue.departmentId) throw ApiError.badRequest('Sự cố chưa được phân công');

  issue.departmentId = null;
  issue.assigneeId = null;
  issue.assignedBy = null;
  issue.assignedAt = null;
  issue.dueAt = null;
  issue.escalationLevel = 0;
  issue.lastReminderAt = null;
  issue.statusHistory.push({
    status: issue.status,
    changedBy: actor.id,
    changedAt: new Date(),
    note: note || 'Thu hồi phân công',
  });

  await issue.save();
  enqueuePriorityRecalculation(issue._id);
  return issue;
};

/**
 * Cán bộ tự nhận việc trong hàng chờ của đơn vị mình. Dùng `findOneAndUpdate`
 * với điều kiện `assigneeId: null` để hai cán bộ bấm cùng lúc thì chỉ một
 * người nhận được (tránh race condition).
 */
const claimIssue = async (issueId, staffUser) => {
  if (staffUser?.role !== 'staff' || !staffUser.departmentId) {
    throw ApiError.forbidden('Chỉ cán bộ đã được gán đơn vị mới có thể nhận việc');
  }

  const issue = await Issue.findOneAndUpdate(
    {
      _id: issueId,
      isDeleted: false,
      mergedInto: null,
      departmentId: staffUser.departmentId,
      assigneeId: null,
      status: { $in: ['reported', 'processing'] },
    },
    { assigneeId: staffUser.id },
    { new: true }
  ).populate('userId', 'name email');

  if (!issue) {
    throw ApiError.badRequest('Sự cố không còn trong hàng chờ của đơn vị bạn hoặc đã có người nhận');
  }
  enqueuePriorityRecalculation(issue._id);
  return issue;
};

/**
 * Kiểm tra một cán bộ có quyền tác động lên sự cố hay không.
 * Admin: toàn quyền. Staff: chỉ sự cố thuộc đơn vị mình.
 * Tách riêng để cả controller và service khác dùng lại được cùng một luật.
 */
const assertCanHandleIssue = (issue, user) => {
  if (user.role === 'admin') return;
  if (user.role !== 'staff') {
    throw ApiError.forbidden('Bạn không có quyền xử lý sự cố');
  }
  const issueDept = issue.departmentId?._id || issue.departmentId;
  if (!issueDept || issueDept.toString() !== user.departmentId?.toString()) {
    throw ApiError.forbidden('Sự cố này không thuộc đơn vị của bạn');
  }
};

/**
 * Hàng chờ chưa phân công — màn hình làm việc chính của admin.
 */
const getUnassignedQueue = async ({ page = 1, limit = 20, priorityLevel } = {}) => {
  const { pageNum, limitNum, skip } = parsePagination(
    { page, limit },
    { defaultLimit: 20, maxLimit: 100 }
  );

  const filter = {
    isDeleted: false,
    departmentId: null,
    mergedInto: null,
    status: { $in: ['reported', 'processing'] },
  };
  if (['low', 'medium', 'high', 'critical'].includes(priorityLevel)) {
    filter.priorityLevel = priorityLevel;
  }

  const [issues, total] = await Promise.all([
    Issue.find(filter)
      .select(QUEUE_LIST_FIELDS)
      .populate('userId', 'name email')
      .sort({ priorityScore: -1, createdAt: 1 })
      .skip(skip)
      .limit(limitNum),
    Issue.countDocuments(filter),
  ]);

  return {
    issues,
    pagination: {
      current: pageNum,
      pages: Math.ceil(total / limitNum),
      total,
      limit: limitNum,
    },
  };
};

module.exports = {
  assignIssue,
  unassignIssue,
  claimIssue,
  assertCanHandleIssue,
  getUnassignedQueue,
};
