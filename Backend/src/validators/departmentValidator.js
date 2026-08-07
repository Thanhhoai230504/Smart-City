const { body } = require('express-validator');
const { ISSUE_CATEGORIES } = require('../utils/slaConfig');

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

module.exports = {
  createDepartmentValidator,
  updateDepartmentValidator,
  assignStaffValidator,
  assignIssueValidator,
};
