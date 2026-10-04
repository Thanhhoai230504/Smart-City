const { body, query, param } = require('express-validator');
const { ISSUE_CATEGORIES } = require('../utils/slaConfig');
const { DECISIONS, LIMITS } = require('../utils/departmentEvaluationConfig');

const createDepartmentValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Tên đơn vị là bắt buộc')
    .isLength({ max: 150 }).withMessage('Tên đơn vị không quá 150 ký tự'),
  body('code')
    .trim()
    .notEmpty().withMessage('Mã đơn vị là bắt buộc')
    .isLength({ max: 20 }).withMessage('Mã đơn vị không quá 20 ký tự')
    .matches(/^[A-Za-z0-9_-]+$/).withMessage('Mã đơn vị chỉ gồm chữ, số, gạch ngang và gạch dưới'),
  body('description')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 }).withMessage('Mô tả không quá 500 ký tự'),
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail().withMessage('Email không hợp lệ'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^(0|\+84)[0-9]{8,10}$/).withMessage('Số điện thoại không hợp lệ'),
  body('categories')
    .optional()
    .isArray().withMessage('categories phải là mảng')
    .custom((arr) => arr.every((c) => ISSUE_CATEGORIES.includes(c)))
    .withMessage(`Loại sự cố phải thuộc: ${ISSUE_CATEGORIES.join(', ')}`),
  body('slaHours')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 720 }).withMessage('SLA phải từ 1 đến 720 giờ'),
];

// Update dùng lại cùng luật nhưng mọi field đều không bắt buộc, vì admin có
// thể chỉ sửa một ô (ví dụ đổi SLA) mà không gửi lại toàn bộ form.
const updateDepartmentValidator = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Tên đơn vị không được để trống')
    .isLength({ max: 150 }).withMessage('Tên đơn vị không quá 150 ký tự'),
  body('code')
    .optional()
    .trim()
    .notEmpty().withMessage('Mã đơn vị không được để trống')
    .isLength({ max: 20 }).withMessage('Mã đơn vị không quá 20 ký tự')
    .matches(/^[A-Za-z0-9_-]+$/).withMessage('Mã đơn vị chỉ gồm chữ, số, gạch ngang và gạch dưới'),
  body('description')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 }).withMessage('Mô tả không quá 500 ký tự'),
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail().withMessage('Email không hợp lệ'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^(0|\+84)[0-9]{8,10}$/).withMessage('Số điện thoại không hợp lệ'),
  body('categories')
    .optional()
    .isArray().withMessage('categories phải là mảng')
    .custom((arr) => arr.every((c) => ISSUE_CATEGORIES.includes(c)))
    .withMessage(`Loại sự cố phải thuộc: ${ISSUE_CATEGORIES.join(', ')}`),
  body('slaHours')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 720 }).withMessage('SLA phải từ 1 đến 720 giờ'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive phải là true/false'),
];

const assignStaffValidator = [
  // null = bỏ gán, đưa cán bộ về role 'user'
  body('departmentId')
    .exists().withMessage('departmentId là bắt buộc (null để bỏ gán)')
    .custom((v) => v === null || /^[a-f\d]{24}$/i.test(v))
    .withMessage('departmentId không hợp lệ'),
];

const assignIssueValidator = [
  body('departmentId')
    .notEmpty().withMessage('Phải chọn đơn vị xử lý')
    .isMongoId().withMessage('departmentId không hợp lệ'),
  body('assigneeId')
    .optional({ values: 'falsy' })
    .isMongoId().withMessage('assigneeId không hợp lệ'),
  body('note')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 }).withMessage('Ghi chú không quá 500 ký tự'),
];

// Route thu hồi phân công trước đây không gắn validator nào, nên trường note đi
// thẳng vào statusHistory không kiểm tra độ dài. Cùng luật với assignIssueValidator.
const unassignIssueValidator = [
  body('note')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 }).withMessage('Ghi chú không quá 500 ký tự'),
];

// Kỳ đánh giá: hai mốc ISO 8601, cả hai tuỳ chọn (mặc định 30 ngày gần nhất). Độ dài
// tối đa và thứ tự trước/sau kiểm ở service để thông báo lỗi rõ hơn.
const performanceQueryValidator = [
  query('from').optional().isISO8601().withMessage('Ngày bắt đầu không hợp lệ'),
  query('to').optional().isISO8601().withMessage('Ngày kết thúc không hợp lệ'),
  param('id').optional().isMongoId().withMessage('Mã đơn vị không hợp lệ'),
];

// Quyết định khen thưởng / phê bình. Kỳ bắt buộc ghi rõ (không mặc định 30 ngày như khi
// xem), vì quyết định phải gắn với một kỳ cụ thể. Lý do khác gợi ý kiểm ở service — chỉ
// service biết gợi ý của hệ thống là gì.
const createEvaluationValidator = [
  param('id').isMongoId().withMessage('Mã đơn vị không hợp lệ'),
  body('from').exists({ values: 'falsy' }).withMessage('Thiếu ngày bắt đầu kỳ đánh giá')
    .bail().isISO8601().withMessage('Ngày bắt đầu không hợp lệ'),
  body('to').exists({ values: 'falsy' }).withMessage('Thiếu ngày kết thúc kỳ đánh giá')
    .bail().isISO8601().withMessage('Ngày kết thúc không hợp lệ'),
  body('decision').isIn(DECISIONS).withMessage('Loại quyết định không hợp lệ'),
  body('content')
    .isString().withMessage('Nội dung quyết định là bắt buộc')
    .bail().trim()
    .isLength({ min: LIMITS.contentMin, max: LIMITS.contentMax })
    .withMessage(`Nội dung quyết định từ ${LIMITS.contentMin} đến ${LIMITS.contentMax} ký tự`),
  body('documentNumber')
    .optional({ values: 'falsy' })
    .isString().bail().trim()
    .isLength({ max: LIMITS.documentMax }).withMessage(`Số văn bản không quá ${LIMITS.documentMax} ký tự`),
  body('deviationReason')
    .optional({ values: 'falsy' })
    .isString().bail().trim()
    .isLength({ min: LIMITS.reasonMin, max: LIMITS.reasonMax })
    .withMessage(`Lý do từ ${LIMITS.reasonMin} đến ${LIMITS.reasonMax} ký tự`),
];

const revokeEvaluationValidator = [
  param('id').isMongoId().withMessage('Mã đơn vị không hợp lệ'),
  param('evaluationId').isMongoId().withMessage('Mã quyết định không hợp lệ'),
  body('reason')
    .isString().withMessage('Cần nêu lý do huỷ quyết định')
    .bail().trim()
    .isLength({ min: LIMITS.revokeMin, max: LIMITS.revokeMax })
    .withMessage(`Lý do huỷ từ ${LIMITS.revokeMin} đến ${LIMITS.revokeMax} ký tự`),
];

const evaluationListValidator = [
  param('id').isMongoId().withMessage('Mã đơn vị không hợp lệ'),
];

module.exports = {
  createEvaluationValidator,
  revokeEvaluationValidator,
  evaluationListValidator,
  performanceQueryValidator,
  createDepartmentValidator,
  updateDepartmentValidator,
  assignStaffValidator,
  assignIssueValidator,
  unassignIssueValidator,
};
