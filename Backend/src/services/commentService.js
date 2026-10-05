const Comment = require('../models/Comment');
const Issue = require('../models/Issue');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { getIO } = require('../config/socket');
const { parsePagination } = require('../utils/pagination');

// Route đọc bình luận là CÔNG KHAI (khách xem được), nên người viết chỉ lộ tên và
// vai trò — vai trò để giao diện gắn nhãn "Cán bộ"/"Quản trị". Trước đây populate
// cả `email`: ai mở trang sự cố cũng gom được email của mọi người đã bình luận.
const COMMENT_AUTHOR_FIELDS = 'name role';

const getComments = async (issueId, { page = 1, limit = 30 } = {}) => {
  const { pageNum, limitNum, skip } = parsePagination(
    { page, limit },
    { defaultLimit: 30, maxLimit: 100 }
  );

  // Sự cố đã xoá (xoá mềm) thì trang chi tiết trả 404 — bình luận của nó cũng
  // không được tiếp tục công khai qua đường gọi API trực tiếp.
  const issueVisible = await Issue.exists({ _id: issueId, isDeleted: false });
  if (!issueVisible) throw ApiError.notFound('Không tìm thấy sự cố.');

  // Bình luận đã ẩn không ra khỏi server. Giữ bản ghi để truy vết nếu có khiếu
  // nại về chính quyết định kiểm duyệt, nhưng nội dung thì không gửi đi nữa.
  const filter = { issueId, isDeleted: false };

  const [newestFirst, total] = await Promise.all([
    Comment.find(filter)
      .populate('userId', COMMENT_AUTHOR_FIELDS)
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum),
    Comment.countDocuments(filter),
  ]);

  return {
    // Mỗi trang hiển thị theo thứ tự hội thoại cũ → mới; page 1 vẫn là nhóm
    // mới nhất để không phải tải toàn bộ lịch sử.
    comments: [...newestFirst].reverse(),
    pagination: {
      current: pageNum,
      pages: Math.ceil(total / limitNum),
      total,
      limit: limitNum,
    },
  };
};

const addComment = async (issueId, { content, user }) => {
  if (!content || !content.trim()) {
    throw ApiError.badRequest('Vui lòng nhập nội dung bình luận.');
  }

  // Chỉ cần _id người báo cáo để gửi thông báo — không kéo email ra khỏi DB.
  const issue = await Issue.findOne({ _id: issueId, isDeleted: false }).populate('userId', 'name');
  if (!issue) throw ApiError.notFound('Không tìm thấy sự cố.');

  const comment = await Comment.create({
    issueId,
    userId: user.id,
    content: content.trim()
  });

  await comment.populate('userId', COMMENT_AUTHOR_FIELDS);

  // Notify the other party
  try {
    const io = getIO();
    // Phân biệt theo "có phải người xử lý không" thay vì theo từng role. Trước đây
    // `isAdmin = user.role === 'admin'` làm vai 'staff' rơi vào CẢ HAI nhánh sai:
    // người dân không nhận được thông báo, còn admin thì nhận thông báo ghi nguồn
    // là "từ người dân".
    const isHandler = user.role === 'admin' || user.role === 'staff';
    const reporterId = typeof issue.userId === 'object' ? issue.userId._id : issue.userId;
    const reporterIdString = reporterId ? reporterId.toString() : null;

    // Người xử lý (admin/cán bộ) bình luận → báo cho người báo cáo. Bỏ qua khi
    // chính người báo cáo tự bình luận trên phiếu của mình.
    if (isHandler && reporterIdString && reporterIdString !== user.id.toString()) {
      const notification = await Notification.create({
        userId: reporterId,
        type: 'comment',
        title: 'Bình luận mới',
        message: `${user.name || 'Admin'} đã bình luận về sự cố "${issue.title}"`,
        issueId: issue._id
      });
      io.to(`user_${reporterId}`).emit('notification:new', notification);
    }

    // Người dân bình luận → báo cho người đang xử lý (cán bộ phụ trách, hoặc cả
    // đơn vị khi chưa ai nhận) và quản trị viên. Trước đây chỉ admin nhận, nên
    // cán bộ không biết người dân vừa phản hồi trên phiếu mình đang giữ.
    if (!isHandler) {
      const recipients = new Map();
      if (issue.assigneeId) {
        const assigneeId = issue.assigneeId._id || issue.assigneeId;
        recipients.set(assigneeId.toString(), { id: assigneeId, handler: true });
      } else if (issue.departmentId) {
        const staff = await User.find({
          departmentId: issue.departmentId._id || issue.departmentId,
          role: 'staff',
          isActive: true,
        }).select('_id');
        staff.forEach((s) => recipients.set(s._id.toString(), { id: s._id, handler: true }));
      }
      const adminUsers = await User.find({ role: 'admin', isActive: true }).select('_id');
      adminUsers.forEach((a) => {
        if (!recipients.has(a._id.toString())) recipients.set(a._id.toString(), { id: a._id, handler: false });
      });

      for (const { id, handler } of recipients.values()) {
        const notification = await Notification.create({
          userId: id,
          type: 'comment',
          title: handler ? 'Người dân phản hồi phiếu bạn xử lý' : 'Bình luận mới từ người dân',
          message: `${user.name || 'Người dùng'} bình luận về "${issue.title}"`,
          issueId: issue._id
        });
        io.to(`user_${id}`).emit('notification:new', notification);
      }
    }
  } catch (socketError) {
    console.warn('Socket.io not available:', socketError.message);
  }

  return comment;
};

/**
 * Ẩn một bình luận (kiểm duyệt).
 *
 * Chỉ admin — cán bộ không được tự gỡ phản ánh về đơn vị của mình, đó là xung
 * đột lợi ích rõ ràng. Người viết cũng không tự xoá được: trên một hệ thống
 * phản ánh công khai, cho phép xoá lời của mình sau khi cán bộ đã trả lời sẽ làm
 * đứt mạch hội thoại.
 *
 * Ẩn chứ không xoá cứng — xem ghi chú ở models/Comment.js.
 */
const hideComment = async (commentId, { reason, actor }) => {
  const comment = await Comment.findById(commentId);
  if (!comment) throw ApiError.notFound('Bình luận không tồn tại');

  if (comment.isDeleted) {
    throw ApiError.badRequestWithCode('Bình luận này đã được ẩn', 'COMMENT_ALREADY_HIDDEN');
  }

  comment.isDeleted = true;
  comment.deletedAt = new Date();
  comment.deletedBy = actor.id;
  comment.deletedReason = reason?.trim() || null;
  await comment.save();

  return comment;
};

/** Hiện lại một bình luận đã ẩn nhầm. */
const restoreComment = async (commentId) => {
  const comment = await Comment.findById(commentId);
  if (!comment) throw ApiError.notFound('Bình luận không tồn tại');

  comment.isDeleted = false;
  comment.deletedAt = null;
  comment.deletedBy = null;
  comment.deletedReason = null;
  await comment.save();

  return comment;
};

module.exports = { getComments, addComment, hideComment, restoreComment };
