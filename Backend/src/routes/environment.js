const express = require('express');
const {
  getEnvironmentData,
  getEnvironmentHistory
} = require('../controllers/environmentController');

const router = express.Router();

// @route   GET /api/environment
router.get('/', getEnvironmentData);

// @route   GET /api/environment/history
router.get('/history', getEnvironmentHistory);

module.exports = router;
