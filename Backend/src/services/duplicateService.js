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

const OPEN_STATUSES = ['reported', 'processing'];
const OPEN_ISSUE_FILTER = { isDeleted: false, mergedInto: null, status: { $in: OPEN_STATUSES } };

/**
 * Người dân xác nhận một báo cáo gần đó chính là sự cố họ định gửi.
 * Thao tác idempotent: gọi lại không làm tăng vote hoặc follower lần nữa.
 *
 * Lượt ủng hộ + theo dõi được ghi bằng MỘT lệnh có điều kiện (`votes: {$ne}`)
 * thay vì đọc → sửa mảng → save: hai request cùng lúc (bấm đúp) trước đây có thể
 * cùng thêm một người vào `votes` và làm `voteCount` lệch với số người thật.
 */
const confirmDuplicate = async (issueId, userId) => {
  const added = await Issue.findOneAndUpdate(
    { _id: issueId, ...OPEN_ISSUE_FILTER, votes: { $ne: userId } },
    { $addToSet: { votes: userId, followers: userId }, $inc: { voteCount: 1 } },
    { new: true }
  ).select('voteCount');

  if (added) {
    enqueuePriorityRecalculation(added._id);
    recordDuplicateConfirmation();
    return { issueId: added._id, voteCount: added.voteCount, alreadyConfirmed: false };
  }

  // Không ghi được lượt ủng hộ: hoặc người này đã ủng hộ từ trước (vẫn bảo đảm họ
  // đang theo dõi), hoặc phiếu không còn mở.
  const existing = await Issue.findOneAndUpdate(
    { _id: issueId, ...OPEN_ISSUE_FILTER },
    { $addToSet: { followers: userId } },
    { new: true }
  ).select('voteCount');
  if (!existing) {
    throw ApiError.notFound('Sự cố không còn mở hoặc đã được gộp vào báo cáo khác');
  }

  return { issueId: existing._id, voteCount: existing.voteCount, alreadyConfirmed: true };
};

/**
 * Admin gộp `sourceIssueId` (bản trùng) vào `targetIssueId` (bản gốc).
 * Giữ nguyên bản trùng để audit, nhưng mọi danh sách nghiệp vụ lọc `mergedInto: null`.
 *
 * Cả hai phiếu phải đang mở: gộp một báo cáo mới vào phiếu ĐÃ ĐÓNG (đã xử lý /
 * từ chối) thì báo cáo đó không bao giờ được xử lý — nếu sự cố tái diễn, phải
 * xử lý như một phiếu riêng. Gộp một phiếu đã đóng thì xoá nó khỏi số liệu.
 *
 * Không dùng transaction (MongoDB chạy đơn lẻ trên máy dev không hỗ trợ) mà ghi
 * theo hai bước CÓ ĐIỀU KIỆN + hoàn tác: (1) "nhận" phiếu phụ chỉ khi nó còn mở
 * và chưa gộp; (2) cộng dồn vào phiếu gốc chỉ khi phiếu gốc còn mở và chưa gộp —
 * hỏng bước (2) thì trả phiếu phụ về như cũ. Nhờ vậy hai admin gộp chéo A→B và
 * B→A cùng lúc không thể tạo vòng (mỗi phiếu trỏ vào phiếu kia và cùng biến mất).
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
  if (!OPEN_STATUSES.includes(source.status)) {
    throw ApiError.badRequestWithCode(
      'Chỉ gộp được báo cáo đang mở. Báo cáo này đã được xử lý hoặc từ chối.',
      'MERGE_SOURCE_CLOSED'
    );
  }
  if (!OPEN_STATUSES.includes(target.status)) {
    throw ApiError.badRequestWithCode(
      'Sự cố gốc đã đóng (đã xử lý hoặc từ chối). Hãy xử lý báo cáo này như một sự cố riêng.',
      'MERGE_TARGET_CLOSED'
    );
  }

  const mergedAt = new Date();
  const conflict = () => ApiError.conflictWithCode(
    'Một trong hai phiếu vừa thay đổi (đã gộp, đã đóng hoặc đã xoá). Vui lòng tải lại rồi thử lại.',
    'MERGE_CONFLICT'
  );

  // (1) Nhận phiếu phụ.
  const claimedSource = await Issue.findOneAndUpdate(
    { _id: source._id, ...OPEN_ISSUE_FILTER },
    { $set: { mergedInto: target._id, mergedAt, mergedBy: actor.id } },
    { new: true }
  );
  if (!claimedSource) throw conflict();

  // (2) Dồn lượt ủng hộ + người theo dõi về phiếu gốc.
  const newFollowers = uniqueIds([
    target.userId,
    claimedSource.userId,
    ...(claimedSource.followers || []),
    ...(claimedSource.votes || []),
  ]);
  const updatedTarget = await Issue.findOneAndUpdate(
    { _id: target._id, ...OPEN_ISSUE_FILTER },
    {
      $addToSet: {
        votes: { $each: uniqueIds(claimedSource.votes || []) },
        followers: { $each: newFollowers },
      },
      $inc: { duplicateCount: 1 + (claimedSource.duplicateCount || 0) },
    },
    { new: true }
  );
  if (!updatedTarget) {
    await Issue.updateOne(
      { _id: source._id, mergedInto: target._id },
      { $set: { mergedInto: null, mergedAt: null, mergedBy: null } }
    );
    throw conflict();
  }

  // voteCount tính lại từ chính mảng votes trong cùng một lệnh (update pipeline)
  // — $addToSet không cho biết đã thêm bao nhiêu người mới.
  await Issue.updateOne({ _id: target._id }, [{ $set: { voteCount: { $size: '$votes' } } }]);
  updatedTarget.voteCount = (updatedTarget.votes || []).length;

  enqueuePriorityRecalculation(updatedTarget._id);
  enqueuePriorityRecalculation(claimedSource._id);
  recordDuplicateMerge();
  await notifyMergedFollowers({ source: claimedSource, target: updatedTarget });

  return {
    sourceIssueId: claimedSource._id,
    targetIssue: updatedTarget,
  };
};

module.exports = {
  confirmDuplicate,
  mergeIssue,
};
