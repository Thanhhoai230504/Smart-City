/**
 * Đánh giá hiệu quả đơn vị xử lý theo kỳ — NGUỒN DUY NHẤT cho trọng số và ngưỡng.
 *
 * Nguyên tắc (giống điểm ưu tiên và dò trùng): đây là GỢI Ý để lãnh đạo xem xét,
 * KHÔNG phải quyết định khen thưởng hay phê bình. Mọi điểm đều kèm từng thành phần
 * và lý do, để người đọc kiểm lại được; đổi trọng số thì tăng SCORE_VERSION.
 *
 * Bốn thành phần, mỗi thành phần ở thang 0..1:
 * - onTime       tỷ lệ xử lý xong ĐÚNG HẠN trên số việc xong có hạn
 * - satisfaction điểm hài lòng của người dân, đổi từ 1–5 sao sang 0..1
 * - noComplaint  1 − tỷ lệ bị người dân MỞ LẠI = mở lại / (đã đóng + mở lại). Việc bị mở
 *                lại đang ở trạng thái mở nên KHÔNG nằm trong "đã đóng"; chia cho riêng
 *                "đã đóng" sẽ ra tỷ lệ có thể vượt 100%.
 * - noBacklog    1 − tỷ lệ việc đang mở đã QUÁ HẠN
 * Thành phần thiếu dữ liệu (vd. chưa ai đánh giá) bị bỏ và trọng số chia lại cho
 * các thành phần còn lại, thay vì coi như 0 điểm — coi là 0 sẽ phạt oan đơn vị.
 */
const SCORE_VERSION = 'dept-score-v1';

const SCORE_WEIGHTS = Object.freeze({
  onTime: 0.4,
  satisfaction: 0.25,
  noComplaint: 0.2,
  noBacklog: 0.15,
});

const COMPONENT_LABELS = Object.freeze({
  onTime: 'Xử lý đúng hạn',
  satisfaction: 'Người dân hài lòng',
  noComplaint: 'Không bị khiếu nại (mở lại)',
  noBacklog: 'Không tồn đọng quá hạn',
});

/** Ít hơn số việc đã đóng này trong kỳ thì KHÔNG xếp hạng: 1/1 việc đúng hạn không có nghĩa là 100%. */
const MIN_CLOSED_FOR_SCORE = 5;
/** Ít hơn số lượt đánh giá này thì bỏ thành phần hài lòng — vài lượt chấm không đại diện. */
const MIN_RATINGS_FOR_SATISFACTION = 3;

/** Ngưỡng gợi ý trên thang 0–100. */
const LABEL_THRESHOLDS = Object.freeze({ commend: 85, meet: 60 });

/** Cờ "cần chú ý" — dù điểm cao vẫn không đề xuất khen thưởng khi vướng các cờ này. */
const ATTENTION_RULES = Object.freeze({
  /** Tỷ lệ việc đang mở đã quá hạn. */
  overdueShare: 0.3,
  /** Chỉ xét tỷ lệ quá hạn khi có ít nhất ngần này việc đang mở. */
  minOpenForOverdueShare: 3,
});

const LABELS = Object.freeze({
  commend: 'Đề xuất khen thưởng',
  meet: 'Đạt yêu cầu',
  improve: 'Cần nhắc nhở',
  insufficient: 'Chưa đủ dữ liệu',
});

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * @param {object} m chỉ số của MỘT đơn vị trong kỳ (xem departmentPerformanceService)
 * @returns {{ score: number|null, label: keyof LABELS, labelText: string,
 *   components: Array<{key,label,weight,value,points}>, attention: string[],
 *   reasons: string[], version: string }}
 */
