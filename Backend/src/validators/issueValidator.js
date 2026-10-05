const { body } = require('express-validator');
const { MIN_REASON_LENGTH, MAX_REASON_LENGTH } = require('../utils/reopenConfig');

const createIssueValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập tiêu đề')
    .isLength({ max: 200 }).withMessage('Tiêu đề không quá 200 ký tự'),
  body('description')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập mô tả'),
  body('category')
    .notEmpty().withMessage('Vui lòng chọn loại sự cố')
    .isIn(['pothole', 'garbage', 'streetlight', 'flooding', 'tree', 'other'])
    .withMessage('Loại sự cố không hợp lệ'),
  body('location')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập địa chỉ'),
  body('latitude')
    .notEmpty().withMessage('Thiếu vĩ độ của vị trí')
    .isFloat({ min: -90, max: 90 }).withMessage('Vĩ độ phải nằm trong khoảng -90 đến 90'),
  body('longitude')
    .notEmpty().withMessage('Thiếu kinh độ của vị trí')
    .isFloat({ min: -180, max: 180 }).withMessage('Kinh độ phải nằm trong khoảng -180 đến 180'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^(0|\+84)[0-9]{9,10}$/).withMessage('Số điện thoại không hợp lệ')
];

const updateIssueStatusValidator = [
  body('status')
    .notEmpty().withMessage('Vui lòng chọn trạng thái')
    .isIn(['reported', 'processing', 'resolved', 'rejected'])
    .withMessage('Trạng thái không hợp lệ'),
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

// Trước đây route đánh giá không có validator: thiếu `score` vẫn lưu được một bản
// đánh giá rỗng và gửi thông báo "chấm undefined/5 sao"; `3.7` lọt qua min/max của
// model và làm lệch điểm trung bình công khai. Độ dài nhận xét khớp model (500).
const rateIssueValidator = [
  body('score')
    .exists({ values: 'null' }).withMessage('Vui lòng chọn số sao')
    .bail()
    .isInt({ min: 1, max: 5 }).withMessage('Điểm đánh giá phải là số nguyên từ 1 đến 5')
    .toInt(),
  body('comment')
    .optional({ values: 'null' })
    .isString().withMessage('Nhận xét không hợp lệ')
    .bail()
    .trim()
    .isLength({ max: 500 }).withMessage('Nhận xét không quá 500 ký tự'),
];

module.exports = {
  createIssueValidator,
  updateIssueStatusValidator,
  duplicateCandidateValidator,
  reopenIssueValidator,
  rateIssueValidator,
};
