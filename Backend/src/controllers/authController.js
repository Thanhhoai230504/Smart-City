const authService = require('../services/authService');
const accountService = require('../services/accountService');

const register = async (req, res, next) => {
  try {
    const user = await authService.registerUser(req.body);
    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const user = await authService.verifyEmail(req.query.token);
    res.json({
      success: true,
      message: 'Xác thực email thành công. Bạn có thể đăng nhập.',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    await authService.resendVerificationEmail(req.body.email);
    res.json({
      success: true,
      message: 'Nếu email chưa được xác thực, một liên kết mới đã được gửi.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gắn refresh token theo đúng kiểu client.
 *
 * Web: httpOnly cookie — JavaScript không đọc được nên an toàn hơn, giữ nguyên.
 * Mobile: trả trong body vì Flutter native không có cookie jar; app lưu vào
 * Keychain/Keystore. KHÔNG set cookie cho mobile để tránh hai nguồn token lệch nhau.
 */
const attachRefreshToken = (res, result) => {
  if (result.tokenInBody) return { refreshToken: result.refreshToken };

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  return {};
};

const login = async (req, res, next) => {
  try {
    const result = await authService.loginUser(req.body);
    const bodyToken = attachRefreshToken(res, result);

    res.json({
      success: true,
      message: 'Login successful.',
      data: { accessToken: result.accessToken, user: result.user, ...bodyToken }
    });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    // Web gửi qua cookie, mobile gửi trong body — nhận cả hai đường.
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    const result = await authService.refreshAccessToken(token);
    const bodyToken = attachRefreshToken(res, result);

    res.json({ success: true, data: { accessToken: result.accessToken, ...bodyToken } });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Refresh token expired. Please login again.' });
    }
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    await authService.logoutUser(req.user.id, token);

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.json({ success: true, message: 'Logout successful.' });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const user = await authService.getProfile(req.user.id);
    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const user = await authService.updateProfile(req.user.id, req.body);
    res.json({ success: true, message: 'Profile updated', data: { user } });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    await authService.changePassword(req.user.id, req.body);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    await authService.forgotPassword(req.body.email);
    // Thông điệp cố tình mơ hồ: trả lời khác nhau cho email tồn tại và không tồn
    // tại sẽ biến endpoint này thành công cụ dò tài khoản.
    res.json({
      success: true,
      message: 'Nếu email tồn tại trong hệ thống, một liên kết đặt lại mật khẩu đã được gửi.',
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại trên mọi thiết bị.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Người dùng tự xoá tài khoản (B8).
 * Bắt buộc có nếu app lên store: app có màn tạo tài khoản thì phải có đường xoá
 * ngay trong app, nếu không sẽ bị từ chối duyệt.
 */
const deleteAccount = async (req, res, next) => {
  try {
    const result = await accountService.deleteAccount(req.user.id, { password: req.body.password });

    // Dọn cookie phiên web; phiên mobile đã bị thu hồi phía server.
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.json({
      success: true,
      message: 'Tài khoản đã được xoá. Các phản ánh bạn từng gửi được giữ lại dưới dạng ẩn danh.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const googleCallback = async (req, res) => {
  try {
    const result = await authService.generateTokensForUser(req.user);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    // KHÔNG đưa access token vào URL (lỗ hổng L8). URL đi vào lịch sử trình
    // duyệt, log của proxy, và rò qua header `Referer` sang mọi tài nguyên bên
    // thứ ba mà trang đích tải. Cookie refresh đã được set ngay phía trên, nên
    // client chỉ cần gọi /auth/refresh để đổi lấy access token.
    res.redirect(`${clientUrl}/auth/callback`);
  } catch (error) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${clientUrl}/login?error=oauth_failed`);
  }
};

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  deleteAccount,
  googleCallback
};
