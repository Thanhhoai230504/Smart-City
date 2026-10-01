const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { DA_NANG_DISTRICTS } = require('../utils/districts');
const { sendEmail } = require('./emailService');
const { buildVerificationEmail, buildPasswordResetEmail } = require('../utils/emailTemplates');
const sessionService = require('./sessionService');
const {
  checkPasswordStrength,
  getLockUntil,
  isLocked,
  minutesUntilUnlock,
} = require('../utils/passwordPolicy');

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

// Link đặt lại mật khẩu sống ngắn hơn link xác thực email nhiều: nó cho quyền
// chiếm tài khoản, còn link xác thực chỉ xác nhận một địa chỉ đã biết.
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

const hashVerificationToken = (token) => (
  crypto.createHash('sha256').update(token).digest('hex')
);

const createVerificationToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    hash: hashVerificationToken(token),
    expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
  };
};

const sendVerificationMessage = async (user, token) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const verificationUrl = `${clientUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail(
    user.email,
    'Xác thực email — Smart City Đà Nẵng',
    buildVerificationEmail({ userName: user.name, verificationUrl })
  );
};

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      // `jti` làm mỗi token là duy nhất. Thiếu nó, hai lần ký trong CÙNG MỘT GIÂY
      // cho ra JWT giống hệt nhau (payload, iat và exp đều trùng) — với
      // `User.refreshToken` cũ thì vô hại vì chỉ ghi đè, nhưng RefreshSession có
      // unique index trên tokenHash nên lần thứ hai ném lỗi trùng khoá và đăng
      // nhập thất bại. Xảy ra thật khi hai thiết bị đăng nhập cùng lúc hoặc người
      // dùng bấm nút hai lần.
      jti: crypto.randomBytes(16).toString('hex'),
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

const registerUser = async ({ name, email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw ApiError.badRequest('Email already registered.');
  }

  const strength = checkPasswordStrength(password);
  if (!strength.ok) {
    throw ApiError.badRequestWithCode(strength.message, strength.code);
  }

  const verification = createVerificationToken();
  const now = new Date();
  const user = await User.create({
    name,
    email: normalizedEmail,
    password,
    isVerified: false,
    emailVerificationTokenHash: verification.hash,
    emailVerificationExpires: verification.expiresAt,
    emailVerificationSentAt: now,
  });
  const verificationEmailSent = await sendVerificationMessage(user, verification.token);
  if (!verificationEmailSent) {
    // Cho phép người dùng thử gửi lại ngay nếu nhà cung cấp email vừa lỗi.
    await User.findByIdAndUpdate(user._id, { emailVerificationSentAt: null });
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: false,
    verificationEmailSent,
  };
};

const loginUser = async ({ email, password, deviceType, deviceName }) => {
  const user = await User.findOne({ email: email.trim().toLowerCase() })
    .select('+password +failedLoginAttempts +lockUntil');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Account has been deactivated.');
  }

  // Khoá theo TÀI KHOẢN, bổ sung cho rate limiter theo IP. Limiter dùng
  // skipSuccessfulRequests nên chỉ đếm request hỏng, và đổi IP là đếm lại —
  // không chặn được việc dò một tài khoản cụ thể.
  if (isLocked(user)) {
    const error = ApiError.forbidden(
      `Tài khoản tạm khoá do đăng nhập sai nhiều lần. Thử lại sau ${minutesUntilUnlock(user)} phút.`
    );
    error.code = 'ACCOUNT_LOCKED';
    throw error;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const lockUntil = getLockUntil(attempts);
    await User.findByIdAndUpdate(user._id, { failedLoginAttempts: attempts, lockUntil });

    if (lockUntil) {
      const error = ApiError.forbidden(
        `Sai mật khẩu quá nhiều lần. Tài khoản tạm khoá ${minutesUntilUnlock({ lockUntil })} phút.`
      );
      error.code = 'ACCOUNT_LOCKED';
      throw error;
    }
    // Không tiết lộ còn bao nhiêu lần thử — thông tin đó giúp kẻ dò căn nhịp.
    throw ApiError.unauthorized('Invalid email or password.');
  }

  // Đăng nhập đúng thì xoá bộ đếm; chuỗi sai phải LIÊN TIẾP mới dẫn tới khoá.
  if (user.failedLoginAttempts || user.lockUntil) {
    await User.findByIdAndUpdate(user._id, { failedLoginAttempts: 0, lockUntil: null });
  }

  if (user.provider === 'local' && user.isVerified === false) {
    const error = ApiError.forbidden('Email chưa được xác thực. Vui lòng kiểm tra hộp thư hoặc gửi lại email xác thực.');
    error.code = 'EMAIL_NOT_VERIFIED';
    throw error;
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Mở một phiên MỚI thay vì ghi đè phiên cũ. Đăng nhập trên app không được đá
  // phiên web ra — xem models/RefreshSession.js.
  await sessionService.createSession(user._id, refreshToken, { deviceType, deviceName });

  return {
    accessToken,
    refreshToken,
    // Thiết bị di động không có cookie jar nên nhận token qua body; web giữ
    // nguyên httpOnly cookie. Controller đọc cờ này để quyết định.
    tokenInBody: sessionService.wantsTokenInBody(deviceType),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId || null,
      isVerified: user.isVerified !== false,
    }
  };
};

/**
 * Cấp access token mới và XOAY refresh token.
 *
 * Trả về cả refresh token mới vì token cũ bị thu hồi ngay tại đây — client bắt
 * buộc phải thay, nếu không lần refresh sau sẽ 401.
 */
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw ApiError.unauthorized('No refresh token provided.');
  }

  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

  // Phiên là nguồn sự thật, không phải field trên User. Token đã rotate hoặc đã
  // thu hồi (đổi mật khẩu, đăng xuất) sẽ không tìm thấy phiên nào.
  const session = await sessionService.findActiveSession(refreshToken);
  if (!session || session.userId.toString() !== decoded.id.toString()) {
    throw ApiError.unauthorized('Invalid refresh token.');
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid refresh token.');
  }
  if (user.provider === 'local' && user.isVerified === false) {
    throw ApiError.unauthorized('Email chưa được xác thực.');
  }

  // Cùng thứ tự với loginUser (access trước, refresh sau) để hai hàm đối xứng.
  const accessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);
  await sessionService.rotateSession(session, newRefreshToken);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    tokenInBody: sessionService.wantsTokenInBody(session.deviceType),
  };
};

const verifyEmail = async (token) => {
  const tokenHash = hashVerificationToken(token);
  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
    isVerified: false,
  }).select('+emailVerificationTokenHash +emailVerificationExpires +emailVerificationSentAt');

  if (!user) {
    throw ApiError.badRequest('Liên kết xác thực không hợp lệ hoặc đã hết hạn.');
  }

  user.isVerified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpires = null;
  user.emailVerificationSentAt = null;
  await user.save();

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    isVerified: true,
  };
};

const resendVerificationEmail = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({
    email: normalizedEmail,
    provider: 'local',
  }).select('+emailVerificationTokenHash +emailVerificationExpires +emailVerificationSentAt');

  // Phản hồi giống nhau để không lộ email nào đã đăng ký/đã xác thực.
  if (!user || user.isVerified) {
    return { sent: true };
  }

  if (
    user.emailVerificationSentAt
    && Date.now() - new Date(user.emailVerificationSentAt).getTime() < RESEND_COOLDOWN_MS
  ) {
    return { sent: true };
  }

  const verification = createVerificationToken();
  user.emailVerificationTokenHash = verification.hash;
  user.emailVerificationExpires = verification.expiresAt;
  user.emailVerificationSentAt = new Date();
  await user.save();

  const sent = await sendVerificationMessage(user, verification.token);
  if (!sent) {
    user.emailVerificationSentAt = null;
    await user.save();
  }
  return { sent: true };
};

/**
 * Đăng xuất: chỉ thu hồi phiên của THIẾT BỊ ĐANG DÙNG, không đụng thiết bị khác.
 * Không có refresh token (ví dụ cookie đã mất) thì vẫn trả về bình thường —
 * người dùng không được kẹt ở trạng thái không đăng xuất nổi.
 */
/**
 * Gửi link đặt lại mật khẩu.
 *
 * LUÔN trả về như nhau dù email có tồn tại hay không — phản hồi khác nhau sẽ biến
 * endpoint này thành công cụ dò xem địa chỉ nào đã đăng ký. Cùng nguyên tắc với
 * `resendVerificationEmail` ở trên.
 *
 * Tài khoản Google không có mật khẩu để đặt lại, nên cũng im lặng bỏ qua.
 */
const forgotPassword = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail, provider: 'local' })
    .select('+passwordResetSentAt');

  if (!user || !user.isActive) return { sent: true };

  // Cooldown để một địa chỉ không bị dội email, và để endpoint không thành
  // bàn đạp gửi thư rác qua hệ thống của mình.
  if (
    user.passwordResetSentAt
    && Date.now() - new Date(user.passwordResetSentAt).getTime() < RESEND_COOLDOWN_MS
  ) {
    return { sent: true };
  }

  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashVerificationToken(token);
  user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  user.passwordResetSentAt = new Date();
  await user.save();

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const sent = await sendEmail(
    user.email,
    'Đặt lại mật khẩu — Smart City Đà Nẵng',
    buildPasswordResetEmail({
      userName: user.name,
      resetUrl: `${clientUrl}/reset-password?token=${encodeURIComponent(token)}`,
      expiresMinutes: PASSWORD_RESET_TTL_MS / 60000,
    })
  );

  // Nhà cung cấp email lỗi thì cho người dùng thử lại ngay, đừng bắt chờ hết cooldown.
  if (!sent) {
    user.passwordResetSentAt = null;
    await user.save();
  }
  return { sent: true };
};

/**
 * Đặt mật khẩu mới bằng token trong email.
 *
 * Token dùng một lần (xoá ngay sau khi đổi) và thu hồi MỌI phiên đang mở — người
 * dùng đặt lại mật khẩu thường là vì nghi tài khoản bị chiếm, nên phải cắt được
 * thiết bị của kẻ tấn công chứ không chỉ đổi mật khẩu.
 */
const resetPassword = async (token, newPassword) => {
  const tokenHash = hashVerificationToken(token);
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires +passwordResetSentAt +password');

  if (!user) {
    throw ApiError.badRequestWithCode(
      'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
      'RESET_TOKEN_INVALID'
    );
  }

  const strength = checkPasswordStrength(newPassword);
  if (!strength.ok) {
    throw ApiError.badRequestWithCode(strength.message, strength.code);
  }

  user.password = newPassword;
  // Đặt lại mật khẩu cũng gỡ khoá: người dùng bị kẻ khác dò tới mức khoá tài
  // khoản vẫn phải lấy lại được quyền truy cập của mình.
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.passwordResetTokenHash = null;
  user.passwordResetExpires = null;
  user.passwordResetSentAt = null;
  // Đặt lại mật khẩu cũng là một cách xác nhận quyền sở hữu email, nên tài khoản
  // chưa xác thực coi như đã xác thực luôn — không bắt làm hai lần.
  user.isVerified = true;
  await user.save();

  await sessionService.revokeAllSessions(user._id);

  return { id: user._id, email: user.email };
};

const logoutUser = async (userId, refreshToken) => {
  if (refreshToken) {
    await sessionService.revokeSession(refreshToken);
  }
};

const getProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found.');
  }
  return user;
};

const updateProfile = async (userId, { name, watchedDistricts }) => {
  const updateData = {};
  if (name && name.trim()) updateData.name = name.trim();

  if (watchedDistricts !== undefined) {
    if (!Array.isArray(watchedDistricts)) {
      throw ApiError.badRequest('watchedDistricts must be an array');
    }
    const valid = watchedDistricts.filter(d => DA_NANG_DISTRICTS.includes(d));
    updateData.watchedDistricts = valid;
  }

  if (Object.keys(updateData).length === 0) {
    throw ApiError.badRequest('Nothing to update');
  }

  const user = await User.findByIdAndUpdate(userId, updateData, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest('Current password and new password are required');
  }
  const strength = checkPasswordStrength(newPassword);
  if (!strength.ok) {
    throw ApiError.badRequestWithCode(strength.message, strength.code);
  }

  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.notFound('User not found');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw ApiError.badRequest('Current password is incorrect');

  user.password = newPassword;
  await user.save();

  // Đổi mật khẩu phải cắt được mọi phiên đang mở. Trước đây không thu hồi gì cả,
  // nên nếu tài khoản đã bị chiếm thì kẻ tấn công vẫn giữ quyền thêm 7 ngày —
  // đúng lúc người dùng tin rằng mình vừa khoá lại.
  await sessionService.revokeAllSessions(userId);
};

const generateTokensForUser = async (user, { deviceType, deviceName } = {}) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await sessionService.createSession(user._id, refreshToken, { deviceType, deviceName });

  return {
    accessToken,
    refreshToken,
    tokenInBody: sessionService.wantsTokenInBody(deviceType),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      provider: user.provider,
      avatar: user.avatar,
      isVerified: true,
    },
  };
};

module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getProfile,
  updateProfile,
  changePassword,
  generateTokensForUser,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  PASSWORD_RESET_TTL_MS,
};
