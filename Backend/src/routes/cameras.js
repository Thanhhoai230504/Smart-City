const express = require('express');
const { getCameras, getNearbyCameras } = require('../controllers/cameraController');

const router = express.Router();

// @route   GET /api/cameras/nearby?lat=...&lng=...&radius=2000 (public, no auth)
router.get('/nearby', getNearbyCameras);

// @route   GET /api/cameras (public, no auth)
router.get('/', getCameras);

module.exports = router;
