const { body } = require('express-validator');

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
    .withMessage('Invalid status')
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

module.exports = { createIssueValidator, updateIssueStatusValidator, duplicateCandidateValidator };
