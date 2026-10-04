/**
 * Quyết định khen thưởng / phê bình đơn vị — NGUỒN DUY NHẤT cho các loại quyết định
 * và luật "quyết định có khác gợi ý không".
 *
 * Nguyên tắc: hệ thống chỉ GỢI Ý (utils/departmentScoreConfig.js), lãnh đạo QUYẾT.
 * Quyết định khác gợi ý vẫn được ghi, nhưng bắt buộc nêu lý do — để sau này đọc lại
 * còn biết vì sao người quyết không theo số liệu.
 */

const DECISIONS = ['commend', 'acknowledge', 'remind', 'criticize'];

const DECISION_LABELS = Object.freeze({
  commend: 'Khen thưởng',
  acknowledge: 'Ghi nhận',
  remind: 'Nhắc nhở',
  criticize: 'Phê bình',
});

/**
 * Gợi ý của hệ thống ứng với quyết định nào. Hệ thống KHÔNG BAO GIỜ gợi ý phê bình
 * (mức thấp nhất là "Cần nhắc nhở"), và "Chưa đủ dữ liệu" thì không gợi ý gì —
 * nên hai trường hợp đó luôn phải nêu căn cứ.
 */
const EXPECTED_DECISION = Object.freeze({
  commend: 'commend',
  meet: 'acknowledge',
  improve: 'remind',
  insufficient: null,
});

const LIMITS = Object.freeze({
  contentMin: 10,
  contentMax: 2000,
  reasonMin: 10,
  reasonMax: 1000,
  documentMax: 100,
  revokeMin: 10,
  revokeMax: 500,
});

const isDeviation = (decision, suggestionLabel) => EXPECTED_DECISION[suggestionLabel] !== decision;

/** Câu giải thích vì sao cần lý do — dùng cho lỗi trả về client. */
const deviationMessage = (decision, suggestion) => (
  suggestion.label === 'insufficient'
    ? `Kỳ này hệ thống chưa đủ dữ liệu để gợi ý — cần nêu căn cứ của quyết định "${DECISION_LABELS[decision]}".`
    : `Hệ thống gợi ý "${suggestion.labelText}" nhưng quyết định là "${DECISION_LABELS[decision]}" — cần nêu lý do.`
);

const vnDay = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
});

/** "01/09/2026 – 30/09/2026" theo giờ Việt Nam, không phụ thuộc múi giờ máy chủ. */
const formatPeriodVN = ({ from, to }) => `${vnDay.format(new Date(from))} – ${vnDay.format(new Date(to))}`;

module.exports = {
  DECISIONS,
  DECISION_LABELS,
  EXPECTED_DECISION,
  LIMITS,
  isDeviation,
  deviationMessage,
  formatPeriodVN,
};
