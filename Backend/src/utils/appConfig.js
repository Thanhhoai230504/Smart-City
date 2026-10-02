/**
 * Cấu hình phiên bản app mobile (task 0.8 / B5b của KE-HOACH-FLUTTER-APP.md).
 *
 * Vì sao cần: web deploy là mọi người dùng có bản mới ngay, còn app đã cài nằm
 * trên máy người dùng VĨNH VIỄN nếu họ không cập nhật. Khi backend đổi hợp đồng
 * theo cách bản cũ không xử lý được, server phải có cách nói "bản này không còn
 * được hỗ trợ" — client đọc `forceUpdate` và chặn bằng màn cập nhật.
 *
 * Ngưỡng đặt bằng biến môi trường để đổi được mà không phải deploy code:
 *   MOBILE_MIN_SUPPORTED_VERSION  bản thấp nhất còn dùng được (mặc định 1.0.0)
 *   MOBILE_LATEST_VERSION         bản mới nhất trên store (mặc định = min)
 *   ANDROID_STORE_URL, IOS_STORE_URL
 */

const DEFAULT_VERSION = '1.0.0';
const VERSION_PATTERN = /^\d{1,4}(\.\d{1,4}){0,2}(\+\d{1,9})?$/;

const parts = (version) => String(version ?? '')
  .split('+')[0]
  .split('.')
  .map((p) => Number.parseInt(p, 10))
  .map((n) => (Number.isFinite(n) ? n : 0));

/** So từng số một: '1.2.10' > '1.2.9'. So chuỗi sẽ cho kết quả ngược. */
const compareVersions = (a, b) => {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i += 1) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
};

/** Chỉ nhận chuỗi version hợp lệ — header do client gửi, không tin được. */
const normalizeVersion = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length <= 32 && VERSION_PATTERN.test(trimmed) ? trimmed : null;
};

const httpsOrNull = (value) => (
  typeof value === 'string' && /^https:\/\/\S+$/.test(value.trim()) ? value.trim() : null
);

const readMobileConfig = (env = process.env) => {
  const minSupportedVersion = normalizeVersion(env.MOBILE_MIN_SUPPORTED_VERSION) || DEFAULT_VERSION;
  const latestRaw = normalizeVersion(env.MOBILE_LATEST_VERSION) || minSupportedVersion;
  // Cấu hình sai (latest < min) thì lấy min — không được nói "bản mới nhất" là
  // một bản đang bị chặn.
  const latestVersion = compareVersions(latestRaw, minSupportedVersion) < 0
    ? minSupportedVersion
    : latestRaw;

  return {
    minSupportedVersion,
    latestVersion,
    storeUrls: {
      android: httpsOrNull(env.ANDROID_STORE_URL),
      ios: httpsOrNull(env.IOS_STORE_URL),
    },
  };
};

/**
 * @param {string|undefined} clientVersion - header `X-App-Version`
 * Client không gửi version (hoặc gửi rác) thì KHÔNG chặn — server hỏng hay cấu
 * hình thiếu không được biến thành "không ai mở được app". Client vẫn nhận ngưỡng
 * để tự so.
 */
const buildAppConfig = (clientVersion, env = process.env) => {
  const config = readMobileConfig(env);
  const version = normalizeVersion(clientVersion);
  return {
    ...config,
    clientVersion: version,
    forceUpdate: version ? compareVersions(version, config.minSupportedVersion) < 0 : false,
    updateAvailable: version ? compareVersions(version, config.latestVersion) < 0 : false,
    enumsUrl: '/api/meta/enums',
  };
};

module.exports = { compareVersions, normalizeVersion, readMobileConfig, buildAppConfig };
