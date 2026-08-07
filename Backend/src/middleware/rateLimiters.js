const rateLimit = require('express-rate-limit');

const tooManyRequests = {
  success: false,
  message: 'Too many requests, please try again later.'
};

/**
 * Strict limiter for credential endpoints (login/register/change-password).
 * Must be mounted directly on the route so it is not shadowed by a broader
 * app.use('/api/auth', ...) mount that would answer the request first.
 */
const authStrictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // Count failed attempts only — a legit user who logs in fine is never blocked.
  skipSuccessfulRequests: true,
  message: tooManyRequests
});

/**
 * Default limiter for the rest of the API.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequests
});

// Embedding có chi phí/độ trễ cao hơn API đọc thông thường. Giới hạn riêng theo IP
// để tránh spam provider nhưng vẫn đủ cho form debounce và admin kiểm tra thủ công.
const duplicateCandidateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequests,
});

// Mỗi tin nhắn chatbot là một lượt gọi Google Gemini có phí theo token. Route này
// cho phép khách chưa đăng nhập nên IP là mức chặn duy nhất: 25 tin/15 phút đủ cho
// một hội thoại hỏi đáp bình thường nhưng chặn script quay vòng làm cạn quota.
const chatbotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequests,
});

module.exports = { authStrictLimiter, generalLimiter, duplicateCandidateLimiter, chatbotLimiter };
