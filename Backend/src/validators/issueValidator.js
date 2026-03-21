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
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180')
];

const updateIssueStatusValidator = [
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['reported', 'processing', 'resolved', 'rejected'])
    .withMessage('Invalid status')
];

module.exports = { createIssueValidator, updateIssueStatusValidator };
