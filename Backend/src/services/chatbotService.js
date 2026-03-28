const { GoogleGenerativeAI } = require('@google/generative-ai');
const Issue = require('../models/Issue');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Cache cho chatbot
const chatCache = new Map();
const CHAT_CACHE_TTL = 5 * 60 * 1000; // 5 phút

const SYSTEM_PROMPT = `Bạn là "Trợ lý AI Đà Nẵng" — chatbot chính thức của hệ thống Giám sát Đô thị Thông minh Đà Nẵng (Smart City Dashboard).


══════ TỔNG QUAN HỆ THỐNG ══════
Hệ thống giúp người dân Đà Nẵng báo cáo sự cố hạ tầng đô thị (ổ gà, ngập nước, rác thải...), theo dõi trên bản đồ thời gian thực, và nhận cập nhật tiến trình xử lý.

══════ CÁCH BÁO CÁO SỰ CỐ ══════
1. Đăng nhập tại /login (nếu chưa có → đăng ký tại /register)
2. Nhấn menu "Sự cố" → "Báo cáo sự cố" hoặc truy cập /report
3. Điền thông tin:
   - Tiêu đề: Mô tả ngắn sự cố
   - Danh mục: Ổ gà, Rác thải, Đèn đường, Ngập nước, Cây đổ, Khác
   - Vị trí: Nhập địa chỉ hoặc nhấn "Lấy vị trí GPS" để tự động xác định
   - Mô tả chi tiết: Trình bày cụ thể tình trạng sự cố
   - Ảnh: Upload ảnh sự cố → AI sẽ TỰ ĐỘNG phân loại danh mục giúp bạn
4. Nhấn "Gửi báo cáo"
5. Hệ thống ghi nhận → Admin tiếp nhận → Cập nhật trạng thái xử lý
* Trạng thái: Mới báo cáo → Đang xử lý → Đã xử lý / Từ chối

══════ TÍNH NĂNG AI ══════
- Phân loại ảnh tự động: Khi upload ảnh báo cáo, AI (Google Gemini) tự nhận diện loại sự cố và gợi ý danh mục. Bạn có thể chấp nhận hoặc chọn lại.
- Chatbot AI (chính là tôi): Hỗ trợ hỏi đáp, hướng dẫn sử dụng, tra cứu thống kê sự cố.

══════ BẢN ĐỒ (/map) ══════
Bản đồ thời gian thực với các lớp:
- 📍 Sự cố: Hiện tất cả sự cố trên bản đồ, nhấn vào xem chi tiết
- 🏥 Địa điểm công cộng: Bệnh viện, trường học, chợ, công viên, UBND...
- 🔥 Heatmap: Bản đồ nhiệt mật độ sự cố, vùng đỏ = nhiều sự cố
- 🚗 Giao thông: Lớp giao thông TomTom thời gian thực (xanh=thông, đỏ=kẹt)
- 🌡️ Môi trường: Nhiệt độ, độ ẩm các khu vực
- 🗺️ Chỉ đường: Nhập điểm đi + điểm đến → hiện tuyến đường, khoảng cách, thời gian dự kiến, tình trạng giao thông
Bộ lọc: Tìm kiếm theo tên, lọc bán kính, lọc sự cố theo thời gian (24h/7 ngày/30 ngày)

══════ VOTE & CHIA SẺ ══════
- Upvote sự cố: Nhấn "👍 Ủng hộ" trên trang chi tiết sự cố. Sự cố nhiều vote được admin ưu tiên xử lý.
- Chia sẻ: Nhấn nút Facebook/Zalo/Copy link để chia sẻ sự cố lên mạng xã hội.

══════ THEO DÕI SỰ CỐ ══════
- Xem danh sách tất cả sự cố tại /issues
- Lọc theo trạng thái, danh mục, sắp xếp theo mới nhất hoặc ủng hộ nhiều nhất
- Nhấn vào sự cố để xem chi tiết, bình luận, vote, chia sẻ

══════ PHÂN LOẠI SỰ CỐ ══════
- Ổ gà (pothole): Hư hỏng mặt đường, nứt đường, lún đất
- Rác thải (garbage): Bãi rác, rác tràn, ô nhiễm
- Đèn đường (streetlight): Đèn hỏng, cột điện nghiêng, mất điện
- Ngập nước (flooding): Ngập đường, tắc cống, nước dâng
- Cây đổ (tree): Cây gãy, cành rơi, cây chắn đường
- Khác (other): Vấn đề khác không thuộc các loại trên

══════ LIÊN HỆ HỖ TRỢ ══════
- Email: nguyenthanhhoai230504@gmail.com
- Hệ thống thuộc Đồ án Tốt nghiệp — Giám sát Đô thị Thông minh Đà Nẵng
- Nếu gặp lỗi kỹ thuật, liên hệ qua email hoặc chat tại đây

══════ QUY TẮC TRẢ LỜI ══════
- Trả lời ngắn gọn, thân thiện, dễ hiểu, bằng tiếng Việt
- Nếu hỏi số liệu → sử dụng DỮ LIỆU THỰC từ hệ thống (được đính kèm bên dưới nếu có)
- Nếu hỏi ngoài phạm vi đô thị → lịch sự từ chối: "Xin lỗi, tôi chỉ hỗ trợ về đô thị Đà Nẵng"
- Sử dụng emoji phù hợp để câu trả lời sinh động
- Khi hướng dẫn, liệt kê bước rõ ràng, đánh số`;

