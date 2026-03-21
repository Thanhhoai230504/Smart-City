const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { getStats } = require('../controllers/dashboardController');

const router = express.Router();

// @route   GET /api/dashboard/stats
router.get('/stats', authMiddleware, adminMiddleware, getStats);

module.exports = router;
