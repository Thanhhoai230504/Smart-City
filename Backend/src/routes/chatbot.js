const express = require('express');
const { sendMessage } = require('../controllers/chatbotController');
const router = express.Router();

// @route POST /api/chatbot/message — Guest-accessible
router.post('/message', sendMessage);

module.exports = router;
