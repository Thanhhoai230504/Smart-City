const authService = require('../services/authService');
const accountService = require('../services/accountService');
const googleAuthService = require('../services/googleAuthService');

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

const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * Thuộc tính cookie refresh — MỘT chỗ cho mọi nơi set và xoá cookie (xoá phải
 * khớp thuộc tính lúc set thì trình duyệt mới xoá).
 *
 * Production: web (vercel.app) và API (onrender.com) là HAI site khác nhau — cả
 * hai tên miền nằm trong Public Suffix List — nên mọi request từ web sang API đều
 * là cross-site. Trước đây cookie đặt `SameSite=Strict`: trình duyệt chặn cả lúc
 * set lẫn lúc gửi, /auth/refresh không bao giờ nhận được cookie, nên hết 15 phút
 * access token là người dùng bị đẩy về trang đăng nhập (đăng nhập Google cũng
 * dính sau lần xoay vòng token đầu tiên, vì lần xoay vòng đi qua hàm này).
 * `None` bắt buộc đi kèm `Secure`.
 *
 * Dev: web và API cùng `localhost` (khác cổng vẫn là cùng site) nên `Lax` là đủ
 * và không cần https.
 *
 * `None` không mở ra CSRF đáng kể: /auth/refresh chỉ trả access token trong
 * body, mà CORS chỉ cho đúng CLIENT_URL đọc response. Giới hạn còn lại: Safari
 * (ITP) chặn mọi cookie bên thứ ba bất kể SameSite — muốn triệt để thì đưa API về
 * cùng site với web (tên miền riêng, hoặc rewrite /api trên Vercel).
 */
const refreshCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  };
};

const setRefreshCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, { ...refreshCookieOptions(), maxAge: REFRESH_COOKIE_MAX_AGE });
};

const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', refreshCookieOptions());
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

  setRefreshCookie(res, result.refreshToken);
  return {};
};

const login = async (req, res, next) => {
  try {
    const result = await authService.loginUser(req.body);
    const bodyToken = attachRefreshToken(res, result);

    res.json({
      success: true,
      message: 'Đăng nhập thành công.',
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
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
    }
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    await authService.logoutUser(req.user.id, token);

    clearRefreshCookie(res);

    res.json({ success: true, message: 'Đã đăng xuất.' });
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
    res.json({ success: true, message: 'Đã cập nhật hồ sơ.', data: { user } });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    await authService.changePassword(req.user.id, req.body);
    res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
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
    clearRefreshCookie(res);

    res.json({
      success: true,
      message: 'Tài khoản đã được xoá. Các phản ánh bạn từng gửi được giữ lại dưới dạng ẩn danh.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Đăng nhập Google cho app mobile (B4): app gửi ID token lấy từ SDK Google của
 * hệ điều hành. Trả phiên giống hệt /auth/login — mobile nhận refresh token
 * trong body, nên không lặp lại lỗ hổng L8 (token trên URL) của luồng redirect.
 */
const googleIdTokenLogin = async (req, res, next) => {
  try {
    const result = await googleAuthService.loginWithGoogleIdToken(req.body);
    const bodyToken = attachRefreshToken(res, result);

    res.json({
      success: true,
      message: 'Đăng nhập thành công.',
      data: { accessToken: result.accessToken, user: result.user, ...bodyToken }
    });
  } catch (error) {
    next(error);
  }
};

const googleCallback = async (req, res) => {
  try {
    const result = await authService.generateTokensForUser(req.user);

    setRefreshCookie(res, result.refreshToken);

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
  googleIdTokenLogin,
  googleCallback,
  refreshCookieOptions,
};
