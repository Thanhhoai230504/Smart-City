const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { withModelFallback } = require('./geminiModels');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const VALID_CATEGORIES = ['pothole', 'garbage', 'streetlight', 'flooding', 'tree', 'other'];

// Cache cho classify, khoá là SHA-256 của toàn bộ ảnh. Trước đây khoá là 100 byte đầu, nhưng
// ảnh JPEG cùng bộ mã hoá (cùng máy ảnh, hoặc do app nén lại) thường trùng phần đầu tệp, nên
// hai ảnh khác nhau gửi trong 10 phút nhận chung một gợi ý.
const classifyCache = new Map();
const CLASSIFY_CACHE_TTL = 10 * 60 * 1000; // 10 phút

const FALLBACK_RESULT = { category: 'other', confidence: 0, description: 'Không thể phân tích ảnh' };

const PROMPT = `Bạn là hệ thống AI phân loại sự cố đô thị. Phân tích ảnh và xác định loại sự cố.

Các loại sự cố:
- pothole: Ổ gà, hư hỏng mặt đường, nứt đường
- garbage: Rác thải, bãi rác, ô nhiễm
- streetlight: Đèn đường hỏng, cột điện nghiêng
- flooding: Ngập nước, úng nước
- tree: Cây đổ, cành gãy, cây nguy hiểm
- other: Sự cố khác không thuộc các loại trên

Trả về JSON (chỉ JSON, không markdown):
{"category": "tên_loại", "confidence": 0.0-1.0, "description": "mô tả ngắn bằng tiếng Việt"}`;

const cacheKeyOf = (imageBuffer, mimeType) =>
  crypto.createHash('sha256').update(mimeType).update(imageBuffer).digest('hex');

// JSON hỏng thì ném lỗi để withModelFallback thử model kế tiếp.
const parseResult = (text) => {
  const parsed = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  if (!VALID_CATEGORIES.includes(parsed.category)) parsed.category = 'other';
  parsed.confidence = Math.min(1, Math.max(0, parsed.confidence || 0.5));
  return parsed;
};

const classifyIssueImage = async (imageBuffer, mimeType = 'image/jpeg') => {
  const cacheKey = cacheKeyOf(imageBuffer, mimeType);
  if (classifyCache.has(cacheKey)) {
    console.log('✅ Classify cache hit');
    return classifyCache.get(cacheKey);
  }

  const imagePart = {
    inlineData: { data: imageBuffer.toString('base64'), mimeType },
  };

  try {
    const { value } = await withModelFallback(
      genAI,
      { generationConfig: { responseMimeType: 'application/json' }, logLabel: 'AI classify' },
      async (model) => parseResult((await model.generateContent([PROMPT, imagePart])).response.text()),
    );
    // Lưu vào cache, tự xóa sau TTL; unref để hẹn giờ không giữ tiến trình sống
    classifyCache.set(cacheKey, value);
    setTimeout(() => classifyCache.delete(cacheKey), CLASSIFY_CACHE_TTL).unref();
    return value;
  } catch {
    // AI không bao giờ chặn việc báo cáo: hết model thì trả kết quả mặc định với độ tin cậy 0
    return { ...FALLBACK_RESULT };
  }
};

module.exports = { classifyIssueImage };
