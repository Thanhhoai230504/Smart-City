const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const VALID_CATEGORIES = ['pothole', 'garbage', 'streetlight', 'flooding', 'tree', 'other'];

// Cache cho classify (dùng hash của ảnh làm key)
const classifyCache = new Map();
const CLASSIFY_CACHE_TTL = 10 * 60 * 1000; // 10 phút

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
];

const classifyIssueImage = async (imageBuffer, mimeType = 'image/jpeg') => {
  // Tạo cache key từ 100 byte đầu của ảnh (đủ để phân biệt)
  const cacheKey = imageBuffer.slice(0, 100).toString('base64');

  // Kiểm tra cache
  if (classifyCache.has(cacheKey)) {
    console.log('✅ Classify cache hit');
    return classifyCache.get(cacheKey);
  }

  const prompt = `Bạn là hệ thống AI phân loại sự cố đô thị. Phân tích ảnh và xác định loại sự cố.

Các loại sự cố:
- pothole: Ổ gà, hư hỏng mặt đường, nứt đường
- garbage: Rác thải, bãi rác, ô nhiễm
- streetlight: Đèn đường hỏng, cột điện nghiêng
- flooding: Ngập nước, úng nước
- tree: Cây đổ, cành gãy, cây nguy hiểm
- other: Sự cố khác không thuộc các loại trên

Trả về JSON (chỉ JSON, không markdown):
{"category": "tên_loại", "confidence": 0.0-1.0, "description": "mô tả ngắn bằng tiếng Việt"}`;

  const imagePart = {
    inlineData: { data: imageBuffer.toString('base64'), mimeType },
  };

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([prompt, imagePart]);
      const text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(text);

      if (!VALID_CATEGORIES.includes(parsed.category)) parsed.category = 'other';
      parsed.confidence = Math.min(1, Math.max(0, parsed.confidence || 0.5));

      // Lưu vào cache, tự xóa sau TTL
      classifyCache.set(cacheKey, parsed);
      setTimeout(() => classifyCache.delete(cacheKey), CLASSIFY_CACHE_TTL);

      return parsed;
    } catch (error) {
      console.warn(`AI classify [${modelName}] failed:`, error.message?.slice(0, 80));
      if (!error.message?.includes('429') && !error.message?.includes('quota')) break;
    }
  }

  return { category: 'other', confidence: 0, description: 'Không thể phân tích ảnh' };
};

module.exports = { classifyIssueImage };