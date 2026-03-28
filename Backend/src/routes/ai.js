const express = require('express');
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const { classifyImage } = require('../controllers/aiController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = express.Router();

// @route POST /api/ai/classify-image
router.post('/classify-image', authMiddleware, upload.single('image'), classifyImage);

module.exports = router;
