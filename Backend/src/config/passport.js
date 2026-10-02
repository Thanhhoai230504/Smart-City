const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { findOrCreateGoogleUser } = require('../services/googleAuthService');

const BACKEND_URL = process.env.NODE_ENV === 'production'
  ? 'https://smart-city-tgsf.onrender.com'
  : 'http://localhost:5000';

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

module.exports = passport;
