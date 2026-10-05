const Issue = require('../models/Issue');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ApiError = require('../utils/apiError');
const { getIO } = require('../config/socket');

/** Điểm từ mức này trở xuống được coi là phản hồi tiêu cực, cần người xem lại. */
const LOW_RATING_THRESHOLD = 2;

/**
 * Gửi thông báo in-app; lỗi Socket/DB không được làm hỏng điểm đánh giá đã ghi.
 */
const notify = async (userId, payload) => {
  try {
    const notification = await Notification.create({ userId, ...payload });
    getIO().to(`user_${userId}`).emit('notification:new', notification);
  } catch (err) {
    console.warn('Rating notification error:', err.message);
  }
};

/**
 * Người dân chấm điểm chất lượng xử lý.
 *
 * Trước đây hàm này là ngõ cụt: chỉ ghi `issue.rating` rồi `save()`. Không import
 * `Notification`, không socket, không email, không có nhánh nào cho điểm thấp.
 * Hệ quả là chấm 1 sao KHÔNG kích hoạt gì — trong khi hệ thống lại chủ động gửi
 * email mời đánh giá, nên vòng phản hồi đứt đúng ở bước cuối cùng.
 *
 * Giờ: mọi đánh giá đều báo cho đơn vị/cán bộ phụ trách, và điểm thấp còn báo
 * lên quản trị viên vì đó là tín hiệu chất lượng cần người xem lại.
 */
const rateIssue = async (issueId, userId, { score, comment }) => {
  const issue = await Issue.findOne({ _id: issueId, isDeleted: false, mergedInto: null })
    .populate('departmentId', 'name');
  if (!issue) throw ApiError.notFound('Sự cố không tồn tại');

  const reporterId = issue.userId._id.toString();
  if (reporterId !== userId.toString()) {
    throw ApiError.forbidden('Chỉ người báo cáo mới có thể đánh giá sự cố này');
  }

  // Phiếu bị TỪ CHỐI cũng được đánh giá. Trước đây chỉ cho 'resolved', nghĩa là
  // đúng nhóm người có khả năng không hài lòng nhất lại không có kênh phản hồi
  // nào — họ chỉ còn cách mở lại phiếu (G8).
  if (!['resolved', 'rejected'].includes(issue.status)) {
    throw ApiError.badRequestWithCode(
      'Chỉ có thể đánh giá sự cố đã xử lý xong hoặc bị từ chối',
      'ISSUE_NOT_CLOSED'
    );
  }

  if (issue.rating?.score) {
    throw ApiError.badRequestWithCode('Bạn đã đánh giá sự cố này rồi', 'ALREADY_RATED');
  }

  // Ghi CÓ ĐIỀU KIỆN: phiếu vẫn đúng trạng thái vừa kiểm tra và CHƯA có điểm.
  // Trước đây đọc → gán → save: bấm gửi hai lần thì cả hai cùng qua kiểm tra
  // (lần sau ghi đè lần trước, đơn vị nhận hai thông báo), còn đánh giá đúng lúc
  // phiếu bị mở lại thì điểm của lượt cũ rơi vào lượt mới vừa được đặt lại.
  const rated = await Issue.findOneAndUpdate(
    {
      _id: issue._id,
      isDeleted: false,
      mergedInto: null,
      status: issue.status,
      'rating.score': null,
    },
    { $set: { rating: { score, comment: comment || null, ratedAt: new Date() } } },
    { new: true, runValidators: true }
  ).populate('departmentId', 'name');

  if (!rated) {
    const latest = await Issue.findOne({ _id: issue._id }).select('rating status');
    if (latest?.rating?.score) {
      throw ApiError.badRequestWithCode('Bạn đã đánh giá sự cố này rồi', 'ALREADY_RATED');
    }
    throw ApiError.conflictWithCode(
      'Sự cố vừa được cập nhật (có thể đã được mở lại). Vui lòng tải lại trang.',
      'STATUS_CONFLICT'
    );
  }

  // ─── Khép vòng phản hồi ───
  const isLow = score <= LOW_RATING_THRESHOLD;
  const stars = '⭐'.repeat(score);

  // Người trực tiếp xử lý cần biết kết quả công việc của mình được đánh giá ra sao.
  const handlerIds = new Map();
  if (issue.assigneeId) {
    handlerIds.set(issue.assigneeId.toString(), issue.assigneeId);
  } else if (issue.departmentId) {
    const staff = await User.find({
      departmentId: issue.departmentId._id,
      role: 'staff',
      isActive: true,
    }).select('_id');
    staff.forEach((s) => handlerIds.set(s._id.toString(), s._id));
  }

  for (const handlerId of handlerIds.values()) {
    await notify(handlerId, {
      type: 'issue_rated',
      title: isLow ? '⚠️ Đánh giá thấp về sự cố bạn xử lý' : `${stars} Người dân đã đánh giá`,
      message: `Sự cố "${issue.title}" được chấm ${score}/5 sao`
        + (comment ? `: ${comment}` : '.'),
      issueId: issue._id,
    });
  }

  // Điểm thấp là tín hiệu chất lượng, không chỉ là một việc đã xong — quản trị
  // viên phải thấy để còn xem lại, kể cả khi phiếu đã đóng.
  if (isLow) {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    for (const admin of admins) {
      // Người xử lý đã nhận ở trên rồi thì không gửi trùng.
      if (handlerIds.has(admin._id.toString())) continue;
      await notify(admin._id, {
        type: 'issue_rated',
        title: 'Đánh giá thấp cần xem lại',
        message: `Sự cố "${issue.title}" bị chấm ${score}/5 sao`
          + (issue.departmentId?.name ? ` (đơn vị: ${issue.departmentId.name})` : '')
          + (comment ? `. Nhận xét: ${comment}` : '.'),
        issueId: issue._id,
      });
    }
  }

  return rated;
};

const getAverageRating = async () => {
  const result = await Issue.aggregate([
    { $match: { isDeleted: false, mergedInto: null, 'rating.score': { $ne: null } } },
    {
      $group: {
        _id: null,
        average: { $avg: '$rating.score' },
        total: { $sum: 1 },
        distribution: {
          $push: '$rating.score'
        }
      }
    }
  ]);

  if (!result.length) {
    return { average: 0, total: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  }

  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  result[0].distribution.forEach(s => { dist[s] = (dist[s] || 0) + 1; });

  return {
    average: Math.round(result[0].average * 10) / 10,
    total: result[0].total,
    distribution: dist,
  };
};

module.exports = { rateIssue, getAverageRating, LOW_RATING_THRESHOLD };
