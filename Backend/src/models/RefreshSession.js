const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Một phiên đăng nhập trên MỘT thiết bị.
 *
 * Trước đây `User.refreshToken` là một field String duy nhất và mỗi lần đăng nhập
 * lại ghi đè. Hệ quả: người dùng đăng nhập web rồi đăng nhập app thì phiên web bị
 * vô hiệu hoá — sau 15 phút (access token hết hạn) thiết bị kia bị đá về màn
 * login. Với một hệ thống chỉ có web thì ít lộ, nhưng app là client thứ hai nên
 * đây là blocker.
 *
 * Ba vấn đề bảo mật được vá cùng lúc (mục L7 trong báo cáo rà soát):
 *   - Token lưu PLAINTEXT trong DB -> giờ chỉ lưu SHA-256 hash.
 *   - Không rotate khi refresh -> giờ mỗi lần refresh thu hồi token cũ, cấp mới.
 *   - Đổi mật khẩu không cắt được phiên của kẻ tấn công -> giờ thu hồi toàn bộ.
 */
const refreshSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Chỉ lưu hash. Lộ database cũng không dùng lại được token.
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  deviceType: {
    type: String,
    enum: ['web', 'android', 'ios'],
    default: 'web',
  },
  // Tên thiết bị do client khai, chỉ để người dùng nhận ra phiên nào là của mình.
  // Không dùng cho bất kỳ quyết định bảo mật nào.
  deviceName: {
    type: String,
    trim: true,
    maxlength: 120,
    default: null,
  },
  lastUsedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  // null = còn hiệu lực. Thu hồi bằng cách gán mốc thời gian chứ không xoá, để
  // còn truy được "token này đã bị dùng lại sau khi rotate" (dấu hiệu bị đánh cắp).
  revokedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

/** Tra cứu phiên còn hiệu lực của một người dùng (màn quản lý thiết bị, thu hồi hàng loạt). */
refreshSessionSchema.index({ userId: 1, revokedAt: 1 });
// MongoDB tự dọn phiên đã hết hạn; không cần cron riêng.
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Hash một refresh token. Dùng chung ở mọi nơi để không có hai cách hash lệch nhau.
 * SHA-256 (không bcrypt) là đủ và đúng ở đây: token đã là 256 bit ngẫu nhiên từ
 * JWT nên không có entropy thấp để brute-force như mật khẩu người dùng, và tra cứu
 * phải nhanh vì chạy trên mọi lần refresh.
 */
refreshSessionSchema.statics.hashToken = (token) => (
  crypto.createHash('sha256').update(token).digest('hex')
);

module.exports = mongoose.model('RefreshSession', refreshSessionSchema);
