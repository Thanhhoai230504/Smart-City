const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  issueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Issue',
    required: [true, 'Issue ID is required'],
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    trim: true,
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  // ─── Kiểm duyệt (G16) ───
  // Trước đây model KHÔNG có field này, và routes/comments.js chỉ có GET + POST —
  // nghĩa là một bình luận xúc phạm hay lộ thông tin cá nhân KHÔNG thể gỡ bằng
  // bất kỳ cách nào ngoài sửa trực tiếp database. Hệ thống công khai cho người
  // dân bình luận mà không có đường gỡ nội dung là rủi ro thật.
  //
  // Ẩn chứ không xoá cứng: giữ nội dung gốc để truy vết nếu có khiếu nại về
  // chính quyết định kiểm duyệt — cùng tinh thần soft delete của Issue.
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  /** Lý do ẩn, để người bị ẩn và người kiểm duyệt sau còn hiểu quyết định. */
  deletedReason: {
    type: String,
    trim: true,
    maxlength: [300, 'Lý do không quá 300 ký tự'],
    default: null
  }
}, {
  timestamps: true
});

// Prefix isDeleted để truy vấn danh sách lọc được bình luận đã ẩn mà vẫn dùng index.
commentSchema.index({ issueId: 1, isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
