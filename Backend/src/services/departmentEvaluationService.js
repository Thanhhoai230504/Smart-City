const mongoose = require('mongoose');
const DepartmentEvaluation = require('../models/DepartmentEvaluation');
const Department = require('../models/Department');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ApiError = require('../utils/apiError');
const { getIO } = require('../config/socket');
const { resolvePeriod, getDepartmentPerformanceDetail } = require('./departmentPerformanceService');
const {
  DECISION_LABELS,
  isDeviation,
  deviationMessage,
  formatPeriodVN,
} = require('../utils/departmentEvaluationConfig');

/**
 * Lưu quyết định khen thưởng / phê bình của lãnh đạo cho đơn vị.
 *
 * Hệ thống gợi ý (departmentPerformanceService), con người quyết, và quyết định được
 * ghi lại kèm ảnh chụp số liệu lúc quyết. Không sửa, không xoá — chỉ huỷ có lý do.
 */

/** Lệch đồng hồ cho phép giữa trình duyệt và máy chủ khi kỳ kết thúc ở "bây giờ". */
const CLOCK_SKEW_MS = 60 * 1000;
const EXCERPT_LENGTH = 160;

const NOTIFY_TITLES = Object.freeze({
  commend: '🏆 Đơn vị được khen thưởng',
  acknowledge: '👍 Đơn vị được ghi nhận',
  remind: '⚠️ Đơn vị bị nhắc nhở',
  criticize: '❗ Đơn vị bị phê bình',
});

const excerpt = (text) => (text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH - 1)}…` : text);

/**
 * Báo cho cán bộ của đơn vị trong ứng dụng. KHÔNG gửi email: hộp thư đơn vị có thể là
 * địa chỉ cơ quan thật. Lỗi thông báo không được làm hỏng quyết định đã ghi.
 */
const notifyDepartmentStaff = async (departmentId, { title, message }) => {
  try {
    const staff = await User.find({ departmentId, role: 'staff', isActive: true }).select('_id');
    for (const s of staff) {
      const notification = await Notification.create({
        userId: s._id, type: 'department_evaluated', title, message, issueId: null,
      });
      getIO().to(`user_${s._id}`).emit('notification:new', notification);
    }
  } catch (err) {
    console.warn('Evaluation notification error:', err.message);
  }
};

/** Ảnh chụp số liệu — chỉ giữ thứ cần để đọc lại quyết định, không phình dung lượng. */
const buildSnapshot = (detail, now) => ({
  capturedAt: now,
  department: { name: detail.department.name, code: detail.department.code },
  score: detail.score,
  metrics: detail.metrics,
  config: {
    version: detail.config.version,
    weights: detail.config.weights,
    thresholds: detail.config.thresholds,
    minClosedForScore: detail.config.minClosedForScore,
  },
  // Số liệu cán bộ cố ý không chụp: hệ thống không đánh giá cá nhân.
  evidence: Object.fromEntries(Object.entries(detail.evidence || {}).map(([group, list]) => [
    group,
    list.map((i) => ({ _id: i._id, title: i.title, status: i.status })),
  ])),
});

const createEvaluation = async (departmentId, input, actor, now = new Date()) => {
  if (!mongoose.isValidObjectId(departmentId)) throw ApiError.badRequest('Mã đơn vị không hợp lệ');
  const department = await Department.findById(departmentId).lean();
  if (!department) throw ApiError.notFound('Đơn vị không tồn tại');

  const period = resolvePeriod({ from: input.from, to: input.to }, now);
  if (period.to.getTime() > now.getTime() + CLOCK_SKEW_MS) {
    throw ApiError.badRequest('Kỳ đánh giá phải kết thúc trước thời điểm ghi quyết định');
  }

  // Đổi quyết định = huỷ bản cũ rồi ghi bản mới, để lịch sử không bị ghi đè.
  const existing = await DepartmentEvaluation.exists({
    departmentId: department._id, 'period.from': period.from, 'period.to': period.to, status: 'active',
  });
  if (existing) {
    throw ApiError.conflictWithCode(
      'Đơn vị đã có quyết định còn hiệu lực cho đúng kỳ này. Huỷ quyết định cũ (kèm lý do) trước khi ghi quyết định mới.',
      'EVALUATION_EXISTS',
    );
  }

  // Số liệu do server tính lại — không tin con số trình duyệt gửi lên.
  const detail = await getDepartmentPerformanceDetail(
    String(department._id),
    { from: period.from.toISOString(), to: period.to.toISOString() },
    now,
  );
  const suggestion = { label: detail.score.label, labelText: detail.score.labelText, score: detail.score.score };
  const deviates = isDeviation(input.decision, suggestion.label);
  const reason = input.deviationReason?.trim() || null;
  if (deviates && !reason) {
    throw ApiError.badRequestWithCode(deviationMessage(input.decision, suggestion), 'DEVIATION_REASON_REQUIRED');
  }

  const evaluation = await DepartmentEvaluation.create({
    departmentId: department._id,
    period,
    decision: input.decision,
    content: input.content.trim(),
    documentNumber: input.documentNumber?.trim() || null,
    suggestion,
    deviatesFromSuggestion: deviates,
    deviationReason: deviates ? reason : null,
    snapshot: buildSnapshot(detail, now),
    decidedBy: actor.id,
  });

  await notifyDepartmentStaff(department._id, {
    title: NOTIFY_TITLES[input.decision],
    message: `Kỳ ${formatPeriodVN(period)}: ${excerpt(input.content.trim())}`,
  });

  return { evaluation, department, period };
};

/** Quản trị viên xem mọi đơn vị; cán bộ chỉ xem quyết định về đơn vị của mình. */
const listEvaluations = async (departmentId, user, { limit = 50 } = {}) => {
  if (user.role === 'staff' && String(user.departmentId) !== String(departmentId)) {
    throw ApiError.forbidden('Bạn chỉ xem được quyết định đánh giá của đơn vị mình');
  }
  return DepartmentEvaluation.find({ departmentId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('decidedBy', 'name')
    .populate('revokedBy', 'name')
    .lean();
};

const revokeEvaluation = async (departmentId, evaluationId, { reason }, actor, now = new Date()) => {
  const evaluation = await DepartmentEvaluation.findById(evaluationId);
  if (!evaluation || String(evaluation.departmentId) !== String(departmentId)) {
    throw ApiError.notFound('Không tìm thấy quyết định đánh giá');
  }
  if (evaluation.status === 'revoked') {
    throw ApiError.badRequestWithCode('Quyết định này đã được huỷ trước đó', 'EVALUATION_REVOKED');
  }

  evaluation.status = 'revoked';
  evaluation.revokedAt = now;
  evaluation.revokedBy = actor.id;
  evaluation.revokeReason = reason.trim();
  await evaluation.save();

  await notifyDepartmentStaff(evaluation.departmentId, {
    title: '↩️ Quyết định đánh giá đã được huỷ',
    message: `Quyết định "${DECISION_LABELS[evaluation.decision]}" kỳ ${formatPeriodVN(evaluation.period)} đã được huỷ. Lý do: ${excerpt(reason.trim())}`,
  });
  return { evaluation };
};

module.exports = {
  createEvaluation,
  listEvaluations,
  revokeEvaluation,
};
