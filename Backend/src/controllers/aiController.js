const { classifyIssueImage } = require('../services/aiService');

const classifyImage = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    const result = await classifyIssueImage(req.file.buffer, req.file.mimetype);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

module.exports = { classifyImage };
