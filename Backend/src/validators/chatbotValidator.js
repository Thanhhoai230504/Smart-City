const { body } = require('express-validator');

// Mỗi request chatbot được đẩy nguyên vào Gemini, nên độ dài đầu vào chính là chi phí
// token. Chặn ngay ở tầng validate để payload khổng lồ không bao giờ tới provider.
const MAX_HISTORY_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 2000;

const chatMessageValidator = [
  body('message')
    .trim()
    .notEmpty().withMessage('Tin nhắn là bắt buộc')
    .isLength({ max: MAX_CONTENT_LENGTH }).withMessage(`Tin nhắn không quá ${MAX_CONTENT_LENGTH} ký tự`),
  body('history')
    .optional()
    .isArray({ max: MAX_HISTORY_MESSAGES })
    .withMessage(`Lịch sử hội thoại không quá ${MAX_HISTORY_MESSAGES} tin nhắn`)
    .bail()
    // Kiểm tra nội dung bằng một custom để mảng lớn chỉ sinh 1 lỗi, thay vì
    // một lỗi cho mỗi phần tử (history.*.content) làm phình response.
    .custom((arr) => arr.every((h) => typeof h?.content === 'string' && h.content.length <= MAX_CONTENT_LENGTH))
    .withMessage(`Mỗi tin nhắn trong lịch sử phải là chuỗi và không quá ${MAX_CONTENT_LENGTH} ký tự`),
];

module.exports = { chatMessageValidator };
