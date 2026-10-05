const Issue = require('../models/Issue');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ApiError = require('../utils/apiError');
const { getIO } = require('../config/socket');
const { checkCanReopen } = require('../utils/reopenConfig');
const { calculateDueAt } = require('../utils/slaConfig');
const { enqueuePriorityRecalculation } = require('./priorityService');
const { buildRoundArchive, resetRoundFields } = require('../utils/issueRounds');

/**
 * Gửi thông báo in-app; lỗi Socket/DB không được làm hỏng thao tác đã ghi thành công.
 */
const notify = async (userId, payload) => {
  try {
    const notification = await Notification.create({ userId, ...payload });
    getIO().to(`user_${userId}`).emit('notification:new', notification);
  } catch (err) {
    console.warn('Reopen notification error:', err.message);
  }
};

/**
 * Người dân mở lại sự cố vì không đồng ý kết quả xử lý.
 *
 * Đây là đường quay lại duy nhất của người báo cáo. Trước đây vòng đời phiếu chỉ
 * chạy một hướng: gửi -> xử lý -> đóng, và người dân không có cách nào phản hồi
 * ngoài việc chấm sao (mà chấm 1 sao cũng không kích hoạt gì).
 *
 * Mọi rào chắn (ai được mở, trạng thái nào, bao nhiêu lần, trong bao lâu) nằm ở
 * `utils/reopenConfig.js` để kiểm thử được độc lập và sửa một chỗ.
 *
 * @param {string} issueId
 * @param {string|ObjectId} userId - Người gọi; phải là người báo cáo
 * @param {{ reason: string }} payload
 */
const reopenIssue = async (issueId, userId, { reason }) => {
  const issue = await Issue.findOne({ _id: issueId, isDeleted: false })
    .populate('departmentId', 'name slaHours');

  const verdict = checkCanReopen(issue, userId);
  if (!verdict.ok) {
    // 404 cho phiếu không tồn tại, 403 cho sai người, còn lại là lỗi nghiệp vụ 400.
    if (verdict.code === 'ISSUE_NOT_FOUND') throw ApiError.notFound(verdict.message);
    if (verdict.code === 'NOT_REPORTER') {
      const error = ApiError.forbidden(verdict.message);
      error.code = verdict.code;
      throw error;
    }
    throw ApiError.badRequestWithCode(verdict.message, verdict.code);
  }

  const now = new Date();
  const trimmedReason = reason.trim();
  const previousReopenCount = issue.reopenCount || 0;

  const update = {
    $set: {
      status: 'processing',
      lastReopenedAt: now,
      // Lượt mới: resolvedAt về null (để nguyên sẽ làm sai thống kê thời gian xử
      // lý; lần đóng sau gán mốc mới), ảnh minh chứng + đánh giá của lượt cũ được
      // cất vào previousRounds — xem utils/issueRounds.js.
      ...resetRoundFields(),
    },
    $inc: { reopenCount: 1 },
    $push: {
      statusHistory: {
        status: 'processing',
        changedBy: userId,
        changedAt: now,
        note: `Người dân mở lại: ${trimmedReason}`,
      },
      previousRounds: buildRoundArchive(issue, { reopenedAt: now, reopenedBy: userId, reason: trimmedReason }),
    },
  };

  // SLA được cấp chu kỳ mới: đơn vị nhận lại việc nên cần một hạn có nghĩa.
  // Giữ nguyên dueAt cũ (đã quá hạn từ lâu) thì phiếu lập tức "quá hạn" mà cron
  // lại không nhắc nữa vì escalationLevel đã ở mức cuối. Người dân là bên khởi
  // xướng nên đơn vị không thể dùng đường này để tự reset đồng hồ của mình.
  if (issue.departmentId) {
    update.$set.dueAt = calculateDueAt(issue.category, issue.departmentId.slaHours, now);
    update.$set.escalationLevel = 0;
    update.$set.lastReminderAt = null;
  }

  // Ghi CÓ ĐIỀU KIỆN: phiếu còn đúng trạng thái đóng và đúng số lần mở lại như lúc
  // kiểm tra. Bấm "Mở lại" hai lần cùng lúc thì chỉ một lần được ghi — trước đây
  // cả hai cùng qua kiểm tra rồi cùng save (2 dòng lịch sử, 2 lượt thông báo).
  // Phiếu cũ chưa có field reopenCount: `null` khớp cả trường hợp field vắng mặt.
  const reopened = await Issue.findOneAndUpdate(
    {
      _id: issue._id,
      isDeleted: false,
      mergedInto: null,
      status: issue.status,
      reopenCount: previousReopenCount || { $in: [0, null] },
    },
    update,
    { new: true, runValidators: true }
  ).populate('departmentId', 'name slaHours');

  if (!reopened) {
    throw ApiError.conflictWithCode(
      'Sự cố vừa được cập nhật bởi người khác. Vui lòng tải lại trang rồi thử lại.',
      'STATUS_CONFLICT'
    );
  }

  enqueuePriorityRecalculation(reopened._id);

  // Báo cho đúng người đang chịu trách nhiệm, và luôn báo admin vì đây là tín
  // hiệu chất lượng xử lý chứ không chỉ là một việc cần làm.
  const recipientIds = new Map();
  if (reopened.assigneeId) {
    recipientIds.set(reopened.assigneeId.toString(), reopened.assigneeId);
  } else if (reopened.departmentId) {
    const staff = await User.find({
      departmentId: reopened.departmentId._id,
      role: 'staff',
      isActive: true,
    }).select('_id');
    staff.forEach((s) => recipientIds.set(s._id.toString(), s._id));
  }
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  admins.forEach((a) => recipientIds.set(a._id.toString(), a._id));

  for (const recipientId of recipientIds.values()) {
    await notify(recipientId, {
      type: 'issue_reopened',
      title: 'Người dân mở lại sự cố',
      message: `Sự cố "${reopened.title}" được mở lại (lần ${reopened.reopenCount}): ${trimmedReason}`,
      issueId: reopened._id,
    });
  }

  return reopened;
};

module.exports = { reopenIssue };
