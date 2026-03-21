const express = require('express');
const { getTrafficStats } = require('../controllers/trafficController');

const router = express.Router();

// @route   GET /api/traffic/stats
router.get('/stats', getTrafficStats);

module.exports = router;
