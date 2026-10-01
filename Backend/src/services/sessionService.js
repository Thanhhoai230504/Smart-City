const RefreshSession = require('../models/RefreshSession');

/** Khớp thời hạn của refresh token trong authService (`expiresIn: '7d'`). */
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Thiết bị hợp lệ. Giá trị lạ từ client rơi về 'web' thay vì làm hỏng request. */
const DEVICE_TYPES = ['web', 'android', 'ios'];
const normalizeDeviceType = (value) => (DEVICE_TYPES.includes(value) ? value : 'web');

/**
 * Chỉ thiết bị di động mới nhận refresh token trong body.
 *
 * Web giữ nguyên httpOnly cookie — đó là cách an toàn hơn vì JavaScript không
 * đọc được, nên không đổi. Flutter native không có cookie jar nên bắt buộc phải
 * đọc token từ body; đổi lại nó lưu vào Keychain/Keystore chứ không phải
 * localStorage.
 */
const wantsTokenInBody = (deviceType) => normalizeDeviceType(deviceType) !== 'web';

/**
 * Ghi nhận một phiên đăng nhập mới.
 *
 * KHÔNG thu hồi các phiên khác — đó chính là điểm khác biệt so với
 * `User.refreshToken` cũ: đăng nhập trên app không được đá phiên web ra.
 */
const createSession = async (userId, refreshToken, { deviceType, deviceName } = {}) => {
  return RefreshSession.create({
    userId,
    tokenHash: RefreshSession.hashToken(refreshToken),
    deviceType: normalizeDeviceType(deviceType),
    deviceName: deviceName ? String(deviceName).slice(0, 120) : null,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    lastUsedAt: new Date(),
  });
};

/**
 * Tìm phiên còn hiệu lực ứng với một refresh token.
 * @returns {Promise<Object|null>}
 */
const findActiveSession = async (refreshToken) => {
  if (!refreshToken) return null;
  return RefreshSession.findOne({
    tokenHash: RefreshSession.hashToken(refreshToken),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
};

/**
 * Xoay token: thu hồi phiên cũ và mở phiên mới cho cùng thiết bị.
 *
 * Trước đây refresh KHÔNG rotate — một refresh token bị đánh cắp dùng được trọn
 * 7 ngày. Giờ token cũ chết ngay khi được dùng, nên kẻ tấn công chỉ dùng được
 * một lần và lần sau người dùng thật bị đăng xuất — một tín hiệu quan sát được.
 */
const rotateSession = async (session, newRefreshToken) => {
  const now = new Date();
  await RefreshSession.updateOne({ _id: session._id }, { revokedAt: now });
  return RefreshSession.create({
    userId: session.userId,
    tokenHash: RefreshSession.hashToken(newRefreshToken),
    deviceType: session.deviceType,
    deviceName: session.deviceName,
    expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
    lastUsedAt: now,
  });
};

/** Thu hồi đúng một phiên (đăng xuất trên thiết bị đang dùng). */
const revokeSession = async (refreshToken) => {
  if (!refreshToken) return 0;
  const result = await RefreshSession.updateMany(
    { tokenHash: RefreshSession.hashToken(refreshToken), revokedAt: null },
    { revokedAt: new Date() }
  );
  return result.modifiedCount || 0;
};

/**
 * Thu hồi MỌI phiên của một người dùng.
 *
 * Dùng khi đổi mật khẩu và khi xoá tài khoản. Trước đây đổi mật khẩu không đụng
 * gì tới refresh token, nên nếu tài khoản đã bị chiếm thì kẻ tấn công vẫn giữ
 * quyền truy cập thêm 7 ngày — đúng lúc người dùng tin rằng mình vừa khoá lại.
 */
const revokeAllSessions = async (userId) => {
  const result = await RefreshSession.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date() }
  );
  return result.modifiedCount || 0;
};

/** Danh sách phiên còn hiệu lực — cho màn "thiết bị đang đăng nhập". */
const listActiveSessions = async (userId) => RefreshSession.find({
  userId,
  revokedAt: null,
  expiresAt: { $gt: new Date() },
}).select('deviceType deviceName lastUsedAt createdAt').sort('-lastUsedAt');

module.exports = {
  REFRESH_TTL_MS,
  DEVICE_TYPES,
  normalizeDeviceType,
  wantsTokenInBody,
  createSession,
  findActiveSession,
  rotateSession,
  revokeSession,
  revokeAllSessions,
  listActiveSessions,
};
