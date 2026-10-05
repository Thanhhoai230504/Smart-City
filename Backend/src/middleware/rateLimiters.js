const rateLimit = require('express-rate-limit');

const tooManyRequests = {
  success: false,
  message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.'
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

// Tạo sự cố là endpoint ĐẮT NHẤT của hệ thống: ghi MongoDB, upload ảnh lên
// Cloudinary, xếp hàng sinh embedding qua Gemini (có phí theo token) và gửi email
// tới MỌI quản trị viên. Trước đây nó chỉ chịu generalLimiter 500 req/15 phút —
// tức một script spam 500 phiếu vẫn hoàn toàn hợp lệ. 20 phiếu/15 phút đã rộng
// hơn nhiều so với nhu cầu của một người dân thật.
const createIssueLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đã gửi quá nhiều báo cáo trong thời gian ngắn. Vui lòng thử lại sau.',
  },
});

// Goong/TomTom tính tiền theo lượt gọi và key giờ nằm ở server, nên lạm dụng
// endpoint proxy là lạm dụng trực tiếp hoá đơn của dự án. 120 lượt/15 phút đủ cho
// một người dùng gõ tìm địa chỉ và chỉ đường liên tục, nhưng chặn script quay vòng.
const geoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequests,
});

// Tile bản đồ có bậc độ lớn khác hẳn: một lượt kéo/zoom sinh hàng chục tile.
// Dùng chung ngưỡng với geoLimiter sẽ chặn nhầm người dùng bình thường. Cache
// 15 phút ở response header gánh phần lớn tải nên trần này hiếm khi chạm tới.
const geoTileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequests,
});

module.exports = {
  authStrictLimiter,
  generalLimiter,
  duplicateCandidateLimiter,
  chatbotLimiter,
  createIssueLimiter,
  geoLimiter,
  geoTileLimiter,
};
