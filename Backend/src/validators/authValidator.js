const { body, query } = require('express-validator');

const registerValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const loginValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email'),
  body('password')
    .notEmpty().withMessage('Password is required')
];

const verifyEmailValidator = [
  query('token')
    .notEmpty().withMessage('Verification token is required')
    .isLength({ min: 64, max: 64 }).withMessage('Verification token is invalid')
    .isHexadecimal().withMessage('Verification token is invalid'),
];

const resendVerificationValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
];

module.exports = {
  registerValidator,
  loginValidator,
  verifyEmailValidator,
  resendVerificationValidator
};
