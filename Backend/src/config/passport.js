const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists with this Google ID
    let user = await User.findOne({ provider: 'google', providerId: profile.id });

    if (user) {
      return done(null, user);
    }

    // Check if email already registered as local account
    const email = profile.emails?.[0]?.value;
    if (email) {
      const existingLocal = await User.findOne({ email, provider: 'local' });
      if (existingLocal) {
        // Link Google to existing local account
        existingLocal.provider = 'google';
        existingLocal.providerId = profile.id;
        existingLocal.avatar = profile.photos?.[0]?.value || null;
        await existingLocal.save();
        return done(null, existingLocal);
      }
    }

    // Create new user
    user = await User.create({
      name: profile.displayName,
      email: email,
      provider: 'google',
      providerId: profile.id,
      avatar: profile.photos?.[0]?.value || null,
    });

    done(null, user);
  } catch (error) {
    done(error, null);
  }
}));

module.exports = passport;
