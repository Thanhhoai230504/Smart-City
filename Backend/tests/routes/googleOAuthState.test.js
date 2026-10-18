const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');

// Strategy Google chỉ được đăng ký khi có đủ cấu hình (config/passport.js), và việc đăng
// ký diễn ra lúc nạp module — nên phải đặt biến môi trường trước khi require route.
const ENV_KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'CLIENT_URL', 'SERVER_URL', 'NODE_ENV'];
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.CLIENT_URL = 'https://web.example';
process.env.SERVER_URL = 'https://api.example';

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../src/services/authService', () => ({ generateTokensForUser: jest.fn() }));
jest.mock('../../src/services/googleAuthService', () => ({
  findOrCreateGoogleUser: jest.fn(),
  loginWithGoogleIdToken: jest.fn(),
}));

const passport = require('passport');
const authService = require('../../src/services/authService');
const authRouter = require('../../src/routes/auth');

afterAll(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

/** Chạy `fn` như máy chủ production (tên cookie `__Host-…`, cờ Secure) rồi trả lại như cũ. */
const asProduction = async (fn) => {
  const env = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    return await fn();
  } finally {
    process.env.NODE_ENV = env;
  }
};

const buildApp = (router = authRouter) => {
  const app = express();
  app.use(cookieParser());
  app.use('/api/auth', router);
  return app;
};

// Không có supertest trong dự án nên gọi thẳng qua http (cùng cách với
// tests/routes/authGoogleIdToken.test.js). http.request không tự theo redirect.
const get = (app, path, cookie) =>
  new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const req = http.request(
        {
          port: server.address().port,
          path,
          method: 'GET',
          headers: cookie ? { Cookie: cookie } : {},
        },
        (res) => {
          res.resume();
          res.on('end', () => server.close(() => resolve({ status: res.statusCode, headers: res.headers })));
        }
      );
      req.on('error', (error) => server.close(() => reject(error)));
      req.end();
    });
  });

const setCookies = (headers) => headers['set-cookie'] || [];
const findCookie = (headers, name) => setCookies(headers).find((c) => c.startsWith(`${name}=`));
const isCleared = (cookie) => /Expires=Thu, 01 Jan 1970/.test(cookie || '');

