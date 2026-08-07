const express = require('express');
const { sendMessage } = require('../controllers/chatbotController');
const validate = require('../middleware/validate');
const { chatMessageValidator } = require('../validators/chatbotValidator');
const { chatbotLimiter } = require('../middleware/rateLimiters');
const router = express.Router();

// @route POST /api/chatbot/message — Guest-accessible
router.post('/message', chatbotLimiter, chatMessageValidator, validate, sendMessage);

module.exports = router;
