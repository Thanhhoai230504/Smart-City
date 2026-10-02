const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../src/services/googleAuthService', () => ({ loginWithGoogleIdToken: jest.fn() }));

const { loginWithGoogleIdToken } = require('../../src/services/googleAuthService');
const ApiError = require('../../src/utils/apiError');
const authRouter = require('../../src/routes/auth');
const errorHandler = require('../../src/middleware/errorHandler');
const { authStrictLimiter } = require('../../src/middleware/rateLimiters');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use(errorHandler);
  return app;
};

// Không có supertest trong dự án nên gọi thẳng qua http trên cổng tạm (cùng
// cách với tests/routes/appConfig.test.js).
const post = (app, path, body) =>
  new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const server = app.listen(0, () => {
      const req = http.request(
        {
          port: server.address().port,
          path,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => { raw += chunk; });
          res.on('end', () => {
            server.close(() => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(raw) }));
          });
        }
      );
      req.on('error', (error) => server.close(() => reject(error)));
      req.end(payload);
    });
  });

const ROUTE = '/api/auth/google/id-token';

describe('POST /api/auth/google/id-token (B4)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('dùng chung limiter chặt với /login', () => {
    const layer = authRouter.stack.find((l) => l.route?.path === '/google/id-token' && l.route.methods.post);
    expect(layer.route.stack.map((l) => l.handle)).toContain(authStrictLimiter);
  });

  it('thiếu idToken → 400 theo field, chưa gọi tới Google', async () => {
    const { status, body } = await post(buildApp(), ROUTE, { deviceType: 'android' });

    expect(status).toBe(400);
    expect(body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'idToken' })]));
    expect(loginWithGoogleIdToken).not.toHaveBeenCalled();
  });

  it('idToken dài bất thường hoặc deviceType lạ → 400', async () => {
    const tooLong = await post(buildApp(), ROUTE, { idToken: 'x'.repeat(5000), deviceType: 'android' });
    expect(tooLong.status).toBe(400);

    const badDevice = await post(buildApp(), ROUTE, { idToken: 'token', deviceType: 'toaster' });
    expect(badDevice.status).toBe(400);
    expect(loginWithGoogleIdToken).not.toHaveBeenCalled();
  });

  it('mobile → refresh token trong body, không set cookie', async () => {
    loginWithGoogleIdToken.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenInBody: true,
      user: { id: 'u1', role: 'user', provider: 'google' },
    });

    const { status, headers, body } = await post(buildApp(), ROUTE, {
      idToken: ' token ',
      deviceType: 'android',
      deviceName: 'Pixel 9a',
    });

    expect(status).toBe(200);
    expect(body.data).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      user: { id: 'u1', role: 'user', provider: 'google' },
    });
    expect(headers['set-cookie']).toBeUndefined();
    expect(loginWithGoogleIdToken).toHaveBeenCalledWith(expect.objectContaining({
      idToken: 'token',
      deviceType: 'android',
      deviceName: 'Pixel 9a',
    }));
  });

  it('lỗi nghiệp vụ giữ nguyên status + code để app phân nhánh', async () => {
    const error = ApiError.unauthorized('Không xác thực được tài khoản Google. Vui lòng thử lại.');
    error.code = 'GOOGLE_TOKEN_INVALID';
    loginWithGoogleIdToken.mockRejectedValue(error);

    const { status, body } = await post(buildApp(), ROUTE, { idToken: 'token', deviceType: 'android' });

    expect(status).toBe(401);
    expect(body).toMatchObject({ success: false, code: 'GOOGLE_TOKEN_INVALID' });
  });
});
