const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getMyBadges, getLeaderboard } = require('../controllers/badgeController');

const router = express.Router();

// @route   GET /api/badges/me (auth required)
router.get('/me', authMiddleware, getMyBadges);

// @route   GET /api/badges/leaderboard (public)
router.get('/leaderboard', getLeaderboard);

module.exports = router;
