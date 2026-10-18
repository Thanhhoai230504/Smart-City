const express = require('express');
const { passport, isGoogleWebLoginEnabled } = require('../config/passport');
const validate = require('../middleware/validate');
const {
  OAUTH_STATE_MAX_AGE,
  oauthStateCookieName,
  oauthStateCookieOptions,
  createOAuthState,
  isMatchingOAuthState,
} = require('../utils/oauthState');
const { authMiddleware } = require('../middleware/auth');
const { authStrictLimiter } = require('../middleware/rateLimiters');
const {
  registerValidator,
  loginValidator,
  googleIdTokenValidator,
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
  googleIdTokenLogin,
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

// @route   POST /api/auth/google/id-token
// App mobile (B4): ID token từ SDK Google của hệ điều hành → phiên như /login.
// Cùng limiter với /login: token sai cũng là một lần thử đăng nhập hỏng.
router.post('/google/id-token', authStrictLimiter, googleIdTokenValidator, validate, googleIdTokenLogin);

/** Trang đăng nhập của WEB kèm mã lỗi (đây là host API, không có trang /login). */
const webLoginUrl = (error) => `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=${error}`;

// Thiếu GOOGLE_CLIENT_ID/SECRET thì strategy không được đăng ký (config/passport.js):
// đưa người dùng về trang đăng nhập với lời báo rõ, thay vì lỗi 500 trên host API.
const requireGoogleWebLogin = (req, res, next) => {
  if (!isGoogleWebLoginEnabled()) return res.redirect(webLoginUrl('oauth_unavailable'));
  return next();
};

// @route   GET /api/auth/google
// Ghi `state` ngẫu nhiên vào cookie và gửi kèm sang Google (xem utils/oauthState.js).
router.get('/google', requireGoogleWebLogin, (req, res, next) => {
  const state = createOAuthState();
  res.cookie(oauthStateCookieName(), state, { ...oauthStateCookieOptions(), maxAge: OAUTH_STATE_MAX_AGE });
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state,
  })(req, res, next);
});

// @route   GET /api/auth/google/callback
// Mọi lượt thất bại (bấm Huỷ ở trang Google, mã đổi token sai/đã dùng, lỗi DB) đều quay
// về trang đăng nhập của WEB. Trước đây `failureRedirect: '/login'` là đường dẫn tương
// đối nên trình duyệt bị đưa tới /login của chính host API (trang 404), còn lỗi thì trả
// JSON thô ngay trên host API.
router.get('/google/callback', requireGoogleWebLogin, (req, res, next) => {
  // `state` phải khớp cookie của chính trình duyệt này — chặn việc bị lừa mở URL callback
  // mang `code` của tài khoản người khác.
  const expectedState = req.cookies?.[oauthStateCookieName()];
  if (!isMatchingOAuthState(req.query.state, expectedState)) {
    // Không xoá cookie: lượt đăng nhập hợp lệ đang mở ở tab khác vẫn cần nó (kẻ xấu không
    // biết giá trị cookie nên để lại không làm giảm an toàn).
    console.warn('Google OAuth callback: state không khớp hoặc đã hết hạn');
    return res.redirect(webLoginUrl('oauth_failed'));
  }
  // Khớp thì cookie đã dùng xong — xoá để không dùng lại được.
  res.clearCookie(oauthStateCookieName(), oauthStateCookieOptions());

  return passport.authenticate('google', { session: false }, (err, user) => {
    if (err || !user) {
      if (err) console.warn('Google OAuth callback error:', err.message);
      return res.redirect(webLoginUrl('oauth_failed'));
    }
    req.user = user;
    return googleCallback(req, res, next);
  })(req, res, next);
});

module.exports = router;
