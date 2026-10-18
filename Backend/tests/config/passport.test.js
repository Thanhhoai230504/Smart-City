jest.mock('../../src/services/googleAuthService', () => ({ findOrCreateGoogleUser: jest.fn() }));

const { isGoogleWebLoginConfigured } = require('../../src/config/passport');

// Trước đây `new GoogleStrategy({ clientID: undefined })` ném lỗi ngay lúc nạp module:
// thiếu GOOGLE_CLIENT_ID là cả máy chủ không khởi động được.
describe('config/passport', () => {
  const loadWith = (env) => {
    const saved = { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET };
    const apply = (key, value) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    apply('GOOGLE_CLIENT_ID', env.GOOGLE_CLIENT_ID);
    apply('GOOGLE_CLIENT_SECRET', env.GOOGLE_CLIENT_SECRET);
    try {
      let mod;
      jest.isolateModules(() => {
        mod = require('../../src/config/passport');
      });
      return mod;
    } finally {
      apply('GOOGLE_CLIENT_ID', saved.id);
      apply('GOOGLE_CLIENT_SECRET', saved.secret);
    }
  };

  it('thiếu cấu hình Google vẫn nạp được, chỉ tắt đăng nhập Google', () => {
    const mod = loadWith({});
    expect(mod.isGoogleWebLoginEnabled()).toBe(false);
    expect(mod.passport._strategy('google')).toBeUndefined();
  });

  it('đủ client ID và secret thì đăng ký strategy google', () => {
    const mod = loadWith({ GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'secret' });
    expect(mod.isGoogleWebLoginEnabled()).toBe(true);
    expect(mod.passport._strategy('google')).toBeDefined();
  });

  it.each([
    [{ GOOGLE_CLIENT_ID: 'id' }],
    [{ GOOGLE_CLIENT_SECRET: 'secret' }],
    [{ GOOGLE_CLIENT_ID: '  ', GOOGLE_CLIENT_SECRET: 'secret' }],
  ])('thiếu một trong hai giá trị (%p) là chưa cấu hình', (env) => {
    expect(isGoogleWebLoginConfigured(env)).toBe(false);
  });
});
