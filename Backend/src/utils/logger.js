/**
 * Logger tối giản có cấu trúc.
 *
 * Trước đây toàn hệ thống dùng `console.*` trực tiếp (~49 lời gọi trong `src`).
 * Hai hệ quả thật:
 *   - `errorHandler` chỉ log `err.message`, KHÔNG log stack, trong khi ở
 *     production nó lại thay message 5xx bằng 'Internal Server Error' — nên gần
 *     như không truy được lỗi gốc.
 *   - `emailService` nuốt lỗi và chỉ in `error.message`, không ghi người nhận
 *     hay tiêu đề, nên khi Gmail chặn hàng loạt thì không biết mail nào hỏng để
 *     gửi lại.
 *
 * Không dùng winston/pino vì đồ án không cần thêm dependency: thứ thiếu là
 * *ngữ cảnh có cấu trúc*, không phải một thư viện. Ở production in JSON một dòng
 * để Render/CloudWatch parse được; ở máy phát triển in dạng dễ đọc.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = () => {
  const configured = (process.env.LOG_LEVEL || '').toLowerCase();
  if (configured in LEVELS) return LEVELS[configured];
  // Test chỉ cần thấy lỗi; production mặc định info.
  if (process.env.NODE_ENV === 'test') return LEVELS.error;
  return LEVELS.info;
};

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Những khoá không bao giờ được ghi ra log, dù caller có vô tình truyền vào.
 * Log thường bị gửi sang dịch vụ bên thứ ba và giữ lâu hơn database.
 */
const REDACTED_KEYS = new Set([
  'password', 'newPassword', 'currentPassword',
  'token', 'accessToken', 'refreshToken', 'tokenHash',
  'authorization', 'cookie', 'apiKey', 'api_key', 'secret',
]);

const redact = (meta) => {
  if (!meta || typeof meta !== 'object') return meta;
  const out = {};
  for (const [key, value] of Object.entries(meta)) {
    if (REDACTED_KEYS.has(key)) {
      out[key] = '[redacted]';
    } else if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
      out[key] = redact(value);
    } else {
      out[key] = value;
    }
  }
  return out;
};

const write = (level, message, meta = {}) => {
  if (LEVELS[level] > currentLevel()) return;

  const safeMeta = redact(meta);
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (isProduction()) {
    sink(JSON.stringify({ level, time: new Date().toISOString(), message, ...safeMeta }));
    return;
  }

  const extras = Object.keys(safeMeta).length ? ` ${JSON.stringify(safeMeta)}` : '';
  sink(`[${level}] ${message}${extras}`);
};

const logger = {
  error: (message, meta) => write('error', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  info: (message, meta) => write('info', message, meta),
  debug: (message, meta) => write('debug', message, meta),
};

module.exports = { logger, redact, REDACTED_KEYS, LEVELS };
