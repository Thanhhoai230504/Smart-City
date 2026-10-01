const { body } = require('express-validator');
const { MIN_REASON_LENGTH, MAX_REASON_LENGTH } = require('../utils/reopenConfig');

const createIssueValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required'),
  body('category')
    .notEmpty().withMessage('Category is required')
    .isIn(['pothole', 'garbage', 'streetlight', 'flooding', 'tree', 'other'])
    .withMessage('Invalid category'),
  body('location')
    .trim()
    .notEmpty().withMessage('Location is required'),
  body('latitude')
    .notEmpty().withMessage('Latitude is required')
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .notEmpty().withMessage('Longitude is required')
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^(0|\+84)[0-9]{9,10}$/).withMessage('Số điện thoại không hợp lệ')
];

const updateIssueStatusValidator = [
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['reported', 'processing', 'resolved', 'rejected'])
    .withMessage('Invalid status'),
  // Giới hạn này trước đây chỉ tồn tại ở client nên bỏ qua được khi gọi API thẳng.
  // Con số khớp maxlength trong models/Issue.js (statusHistory.note).
  body('note')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 }).withMessage('Ghi chú không quá 500 ký tự')
];

const duplicateCandidateValidator = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 }).withMessage('Tiêu đề phải từ 3 đến 200 ký tự'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 }).withMessage('Mô tả phải từ 10 đến 2000 ký tự'),
  body('category')
    .isIn(['pothole', 'garbage', 'streetlight', 'flooding', 'tree', 'other'])
    .withMessage('Loại sự cố không hợp lệ'),
  body('latitude')
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude không hợp lệ')
    .toFloat(),
  body('longitude')
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude không hợp lệ')
    .toFloat(),
  body('issueId')
    .optional({ values: 'falsy' })
    .isMongoId().withMessage('issueId không hợp lệ'),
];

// Bắt buộc nêu lý do khi mở lại: không có lý do thì đơn vị nhận lại việc mà
// không biết phải làm gì khác lần trước. Độ dài khớp utils/reopenConfig.js.
const reopenIssueValidator = [
  body('reason')
    .trim()
    .isLength({ min: MIN_REASON_LENGTH, max: MAX_REASON_LENGTH })
    .withMessage(`Lý do phải từ ${MIN_REASON_LENGTH} đến ${MAX_REASON_LENGTH} ký tự`),
];

module.exports = {
  createIssueValidator,
  updateIssueStatusValidator,
  duplicateCandidateValidator,
  reopenIssueValidator,
};
