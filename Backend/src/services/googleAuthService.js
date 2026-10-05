/**
 * Đăng nhập Google — dùng chung cho web (Passport) và app mobile (B4).
 *
 * Web đi luồng redirect trong config/passport.js: trình duyệt sang Google rồi
 * quay về backend. App không đi được luồng đó — Google chặn OAuth trong WebView
 * nhúng, và cuối luồng là redirect về trang web kèm cookie. App dùng SDK Google
 * của hệ điều hành lấy ID token rồi gửi lên `POST /api/auth/google/id-token`.
 */
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { generateTokensForUser } = require('./authService');
const { revokeAllSessions } = require('./sessionService');

const NAME_MAX_LENGTH = 100; // khớp maxlength của User.name

/**
 * Các `aud` được chấp nhận. App Android truyền client ID web làm
 * `serverClientId`, nên token của nó mang `aud` = GOOGLE_CLIENT_ID — đúng client
 * Passport đang dùng. GOOGLE_MOBILE_CLIENT_IDS (tuỳ chọn, phân tách bằng dấu
 * phẩy) dành cho client phát token với `aud` khác, ví dụ app iOS.
 */
const allowedAudiences = (env = process.env) => [
  env.GOOGLE_CLIENT_ID,
  ...String(env.GOOGLE_MOBILE_CLIENT_IDS || '').split(','),
]
  .map((id) => String(id || '').trim())
  .filter(Boolean);

let client = null;
const getClient = () => {
  if (!client) client = new OAuth2Client();
  return client;
};

const withCode = (error, code) => Object.assign(error, { code });

const isCertificateFetchError = (error) => (
  error?.name === 'GaxiosError'
  || String(error?.message || '').startsWith('Failed to retrieve verification certificates')
);

/**
 * Xác minh chữ ký, hạn, `iss` và `aud` bằng thư viện chính thức của Google.
 *
 * Thư viện BỎ QUA kiểm tra `aud` khi không truyền audience — thiếu cấu hình thì
 * phải từ chối, không được để token của app bất kỳ nào lọt qua.
 */
const verifyGoogleIdToken = async (idToken, env = process.env) => {
  const audience = allowedAudiences(env);
  if (audience.length === 0) {
    throw withCode(
      ApiError.serviceUnavailable('Đăng nhập Google chưa được cấu hình trên máy chủ.'),
      'GOOGLE_SIGN_IN_DISABLED'
    );
  }

  let payload;
  try {
    const ticket = await getClient().verifyIdToken({ idToken, audience });
    payload = ticket.getPayload();
  } catch (error) {
    // Không tải được khoá công khai của Google là lỗi phía máy chủ, không phải
    // token sai — trả 503 để client thử lại thay vì báo "tài khoản không hợp lệ".
    if (isCertificateFetchError(error)) {
      throw ApiError.serviceUnavailable('Chưa kết nối được tới Google. Vui lòng thử lại sau.');
    }
    payload = null;
  }

  if (!payload?.sub || !payload.email) {
    throw withCode(
      ApiError.unauthorized('Không xác thực được tài khoản Google. Vui lòng thử lại.'),
      'GOOGLE_TOKEN_INVALID'
    );
  }
  // Tài khoản local trùng email sẽ được liên kết vào tài khoản Google này — chỉ
  // an toàn khi chính Google đã xác minh người cầm token sở hữu địa chỉ đó.
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw withCode(
      ApiError.unauthorized('Email của tài khoản Google này chưa được Google xác minh.'),
      'GOOGLE_EMAIL_NOT_VERIFIED'
    );
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    avatar: payload.picture || null,
  };
};

/**
 * Tìm theo Google ID; chưa có thì liên kết vào tài khoản local cùng email; vẫn
 * chưa có thì tạo mới. Đây là logic Passport đã dùng cho web từ trước — tách ra
 * để web và app ra CÙNG một tài khoản cho cùng một người.
 */
const findOrCreateGoogleUser = async ({ googleId, email, name, avatar }) => {
  const existing = await User.findOne({ provider: 'google', providerId: googleId });
  if (existing) {
    if (!existing.isVerified) {
      existing.isVerified = true;
      await existing.save();
    }
    return existing;
  }

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : null;
  if (normalizedEmail) {
    const local = await User.findOne({ email: normalizedEmail, provider: 'local' });
    if (local) {
      // Tài khoản local CHƯA xác thực email nghĩa là chưa ai chứng minh mình sở
      // hữu địa chỉ này — mật khẩu của nó có thể do kẻ xấu đặt khi đăng ký trước
      // bằng email của nạn nhân. Liên kết mà giữ mật khẩu đó thì ngay khi nạn nhân
      // đăng nhập Google, kẻ ấy đăng nhập được vào tài khoản của nạn nhân bằng mật
      // khẩu của mình. Nên: xoá mật khẩu + mã đặt lại mật khẩu, thu hồi mọi phiên,
      // lấy tên theo hồ sơ Google. Tài khoản ĐÃ xác thực (kể cả tài khoản cũ có
      // isVerified mặc định true) thì người đặt mật khẩu chính là chủ email → giữ.
      const wasUnverified = local.isVerified === false;
      local.provider = 'google';
      local.providerId = googleId;
      local.avatar = avatar || null;
      local.isVerified = true;
      local.emailVerificationTokenHash = null;
      local.emailVerificationExpires = null;
      if (wasUnverified) {
        local.password = undefined;
        local.passwordResetTokenHash = null;
        local.passwordResetExpires = null;
        local.passwordResetSentAt = null;
        local.failedLoginAttempts = 0;
        local.lockUntil = null;
        const googleName = String(name || '').trim();
        if (googleName) local.name = googleName.slice(0, NAME_MAX_LENGTH);
      }
      await local.save();
      if (wasUnverified) await revokeAllSessions(local._id);
      return local;
    }
  }

  // Token chỉ có scope email thì không kèm tên — User.name là bắt buộc.
  const displayName = String(name || '').trim() || (normalizedEmail || '').split('@')[0];
  return User.create({
    name: displayName.slice(0, NAME_MAX_LENGTH),
    email: normalizedEmail,
    provider: 'google',
    providerId: googleId,
    avatar: avatar || null,
    isVerified: true,
  });
};

/** Cấp phiên qua đúng đường B1 như đăng nhập email (RefreshSession theo thiết bị). */
const loginWithGoogleIdToken = async ({ idToken, deviceType, deviceName }) => {
  const profile = await verifyGoogleIdToken(idToken);
  const user = await findOrCreateGoogleUser(profile);
  // Luồng web dựa vào bước /auth/refresh để chặn tài khoản bị khoá; luồng này
  // trả access token ngay nên phải tự kiểm tra.
  if (!user.isActive) {
    throw ApiError.forbidden('Tài khoản đã bị khoá.');
  }
  return generateTokensForUser(user, { deviceType, deviceName });
};

module.exports = {
  allowedAudiences,
  verifyGoogleIdToken,
  findOrCreateGoogleUser,
  loginWithGoogleIdToken,
};