describe('GET /api/auth/google — bắt đầu đăng nhập (strategy thật, không gọi mạng)', () => {
  it('ghi state ngẫu nhiên vào cookie httpOnly và gửi đúng state đó sang Google', async () => {
    const { status, headers } = await get(buildApp(), '/api/auth/google');

    expect(status).toBe(302);
    const location = new URL(headers.location);
    expect(location.host).toBe('accounts.google.com');
    expect(location.searchParams.get('client_id')).toBe('test-client.apps.googleusercontent.com');
    expect(location.searchParams.get('redirect_uri')).toBe('https://api.example/api/auth/google/callback');

    const cookie = findCookie(headers, 'oauthState');
    expect(cookie).toBeDefined();
    const value = cookie.split(';')[0].split('=')[1];
    expect(value.length).toBeGreaterThanOrEqual(43); // 32 byte ngẫu nhiên, base64url
    expect(location.searchParams.get('state')).toBe(value);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/(;|$)/);
    expect(cookie).toMatch(/Max-Age=600/);
    expect(cookie).not.toMatch(/Secure/i); // máy phát triển chạy http
  });

  it('mỗi lượt một state khác nhau', async () => {
    const first = await get(buildApp(), '/api/auth/google');
    const second = await get(buildApp(), '/api/auth/google');
    expect(new URL(first.headers.location).searchParams.get('state'))
      .not.toBe(new URL(second.headers.location).searchParams.get('state'));
  });

  // Tiền tố __Host- buộc Secure, Path=/ và không Domain: tên miền "anh em" không ghi sẵn được
  // một giá trị state do kẻ xấu chọn.
  it('production: cookie __Host-oauthState có Secure, Path=/, không Domain', async () => {
    const { headers } = await asProduction(() => get(buildApp(), '/api/auth/google'));

    const cookie = findCookie(headers, '__Host-oauthState');
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/Path=\/(;|$)/);
    expect(cookie).not.toMatch(/Domain=/i);
    expect(findCookie(headers, 'oauthState')).toBeUndefined();
    expect(new URL(headers.location).searchParams.get('state')).toBe(cookie.split(';')[0].split('=')[1]);
  });

  // Bấm Huỷ ở trang Google: Google quay về kèm error=access_denied và đúng state. Đi qua
  // strategy thật của passport-oauth2 (nhánh error trả fail, không gọi mạng).
  it('bấm Huỷ ở trang Google → về trang đăng nhập, cookie state đã dùng bị xoá', async () => {
    const { status, headers } = await get(
      buildApp(),
      '/api/auth/google/callback?error=access_denied&state=s1',
      'oauthState=s1'
    );

    expect(status).toBe(302);
    expect(headers.location).toBe('https://web.example/login?error=oauth_failed');
    expect(isCleared(findCookie(headers, 'oauthState'))).toBe(true);
    expect(authService.generateTokensForUser).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/google/callback — kiểm state', () => {
  // Thay strategy thật bằng bản giả: không gọi Google đổi code lấy token.
  beforeAll(() => {
    passport.use('google', {
      authenticate(req) {
        if (req.query.code === 'good') return this.success({ id: 'u1', isActive: true });
        return this.fail();
      },
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authService.generateTokensForUser.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh-1' });
  });

  it('state khớp cookie → cấp phiên, xoá cookie state (dùng một lần), về /auth/callback', async () => {
    const { status, headers } = await get(
      buildApp(),
      '/api/auth/google/callback?code=good&state=s1',
      'oauthState=s1'
    );

    expect(status).toBe(302);
    expect(headers.location).toBe('https://web.example/auth/callback');
    expect(findCookie(headers, 'refreshToken')).toBeDefined();
    expect(isCleared(findCookie(headers, 'oauthState'))).toBe(true);
  });

  // Login CSRF: kẻ xấu lừa nạn nhân mở URL callback mang `code` của tài khoản kẻ xấu.
  it.each([
    ['không có cookie', '/api/auth/google/callback?code=good&state=s1', undefined],
    ['state khác cookie', '/api/auth/google/callback?code=good&state=s2', 'oauthState=s1'],
    ['thiếu state', '/api/auth/google/callback?code=good', 'oauthState=s1'],
  ])('%s → về trang đăng nhập, không cấp phiên, không đụng cookie state', async (_, path, cookie) => {
    const { status, headers } = await get(buildApp(), path, cookie);

    expect(status).toBe(302);
    expect(headers.location).toBe('https://web.example/login?error=oauth_failed');
    expect(authService.generateTokensForUser).not.toHaveBeenCalled();
    expect(findCookie(headers, 'refreshToken')).toBeUndefined();
    expect(findCookie(headers, 'oauthState')).toBeUndefined();
  });

  // Tab A bắt đầu (state sA), tab B bắt đầu sau (cookie thành sB). Tab A quay về thì hỏng,
  // nhưng không được kéo tab B hỏng theo — trước khi rà soát, cookie bị xoá trước khi so.
  it('hai lượt đăng nhập song song: lượt cũ hỏng, lượt mới vẫn thành công', async () => {
    const tabA = await get(buildApp(), '/api/auth/google/callback?code=good&state=sA', 'oauthState=sB');
    expect(tabA.headers.location).toBe('https://web.example/login?error=oauth_failed');
    expect(findCookie(tabA.headers, 'oauthState')).toBeUndefined();

    const tabB = await get(buildApp(), '/api/auth/google/callback?code=good&state=sB', 'oauthState=sB');
    expect(tabB.headers.location).toBe('https://web.example/auth/callback');
  });

  it('production: đọc và xoá đúng cookie __Host-oauthState', async () => {
    const { headers } = await asProduction(() => get(
      buildApp(),
      '/api/auth/google/callback?code=good&state=s1',
      '__Host-oauthState=s1'
    ));

    expect(headers.location).toBe('https://web.example/auth/callback');
    const cleared = findCookie(headers, '__Host-oauthState');
    expect(isCleared(cleared)).toBe(true);
    expect(cleared).toMatch(/Secure/i);
    expect(cleared).toMatch(/Path=\/(;|$)/);
  });

  it('production: cookie tên thường `oauthState` (không tiền tố) không được chấp nhận', async () => {
    const { headers } = await asProduction(() => get(
      buildApp(),
      '/api/auth/google/callback?code=good&state=s1',
      'oauthState=s1'
    ));

    expect(headers.location).toBe('https://web.example/login?error=oauth_failed');
    expect(authService.generateTokensForUser).not.toHaveBeenCalled();
  });
});

describe('máy chủ thiếu GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET', () => {
  it('vẫn nạp được route, và đưa người dùng về trang đăng nhập với oauth_unavailable', async () => {
    const id = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    let isolatedRouter;
    try {
      jest.isolateModules(() => {
        isolatedRouter = require('../../src/routes/auth');
      });
    } finally {
      process.env.GOOGLE_CLIENT_ID = id;
    }

    for (const path of ['/api/auth/google', '/api/auth/google/callback?code=x&state=s1']) {
      const { status, headers } = await get(buildApp(isolatedRouter), path, 'oauthState=s1');
      expect(status).toBe(302);
      expect(headers.location).toBe('https://web.example/login?error=oauth_unavailable');
    }
  });
});
