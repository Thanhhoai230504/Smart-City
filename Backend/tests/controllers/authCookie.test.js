jest.mock('../../src/services/authService');
jest.mock('../../src/services/accountService');
jest.mock('../../src/services/googleAuthService');

const authService = require('../../src/services/authService');
const accountService = require('../../src/services/accountService');
const authController = require('../../src/controllers/authController');

const makeResponse = () => {
  const res = {};
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Web (vercel.app) và API (onrender.com) là hai site khác nhau. Cookie refresh
 * `SameSite=Strict` bị trình duyệt chặn ở request cross-site → phiên web chết sau
 * 15 phút. Mọi nơi set/xoá cookie phải dùng cùng một bộ thuộc tính.
 */
describe('AuthController — thuộc tính cookie refresh', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.clearAllMocks();
  });

  it('production: SameSite=None + Secure (web và API khác site)', () => {
    process.env.NODE_ENV = 'production';
    expect(authController.refreshCookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: 'none' });
  });

  it('dev: SameSite=Lax, không đòi https (localhost khác cổng vẫn cùng site)', () => {
    process.env.NODE_ENV = 'development';
    expect(authController.refreshCookieOptions()).toEqual({ httpOnly: true, secure: false, sameSite: 'lax' });
  });

  it('đăng nhập mật khẩu và làm mới token dùng đúng thuộc tính production', async () => {
    process.env.NODE_ENV = 'production';
    authService.loginUser.mockResolvedValue({ accessToken: 'a', refreshToken: 'r1', user: { id: 'u' } });
    authService.refreshAccessToken.mockResolvedValue({ accessToken: 'b', refreshToken: 'r2' });

    const loginRes = makeResponse();
    await authController.login({ body: {} }, loginRes, jest.fn());
    const refreshRes = makeResponse();
    await authController.refresh({ cookies: { refreshToken: 'r1' }, body: {} }, refreshRes, jest.fn());

    for (const [res, token] of [[loginRes, 'r1'], [refreshRes, 'r2']]) {
      expect(res.cookie).toHaveBeenCalledWith('refreshToken', token, expect.objectContaining({
        httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000,
      }));
    }
  });

  it('mobile nhận refresh token trong body, không set cookie', async () => {
    process.env.NODE_ENV = 'production';
    authService.loginUser.mockResolvedValue({ accessToken: 'a', refreshToken: 'r1', user: {}, tokenInBody: true });
    const res = makeResponse();
    await authController.login({ body: {} }, res, jest.fn());

    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.refreshToken).toBe('r1');
  });

  it('đăng nhập Google (redirect) set cookie cùng thuộc tính', async () => {
    process.env.NODE_ENV = 'production';
    authService.generateTokensForUser.mockResolvedValue({ accessToken: 'a', refreshToken: 'g1' });
    const res = makeResponse();
    await authController.googleCallback({ user: { id: 'u' } }, res);

    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'g1', expect.objectContaining({ sameSite: 'none', secure: true }));
    expect(res.redirect).toHaveBeenCalled();
  });

  it('đăng xuất và xoá tài khoản xoá cookie bằng đúng thuộc tính lúc set', async () => {
    process.env.NODE_ENV = 'production';
    authService.logoutUser.mockResolvedValue();
    accountService.deleteAccount.mockResolvedValue({});

    const logoutRes = makeResponse();
    await authController.logout({ user: { id: 'u' }, cookies: { refreshToken: 'r' }, body: {} }, logoutRes, jest.fn());
    const deleteRes = makeResponse();
    await authController.deleteAccount({ user: { id: 'u' }, body: {} }, deleteRes, jest.fn());

    const expected = { httpOnly: true, secure: true, sameSite: 'none' };
    expect(logoutRes.clearCookie).toHaveBeenCalledWith('refreshToken', expected);
    expect(deleteRes.clearCookie).toHaveBeenCalledWith('refreshToken', expected);
  });
});