const computeDepartmentScore = (m) => {
  const raw = {
    onTime: m.resolvedWithDue > 0 ? clamp01(m.onTime / m.resolvedWithDue) : null,
    satisfaction: m.ratingCount >= MIN_RATINGS_FOR_SATISFACTION
      ? clamp01((m.ratingSum / m.ratingCount - 1) / 4)
      : null,
    noComplaint: m.closed + m.reopened > 0 ? clamp01(1 - m.reopened / (m.closed + m.reopened)) : null,
    noBacklog: m.openNow > 0 ? clamp01(1 - m.overdueNow / m.openNow) : 1,
  };

  const available = Object.keys(SCORE_WEIGHTS).filter((k) => raw[k] !== null);
  const weightSum = available.reduce((s, k) => s + SCORE_WEIGHTS[k], 0);
  const components = Object.keys(SCORE_WEIGHTS).map((key) => {
    const value = raw[key];
    const weight = value === null || weightSum === 0 ? 0 : SCORE_WEIGHTS[key] / weightSum;
    return {
      key,
      label: COMPONENT_LABELS[key],
      weight: Math.round(weight * 1000) / 1000,
      value: value === null ? null : Math.round(value * 1000) / 1000,
      points: value === null ? 0 : Math.round(value * weight * 1000) / 10,
    };
  });

  const attention = [];
  if (m.escalatedOpen > 0) {
    attention.push(`${m.escalatedOpen} việc đang mở đã bị leo cấp lên quản trị viên`);
  }
  if (m.openNow >= ATTENTION_RULES.minOpenForOverdueShare
    && m.overdueNow / m.openNow >= ATTENTION_RULES.overdueShare) {
    attention.push(`${m.overdueNow}/${m.openNow} việc đang mở đã quá hạn`);
  }

  const reasons = [];
  if (m.closed < MIN_CLOSED_FOR_SCORE) {
    reasons.push(`Mới đóng ${m.closed} việc trong kỳ — cần ít nhất ${MIN_CLOSED_FOR_SCORE} việc để xếp hạng`);
    return {
      score: null, label: 'insufficient', labelText: LABELS.insufficient,
      components, attention, reasons, version: SCORE_VERSION,
    };
  }
  if (raw.satisfaction === null) {
    reasons.push(`Mới có ${m.ratingCount} lượt đánh giá — chưa tính thành phần hài lòng, trọng số chia lại cho phần còn lại`);
  }
  if (raw.onTime === null) {
    reasons.push('Chưa có việc xong nào có hạn xử lý — chưa tính thành phần đúng hạn');
  }

  const score = weightSum === 0
    ? null
    : Math.round((available.reduce((s, k) => s + raw[k] * SCORE_WEIGHTS[k], 0) / weightSum) * 100);

  let label;
  if (score === null) label = 'insufficient';
  else if (score >= LABEL_THRESHOLDS.commend) label = 'commend';
  else if (score >= LABEL_THRESHOLDS.meet) label = 'meet';
  else label = 'improve';

  // Điểm cao nhưng còn việc bị leo cấp / tồn đọng quá hạn nhiều: không đề xuất khen thưởng.
  if (label === 'commend' && attention.length > 0) {
    label = 'meet';
    reasons.push('Điểm đạt mức khen thưởng nhưng còn cờ cần chú ý — hạ xuống "Đạt yêu cầu"');
  }

  return { score, label, labelText: LABELS[label], components, attention, reasons, version: SCORE_VERSION };
};

/** Cấu hình công khai, để giao diện hiển thị tiêu chí đúng như đang chạy. */
const getPublicScoreConfig = () => ({
  version: SCORE_VERSION,
  weights: SCORE_WEIGHTS,
  componentLabels: COMPONENT_LABELS,
  minClosedForScore: MIN_CLOSED_FOR_SCORE,
  minRatingsForSatisfaction: MIN_RATINGS_FOR_SATISFACTION,
  thresholds: LABEL_THRESHOLDS,
  attention: ATTENTION_RULES,
  labels: LABELS,
});

module.exports = {
  SCORE_VERSION,
  SCORE_WEIGHTS,
  MIN_CLOSED_FOR_SCORE,
  MIN_RATINGS_FOR_SATISFACTION,
  LABEL_THRESHOLDS,
  ATTENTION_RULES,
  LABELS,
  computeDepartmentScore,
  getPublicScoreConfig,
};
