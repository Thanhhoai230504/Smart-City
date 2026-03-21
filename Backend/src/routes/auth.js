const express = require('express');
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
  changePassword
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

module.exports = router;
