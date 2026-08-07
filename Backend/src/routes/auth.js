const express = require('express');
const passport = require('passport');
const validate = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { authStrictLimiter } = require('../middleware/rateLimiters');
const {
  registerValidator,
  loginValidator,
  verifyEmailValidator,
  resendVerificationValidator
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

// @route   POST /api/auth/login
// Strict limiter chống brute-force mật khẩu
router.post('/login', authStrictLimiter, loginValidator, validate, login);

// @route   POST /api/auth/refresh
router.post('/refresh', refresh);

// @route   PATCH /api/auth/change-password
// Strict limiter chống dò mật khẩu hiện tại
router.patch('/change-password', authStrictLimiter, authMiddleware, changePassword);

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
