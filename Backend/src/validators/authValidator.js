const { body, query } = require('express-validator');
const { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } = require('../utils/passwordPolicy');

const registerValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập họ tên')
    .isLength({ max: 100 }).withMessage('Họ tên không quá 100 ký tự'),
  body('email')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập email')
    .isEmail().withMessage('Email không hợp lệ'),
  // Kiểm tra độ dài ở đây để trả lỗi theo field; service còn kiểm tra thêm mật
  // khẩu phổ biến và ký tự lặp (utils/passwordPolicy.js) — ràng buộc thật nằm ở
  // service để mọi đường đặt mật khẩu đều đi qua cùng một luật.
  body('password')
    .notEmpty().withMessage('Vui lòng nhập mật khẩu')
    .isLength({ min: MIN_PASSWORD_LENGTH, max: MAX_PASSWORD_LENGTH })
    .withMessage(`Mật khẩu phải có từ ${MIN_PASSWORD_LENGTH} đến ${MAX_PASSWORD_LENGTH} ký tự`)
];

// Thiết bị do client khai, chỉ để người dùng nhận ra phiên nào là của mình và để
// quyết định trả refresh token qua cookie hay body. Giá trị lạ rơi về 'web' ở
// sessionService nên không cần chặn cứng — nhưng vẫn giới hạn để không nhận rác.
const deviceValidators = [
  body('deviceType')
    .optional({ values: 'falsy' })
    .isIn(['web', 'android', 'ios']).withMessage('deviceType không hợp lệ'),
  body('deviceName')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 120 }).withMessage('Tên thiết bị không quá 120 ký tự'),
];

const loginValidator = [
  ...deviceValidators,
  body('email')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập email')
    .isEmail().withMessage('Email không hợp lệ'),
  body('password')
    .notEmpty().withMessage('Vui lòng nhập mật khẩu')
];

// ID token Google là JWT cỡ 1–2 KB; chặn chuỗi bất thường trước khi tới bước
// xác minh (bước đó gọi ra Google lấy khoá công khai).
const googleIdTokenValidator = [
  ...deviceValidators,
  body('idToken')
    .isString().withMessage('Thiếu ID token của Google')
    .bail()
    .trim()
    .notEmpty().withMessage('Thiếu ID token của Google')
    .isLength({ max: 4096 }).withMessage('ID token của Google không hợp lệ'),
];

const verifyEmailValidator = [
  query('token')
    .notEmpty().withMessage('Thiếu mã xác thực email')
    .isLength({ min: 64, max: 64 }).withMessage('Mã xác thực email không hợp lệ')
    .isHexadecimal().withMessage('Mã xác thực email không hợp lệ'),
];

const resendVerificationValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập email')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
];

const forgotPasswordValidator = [
  body('email')
    .trim()
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
];

const resetPasswordValidator = [
  body('token')
    .trim()
    .notEmpty().withMessage('Thiếu mã đặt lại mật khẩu'),
  // Cùng độ dài tối thiểu với đăng ký và đổi mật khẩu — đặt lại không được là
  // đường vòng để tạo mật khẩu yếu hơn.
  body('password')
    .isLength({ min: MIN_PASSWORD_LENGTH, max: MAX_PASSWORD_LENGTH })
    .withMessage(`Mật khẩu phải có từ ${MIN_PASSWORD_LENGTH} đến ${MAX_PASSWORD_LENGTH} ký tự`),
];

module.exports = {
  forgotPasswordValidator,
  resetPasswordValidator,
  registerValidator,
  loginValidator,
  googleIdTokenValidator,
  verifyEmailValidator,
  resendVerificationValidator
};
