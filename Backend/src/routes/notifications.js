const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
} = require('../controllers/notificationController');

const router = express.Router();

// @route   GET /api/notifications
router.get('/', authMiddleware, getNotifications);

// @route   GET /api/notifications/unread-count
router.get('/unread-count', authMiddleware, getUnreadCount);

// @route   PATCH /api/notifications/read-all
router.patch('/read-all', authMiddleware, markAllAsRead);

// @route   PATCH /api/notifications/:id/read
router.patch('/:id/read', authMiddleware, markAsRead);

module.exports = router;