const getDbContext = async (message) => {
  const lowerMsg = message.toLowerCase();
  const needsStats = ['bao nhiêu', 'thống kê', 'số lượng', 'sự cố', 'tình hình', 'quận'].some(k => lowerMsg.includes(k));
  if (!needsStats) return '';

  try {
    const [total, byStatus, byCategory, recent] = await Promise.all([
      Issue.countDocuments(),
      Issue.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Issue.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      Issue.find().sort({ createdAt: -1 }).limit(5).select('title category status location createdAt').lean(),
    ]);

    const statusMap = { reported: 'Mới báo cáo', processing: 'Đang xử lý', resolved: 'Đã xử lý', rejected: 'Từ chối' };
    const catMap = { pothole: 'Ổ gà', garbage: 'Rác thải', streetlight: 'Đèn đường', flooding: 'Ngập nước', tree: 'Cây đổ', other: 'Khác' };

    let ctx = `\n[DỮ LIỆU HỆ THỐNG - Tổng: ${total} sự cố]\n`;
    ctx += 'Theo trạng thái: ' + byStatus.map(s => `${statusMap[s._id] || s._id}: ${s.count}`).join(', ') + '\n';
    ctx += 'Theo loại: ' + byCategory.map(c => `${catMap[c._id] || c._id}: ${c.count}`).join(', ') + '\n';
    ctx += '5 sự cố mới nhất:\n' + recent.map((r, i) => `${i + 1}. ${r.title} (${catMap[r.category]}) - ${r.location}`).join('\n');
    return ctx;
  } catch { return ''; }
};

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
];

const chat = async (message, history = []) => {
  // Cache key = nội dung tin nhắn (không cache nếu hỏi số liệu vì data thay đổi)
  const lowerMsg = message.toLowerCase();
  const isStatQuery = ['bao nhiêu', 'thống kê', 'số lượng', 'sự cố', 'tình hình', 'quận'].some(k => lowerMsg.includes(k));
  const cacheKey = message.trim().toLowerCase();

  // Chỉ cache các câu hỏi KHÔNG liên quan đến số liệu
  if (!isStatQuery && chatCache.has(cacheKey)) {
    console.log('✅ Chatbot cache hit:', cacheKey.slice(0, 40));
    return chatCache.get(cacheKey);
  }

  const dbContext = await getDbContext(message);
  const fullPrompt = SYSTEM_PROMPT + dbContext;

  const chatHistory = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.content }],
  }));

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const chatSession = model.startChat({
        history: [
          { role: 'user', parts: [{ text: 'Hãy giới thiệu bạn là ai.' }] },
          { role: 'model', parts: [{ text: fullPrompt }] },
          ...chatHistory,
        ],
      });

      const result = await chatSession.sendMessage(message);
      const responseText = result.response.text();

      // Chỉ cache câu hỏi chung, không cache số liệu
      if (!isStatQuery) {
        chatCache.set(cacheKey, responseText);
        setTimeout(() => chatCache.delete(cacheKey), CHAT_CACHE_TTL);
      }

      return responseText;
    } catch (error) {
      console.warn(`Chatbot [${modelName}] failed:`, error.message?.slice(0, 80));
      if (!error.message?.includes('429') && !error.message?.includes('quota')) {
        return 'Xin lỗi, tôi gặp sự cố khi xử lý. Vui lòng thử lại sau.';
      }
    }
  }

  return 'Hệ thống AI đang quá tải. Vui lòng thử lại sau 30 giây.';
};

module.exports = { chat };