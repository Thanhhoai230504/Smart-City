const express = require('express');
const passport = require('passport');
const validate = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { authStrictLimiter } = require('../middleware/rateLimiters');
const {
  registerValidator,
  loginValidator,
  verifyEmailValidator,
  resendVerificationValidator,
  forgotPasswordValidator,
  resetPasswordValidator
} = require('../validators/authValidator');
const {
  register,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  deleteAccount,
  googleCallback
} = require('../controllers/authController');

const router = express.Router();

// @route   POST /api/auth/register
// Strict limiter chống tạo tài khoản rác hàng loạt
router.post('/register', authStrictLimiter, registerValidator, validate, register);

// @route   GET /api/auth/verify-email
router.get('/verify-email', authStrictLimiter, verifyEmailValidator, validate, verifyEmail);

// @route   POST /api/auth/resend-verification
router.post(
  '/resend-verification',
  authStrictLimiter,
  resendVerificationValidator,
  validate,
  resendVerification
);

// Hai route dưới đây là đường chiếm tài khoản nếu bị lạm dụng, nên dùng chung
// authStrictLimiter với login/register. Người dùng mất tài khoản vĩnh viễn nếu
// quên mật khẩu mà không có luồng này — trên mobile càng dễ xảy ra.
// @route   POST /api/auth/forgot-password
router.post('/forgot-password', authStrictLimiter, forgotPasswordValidator, validate, forgotPassword);

// @route   POST /api/auth/reset-password
router.post('/reset-password', authStrictLimiter, resetPasswordValidator, validate, resetPassword);

// @route   POST /api/auth/login
// Strict limiter chống brute-force mật khẩu
router.post('/login', authStrictLimiter, loginValidator, validate, login);

// @route   POST /api/auth/refresh
router.post('/refresh', refresh);

// @route   PATCH /api/auth/change-password
// Strict limiter chống dò mật khẩu hiện tại
router.patch('/change-password', authStrictLimiter, authMiddleware, changePassword);

// Xoá tài khoản: ẩn danh hoá chứ không xoá cứng, để thống kê và lịch sử xử lý
// không bị lệch. Dùng authStrictLimiter vì cần mật khẩu — tránh thành đường dò.
// @route   DELETE /api/auth/account
router.delete('/account', authStrictLimiter, authMiddleware, deleteAccount);

// @route   POST /api/auth/logout
router.post('/logout', authMiddleware, logout);

// @route   GET /api/auth/profile
router.get('/profile', authMiddleware, getProfile);

// @route   PATCH /api/auth/profile
router.patch('/profile', authMiddleware, updateProfile);

// ============ GOOGLE OAUTH ============

// @route   GET /api/auth/google
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
}));

// @route   GET /api/auth/google/callback
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  googleCallback
);

module.exports = router;
