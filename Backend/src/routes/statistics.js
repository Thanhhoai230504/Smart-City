const express = require('express');
const { getStatistics } = require('../controllers/statisticsController');

const router = express.Router();

// @route   GET /api/statistics (public, no auth)
router.get('/', getStatistics);

module.exports = router;
