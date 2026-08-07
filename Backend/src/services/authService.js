const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { DA_NANG_DISTRICTS } = require('../utils/districts');
const { sendEmail } = require('./emailService');
const { buildVerificationEmail } = require('../utils/emailTemplates');

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

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
    { id: user._id },
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

const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Account has been deactivated.');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  if (user.provider === 'local' && user.isVerified === false) {
    const error = ApiError.forbidden('Email chưa được xác thực. Vui lòng kiểm tra hộp thư hoặc gửi lại email xác thực.');
    error.code = 'EMAIL_NOT_VERIFIED';
    throw error;
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await User.findByIdAndUpdate(user._id, { refreshToken });

  return {
    accessToken,
    refreshToken,
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

const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw ApiError.unauthorized('No refresh token provided.');
  }

  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== refreshToken) {
    throw ApiError.unauthorized('Invalid refresh token.');
  }
  if (user.provider === 'local' && user.isVerified === false) {
    throw ApiError.unauthorized('Email chưa được xác thực.');
  }

  return generateAccessToken(user);
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

const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
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
  if (newPassword.length < 6) {
    throw ApiError.badRequest('New password must be at least 6 characters');
  }

  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.notFound('User not found');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw ApiError.badRequest('Current password is incorrect');

  user.password = newPassword;
  await user.save();
};

const generateTokensForUser = async (user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await User.findByIdAndUpdate(user._id, { refreshToken });

  return {
    accessToken,
    refreshToken,
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
};
