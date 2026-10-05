import axios from 'axios';

/**
 * Đọc lỗi trả về từ backend — NGUỒN DUY NHẤT phía web.
 *
 * Trước đây có khoảng 12 bản sao `getErrorMessage`, mỗi bản đọc một kiểu: bản
 * đọc `errors[0]`, bản chỉ đọc `message`, còn slice và trang thì đọc thẳng
 * `err.response?.data?.message`. Middleware validate của backend trả
 * `message: 'Validation failed'` (tiếng Anh) và để câu tiếng Việt thật trong
 * `errors[]` — nên mọi chỗ chỉ đọc `message` đều hiện nguyên chữ "Validation
 * failed" cho người dân, không nói sai ở đâu (VD: số điện thoại có dấu cách).
 *
 * Thứ tự ưu tiên:
 * 1. `errors[].message` — lỗi theo từng field (express-validator, Mongoose).
 * 2. `message` — trừ khi là câu chung chung tiếng Anh của framework.
 * 3. `fallback` do nơi gọi truyền, đúng ngữ cảnh thao tác.
 *
 * Chạy với cả hai shape của backend: cũ (`message: 'Validation failed'` +
 * `errors[]`) và mới (`message` là câu tiếng Việt đầu tiên +
 * `code: 'VALIDATION_ERROR'` + `errors[]`).
 */

interface ApiErrorBody {
  message?: unknown;
  code?: unknown;
  errors?: unknown;
}

/** Số câu lỗi field tối đa ghép vào một thông báo — đủ thông tin mà toast không dài lê thê. */
const MAX_FIELD_MESSAGES = 3;

/**
 * Câu mặc định tiếng Anh của Express/Mongoose/ApiError — vô nghĩa với người dùng
 * cuối, nên nhường cho `fallback` tiếng Việt đúng ngữ cảnh.
 */
const GENERIC_SERVER_MESSAGES = new Set([
  'validation failed',
  'internal server error',
  'not found',
  'unauthorized',
  'forbidden',
  'service unavailable',
  'invalid token.',
  'token expired.',
]);

const GENERIC_SERVER_PATTERNS = [
  // Mongoose CastError: "Invalid _id: abc" (id sai định dạng).
  /^invalid [\w.]+: /i,
  // Mongoose duplicate key: "email already exists."
  /^[\w.]+ already exists\.?$/i,
];

/** Câu này có phải thông báo mặc định của framework (không dành cho người dùng) không. */
export const isGenericServerMessage = (message: string): boolean => {
  const normalized = message.trim().toLowerCase();
  return GENERIC_SERVER_MESSAGES.has(normalized)
    || GENERIC_SERVER_PATTERNS.some((pattern) => pattern.test(normalized));
};

const getErrorBody = (error: unknown): ApiErrorBody | null => {
  if (!axios.isAxiosError(error)) return null;
  const data: unknown = error.response?.data;
  return data && typeof data === 'object' ? data as ApiErrorBody : null;
};

const readFieldMessages = (errors: unknown): string[] => {
  if (!Array.isArray(errors)) return [];
  const messages = new Set<string>();
  errors.forEach((item: unknown) => {
    const raw = typeof item === 'string'
      ? item
      : item && typeof item === 'object' && typeof (item as { message?: unknown }).message === 'string'
        ? (item as { message: string }).message
        : '';
    const text = raw.trim();
    if (text && !isGenericServerMessage(text)) messages.add(text);
  });
  return [...messages];
};

/**
 * Câu lỗi hiển thị cho người dùng.
 * @param fallback câu tiếng Việt đúng ngữ cảnh, dùng khi server không có gì đọc được
 *                 (mất mạng, timeout, lỗi 5xx chung chung…).
 */
export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const body = getErrorBody(error);
  if (!body) return fallback;

  const fieldMessages = readFieldMessages(body.errors);
  if (fieldMessages.length === 1) return fieldMessages[0];
  if (fieldMessages.length > 1) {
    return fieldMessages
      .slice(0, MAX_FIELD_MESSAGES)
      .map((message) => message.replace(/\.$/, ''))
      .join('; ');
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message && !isGenericServerMessage(message)) return message;
  return fallback;
};

/** Mã lỗi máy đọc được (`INVALID_STATUS_TRANSITION`, `STATUS_CONFLICT`…) — phân nhánh theo mã, không so chuỗi. */
export const getApiErrorCode = (error: unknown): string | undefined => {
  const code = getErrorBody(error)?.code;
  return typeof code === 'string' ? code : undefined;
};

/** HTTP status của lỗi; `undefined` khi không có response (mất mạng, bị huỷ). */
export const getApiErrorStatus = (error: unknown): number | undefined => (
  axios.isAxiosError(error) ? error.response?.status : undefined
);
