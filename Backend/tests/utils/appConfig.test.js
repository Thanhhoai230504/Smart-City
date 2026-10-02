const { compareVersions, buildAppConfig, readMobileConfig } = require('../../src/utils/appConfig');

describe('compareVersions', () => {
  it('so theo từng số, không so chuỗi ("1.2.10" > "1.2.9")', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBe(1);
    expect(compareVersions('1.2.9', '1.2.10')).toBe(-1);
  });

  it('bỏ build number sau dấu + và coi phần thiếu là 0', () => {
    expect(compareVersions('1.0.0+7', '1.0.0')).toBe(0);
    expect(compareVersions('1.1', '1.1.0')).toBe(0);
    expect(compareVersions('2', '1.9.9')).toBe(1);
  });

  it('giá trị rác không ném lỗi — coi như 0.0.0', () => {
    expect(compareVersions(undefined, '1.0.0')).toBe(-1);
    expect(compareVersions('abc', '0.0.0')).toBe(0);
  });
});

describe('readMobileConfig', () => {
  it('mặc định 1.0.0 khi chưa cấu hình — bản đầu tiên không bị chặn', () => {
    const cfg = readMobileConfig({});
    expect(cfg.minSupportedVersion).toBe('1.0.0');
    expect(cfg.latestVersion).toBe('1.0.0');
    expect(cfg.storeUrls).toEqual({ android: null, ios: null });
  });

  it('latestVersion không bao giờ thấp hơn minSupportedVersion', () => {
    const cfg = readMobileConfig({
      MOBILE_MIN_SUPPORTED_VERSION: '1.3.0',
      MOBILE_LATEST_VERSION: '1.2.0',
    });
    expect(cfg.latestVersion).toBe('1.3.0');
  });

  it('chỉ nhận URL store https', () => {
    const cfg = readMobileConfig({
      ANDROID_STORE_URL: 'https://play.google.com/store/apps/details?id=vn.danang.smartcity.smart_city_app',
      IOS_STORE_URL: 'javascript:alert(1)',
    });
    expect(cfg.storeUrls.android).toMatch(/^https:\/\/play\.google\.com/);
    expect(cfg.storeUrls.ios).toBeNull();
  });
});

describe('readMobileConfig — đăng nhập Google', () => {
  it('đưa client ID web làm serverClientId cho app (cùng giá trị backend dùng kiểm tra aud)', () => {
    expect(readMobileConfig({ GOOGLE_CLIENT_ID: ' web-client.apps.googleusercontent.com ' }).googleSignIn)
      .toEqual({ serverClientId: 'web-client.apps.googleusercontent.com' });
  });

  it('chưa cấu hình → null để app ẩn nút Google', () => {
    expect(readMobileConfig({}).googleSignIn).toBeNull();
    expect(readMobileConfig({ GOOGLE_CLIENT_ID: '  ' }).googleSignIn).toBeNull();
  });
});

describe('buildAppConfig', () => {
  const env = { MOBILE_MIN_SUPPORTED_VERSION: '1.2.0', MOBILE_LATEST_VERSION: '1.4.0' };

  it('bản thấp hơn min → forceUpdate', () => {
    const cfg = buildAppConfig('1.1.9', env);
    expect(cfg.forceUpdate).toBe(true);
    expect(cfg.updateAvailable).toBe(true);
  });

  it('bản đủ min nhưng cũ hơn latest → chỉ gợi ý cập nhật', () => {
    const cfg = buildAppConfig('1.3.0', env);
    expect(cfg.forceUpdate).toBe(false);
    expect(cfg.updateAvailable).toBe(true);
  });

  it('bản mới nhất → không cần gì', () => {
    const cfg = buildAppConfig('1.4.0+12', env);
    expect(cfg.forceUpdate).toBe(false);
    expect(cfg.updateAvailable).toBe(false);
  });

  it('client không gửi version → không chặn (fail-open), vẫn trả ngưỡng để client tự so', () => {
    const cfg = buildAppConfig(undefined, env);
    expect(cfg.forceUpdate).toBe(false);
    expect(cfg.minSupportedVersion).toBe('1.2.0');
    expect(cfg.clientVersion).toBeNull();
  });

  it('trỏ client tới endpoint meta để tải taxonomy', () => {
    expect(buildAppConfig('1.0.0', {}).enumsUrl).toBe('/api/meta/enums');
  });
});
