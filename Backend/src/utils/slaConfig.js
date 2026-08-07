/**
 * Cấu hình SLA (Service Level Agreement) — hạn xử lý cho từng loại sự cố.
 *
 * Số giờ tính từ lúc sự cố được PHÂN CÔNG cho đơn vị, không phải từ lúc
 * người dân báo cáo: đơn vị chỉ chịu trách nhiệm sau khi nhận việc.
 *
 * Đơn vị (Department) có thể ghi đè bằng field `slaHours` của riêng mình.
 */
const DEFAULT_SLA_HOURS = {
  flooding: 12,     // Ngập nước — ảnh hưởng giao thông ngay, ưu tiên cao nhất
  tree: 12,         // Cây đổ — nguy hiểm trực tiếp
  garbage: 24,      // Rác thải
  streetlight: 48,  // Đèn đường hỏng
  pothole: 72,      // Ổ gà — cần vật liệu, thi công
  other: 72,
};

const FALLBACK_SLA_HOURS = 72;

/** Danh sách loại sự cố — khớp với enum của model Issue */
const ISSUE_CATEGORIES = ['pothole', 'garbage', 'streetlight', 'flooding', 'tree', 'other'];

/**
 * Mức leo cấp khi quá hạn:
 *   1 = nhắc đơn vị xử lý
 *   2 = báo lên admin (quá hạn gấp đôi thời gian SLA)
 */
const ESCALATION_LEVELS = { REMINDED: 1, ESCALATED: 2 };

/**
 * Số giờ SLA áp dụng cho một sự cố.
 * @param {string} category - Loại sự cố
 * @param {number|null} departmentOverride - `slaHours` của đơn vị, nếu có
 * @returns {number} Số giờ
 */
const getSlaHours = (category, departmentOverride = null) => {
  if (typeof departmentOverride === 'number' && departmentOverride > 0) {
    return departmentOverride;
  }
  return DEFAULT_SLA_HOURS[category] || FALLBACK_SLA_HOURS;
};

/**
 * Tính thời hạn phải xử lý xong.
 * @param {string} category
 * @param {number|null} departmentOverride
 * @param {Date} from - Mốc bắt đầu (mặc định: hiện tại)
 * @returns {Date}
 */
const calculateDueAt = (category, departmentOverride = null, from = new Date()) => {
  const hours = getSlaHours(category, departmentOverride);
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
};

/**
 * Trạng thái SLA của một sự cố, dùng để hiển thị badge trên UI.
 * @returns {'none'|'on_time'|'due_soon'|'overdue'|'met'|'breached'}
 */
const getSlaStatus = (issue, now = new Date()) => {
  if (!issue?.dueAt) return 'none';
  const due = new Date(issue.dueAt);

  // Đã đóng: chỉ còn quan tâm đúng hạn hay trễ hạn
  if (issue.status === 'resolved' || issue.status === 'rejected') {
    const closedAt = issue.resolvedAt ? new Date(issue.resolvedAt) : now;
    return closedAt <= due ? 'met' : 'breached';
  }

  if (now > due) return 'overdue';
  // Còn dưới 25% thời gian là sắp đến hạn
  const hoursLeft = (due - now) / (60 * 60 * 1000);
  const totalHours = getSlaHours(issue.category);
  return hoursLeft <= totalHours * 0.25 ? 'due_soon' : 'on_time';
};

module.exports = {
  DEFAULT_SLA_HOURS,
  FALLBACK_SLA_HOURS,
  ISSUE_CATEGORIES,
  ESCALATION_LEVELS,
  getSlaHours,
  calculateDueAt,
  getSlaStatus,
};
