const Issue = require('../models/Issue');
const Notification = require('../models/Notification');
const ApiError = require('../utils/apiError');
const { getIO } = require('../config/socket');
const { enqueuePriorityRecalculation } = require('./priorityService');
const {
  recordDuplicateConfirmation,
  recordDuplicateMerge,
} = require('./duplicateMetricsService');

const getId = (value) => value?._id || value;

const uniqueIds = (values) => {
  const byId = new Map();
  for (const value of values.filter(Boolean)) {
    byId.set(getId(value).toString(), getId(value));
  }
  return [...byId.values()];
};

const notifyMergedFollowers = async ({ source, target }) => {
  try {
    const recipients = uniqueIds([
      source.userId,
      ...(source.followers || []),
      ...(source.votes || []),
    ]);
    const io = getIO();

    for (const userId of recipients) {
      const notification = await Notification.create({
        userId,
        type: 'issue_merged',
        title: 'Báo cáo trùng đã được hợp nhất',
        message: `Báo cáo "${source.title}" đã được gộp vào "${target.title}". Bạn sẽ tiếp tục nhận cập nhật từ sự cố gốc.`,
        issueId: target._id,
      });
      io.to(`user_${userId}`).emit('notification:new', notification);
    }
  } catch (error) {
    // Việc gộp đã ghi thành công thì không rollback chỉ vì Socket/Notification lỗi.
    console.warn('Merge notification error:', error.message);
  }
};

/**
 * Người dân xác nhận một báo cáo gần đó chính là sự cố họ định gửi.
 * Thao tác idempotent: gọi lại không làm tăng vote hoặc follower lần nữa.
 */
const confirmDuplicate = async (issueId, userId) => {
  const issue = await Issue.findOne({
    _id: issueId,
    isDeleted: false,
    mergedInto: null,
    status: { $in: ['reported', 'processing'] },
  });
  if (!issue) {
    throw ApiError.notFound('Sự cố không còn mở hoặc đã được gộp vào báo cáo khác');
  }

  const alreadyConfirmed = (issue.votes || [])
    .some((id) => getId(id).toString() === userId.toString());
  if (!alreadyConfirmed) issue.votes.push(userId);

  const alreadyFollowing = (issue.followers || [])
    .some((id) => getId(id).toString() === userId.toString());
  if (!alreadyFollowing) issue.followers.push(userId);

  issue.voteCount = issue.votes.length;
  await issue.save();
  enqueuePriorityRecalculation(issue._id);
  if (!alreadyConfirmed) recordDuplicateConfirmation();

  return {
    issueId: issue._id,
    voteCount: issue.voteCount,
    alreadyConfirmed,
  };
};

/**
 * Admin gộp `sourceIssueId` (bản trùng) vào `targetIssueId` (bản gốc).
 * Giữ nguyên bản trùng để audit, nhưng mọi danh sách nghiệp vụ lọc `mergedInto: null`.
 */
const mergeIssue = async (sourceIssueId, targetIssueId, actor) => {
  if (sourceIssueId.toString() === targetIssueId.toString()) {
    throw ApiError.badRequest('Không thể gộp một sự cố vào chính nó');
  }

  const [source, target] = await Promise.all([
    Issue.findOne({ _id: sourceIssueId, isDeleted: false }),
    Issue.findOne({ _id: targetIssueId, isDeleted: false }),
  ]);

  if (!source) throw ApiError.notFound('Không tìm thấy báo cáo trùng cần gộp');
  if (!target) throw ApiError.notFound('Không tìm thấy sự cố gốc');
  if (source.mergedInto) {
    throw ApiError.badRequest('Báo cáo này đã được gộp trước đó');
  }
  if (target.mergedInto) {
    throw ApiError.badRequest('Sự cố đích cũng là bản trùng; hãy chọn sự cố gốc');
  }

  target.votes = uniqueIds([
    ...(target.votes || []),
    ...(source.votes || []),
  ]);
  target.followers = uniqueIds([
    target.userId,
    ...(target.followers || []),
    source.userId,
    ...(source.followers || []),
    ...(source.votes || []),
  ]);
  target.voteCount = target.votes.length;
  target.duplicateCount = (target.duplicateCount || 0) + 1 + (source.duplicateCount || 0);

  source.mergedInto = target._id;
  source.mergedAt = new Date();
  source.mergedBy = actor.id;

  await target.save();
  await source.save();
  enqueuePriorityRecalculation(target._id);
  enqueuePriorityRecalculation(source._id);
  recordDuplicateMerge();
  await notifyMergedFollowers({ source, target });

  return {
    sourceIssueId: source._id,
    targetIssue: target,
  };
};

module.exports = {
  confirmDuplicate,
  mergeIssue,
};
