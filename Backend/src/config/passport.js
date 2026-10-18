const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { findOrCreateGoogleUser } = require('../services/googleAuthService');

// SERVER_URL: địa chỉ public của backend (trên VPS: https://api.smartcitydn.io.vn).
// Google chuyển hướng về `${SERVER_URL}/api/auth/google/callback` sau khi đăng nhập,
// nên URL đó phải có trong "Authorized redirect URIs" của OAuth client. Không đặt
// thì production dùng địa chỉ Render cũ (dự phòng khi bật lại Render), dev dùng
// localhost.
const BACKEND_URL = (process.env.SERVER_URL || '').replace(/\/+$/, '')
  || (process.env.NODE_ENV === 'production'
    ? 'https://smart-city-tgsf.onrender.com'
    : 'http://localhost:5000');

/**
 * Đăng nhập Google trên web cần cả client ID lẫn client secret.
 *
 * Trước đây strategy luôn được tạo: thiếu GOOGLE_CLIENT_ID thì `new GoogleStrategy`
 * ném lỗi ngay lúc nạp module và cả máy chủ không khởi động được — mất toàn bộ hệ
 * thống chỉ vì một cách đăng nhập. Giờ thiếu cấu hình thì bỏ qua strategy:
 * validateEnv cảnh báo lúc khởi động, còn route /api/auth/google đưa người dùng về
 * trang đăng nhập với `error=oauth_unavailable`.
 */
const isGoogleWebLoginConfigured = (env = process.env) => (
  Boolean(String(env.GOOGLE_CLIENT_ID || '').trim() && String(env.GOOGLE_CLIENT_SECRET || '').trim())
);

let googleWebLoginEnabled = false;

if (isGoogleWebLoginConfigured()) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${BACKEND_URL}/api/auth/google/callback`,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Logic tìm/liên kết/tạo tài khoản dùng chung với đăng nhập Google của app
      // (services/googleAuthService.js) để cùng một người ra cùng một tài khoản.
      const user = await findOrCreateGoogleUser({
        googleId: profile.id,
        email: profile.emails?.[0]?.value,
        name: profile.displayName,
        avatar: profile.photos?.[0]?.value,
      });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }));
  googleWebLoginEnabled = true;
}

/** Strategy 'google' đã được đăng ký chưa (routes/auth.js kiểm trước khi dùng). */
const isGoogleWebLoginEnabled = () => googleWebLoginEnabled;

module.exports = { passport, isGoogleWebLoginConfigured, isGoogleWebLoginEnabled };
