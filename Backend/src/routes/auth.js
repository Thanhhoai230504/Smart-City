const express = require('express');
const passport = require('passport');
const validate = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { registerValidator, loginValidator } = require('../validators/authValidator');
const {
  register,
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
router.post('/register', registerValidator, validate, register);

// @route   POST /api/auth/login
router.post('/login', loginValidator, validate, login);

// @route   POST /api/auth/refresh
router.post('/refresh', refresh);

// @route   POST /api/auth/logout
router.post('/logout', authMiddleware, logout);

// @route   GET /api/auth/profile
router.get('/profile', authMiddleware, getProfile);

// @route   PATCH /api/auth/profile
router.patch('/profile', authMiddleware, updateProfile);

// @route   PATCH /api/auth/change-password
router.patch('/change-password', authMiddleware, changePassword);

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
