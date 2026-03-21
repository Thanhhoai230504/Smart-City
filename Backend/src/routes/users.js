const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { getUsers, updateUserRole, toggleUserActive } = require('../controllers/userController');

const router = express.Router();

// @route   GET /api/users
router.get('/', authMiddleware, adminMiddleware, getUsers);

// @route   PATCH /api/users/:id/role
router.patch('/:id/role', authMiddleware, adminMiddleware, updateUserRole);

// @route   PATCH /api/users/:id/toggle-active
router.patch('/:id/toggle-active', authMiddleware, adminMiddleware, toggleUserActive);

module.exports = router;
