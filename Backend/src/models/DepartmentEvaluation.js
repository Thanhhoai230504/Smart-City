const mongoose = require('mongoose');
const { DECISIONS, LIMITS } = require('../utils/departmentEvaluationConfig');

/**
 * Quyết định khen thưởng / phê bình của lãnh đạo cho một đơn vị trong một kỳ.
 *
 * Bản ghi KHÔNG sửa, KHÔNG xoá: đổi quyết định thì huỷ bản cũ (kèm lý do) rồi ghi bản
 * mới — giống nhật ký hoạt động, để lịch sử không bị viết lại.
 *
 * `snapshot` chụp lại điểm và số liệu ĐÚNG LÚC QUYẾT, do server tự tính. Số liệu sống
 * của một kỳ cũ vẫn có thể đổi về sau (người dân đánh giá muộn, mở lại phiếu trong 30
 * ngày), nên không có ảnh chụp thì không giải thích được vì sao hồi đó quyết như vậy.
 */
const departmentEvaluationSchema = new mongoose.Schema({
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
    index: true,
  },
  period: {
    from: { type: Date, required: true },
    to: { type: Date, required: true },
  },
  decision: {
    type: String,
    enum: DECISIONS,
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    minlength: LIMITS.contentMin,
    maxlength: LIMITS.contentMax,
  },
  // Số văn bản / quyết định chính thức nếu có — bản ghi này không thay văn bản đó.
  documentNumber: {
    type: String,
    trim: true,
    maxlength: LIMITS.documentMax,
    default: null,
  },
  // Gợi ý của hệ thống tại thời điểm quyết.
  suggestion: {
    label: { type: String, enum: ['commend', 'meet', 'improve', 'insufficient'], required: true },
    labelText: { type: String, default: null },
    score: { type: Number, default: null },
  },
  deviatesFromSuggestion: {
    type: Boolean,
    required: true,
  },
  deviationReason: {
    type: String,
    trim: true,
    maxlength: LIMITS.reasonMax,
    default: null,
  },
  snapshot: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  decidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'revoked'],
    default: 'active',
  },
  revokedAt: { type: Date, default: null },
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  revokeReason: {
    type: String,
    trim: true,
    maxlength: LIMITS.revokeMax,
    default: null,
  },
}, {
  timestamps: true,
});

departmentEvaluationSchema.index({ departmentId: 1, createdAt: -1 });
// Bảng xếp hạng tra quyết định còn hiệu lực đúng kỳ đang xem.
departmentEvaluationSchema.index({ status: 1, 'period.from': 1, 'period.to': 1 });

module.exports = mongoose.model('DepartmentEvaluation', departmentEvaluationSchema);
