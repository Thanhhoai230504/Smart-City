const chatbotService = require('../services/chatbotService');

const sendMessage = async (req, res, next) => {
  try {
    const { message, history } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message is required' });
    const reply = await chatbotService.chat(message, history || []);
    res.json({ success: true, data: { reply } });
  } catch (error) { next(error); }
};

module.exports = { sendMessage };
