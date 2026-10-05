import { describe, it, expect } from 'vitest';
import {
  getApiErrorCode,
  getApiErrorMessage,
  getApiErrorStatus,
  isGenericServerMessage,
} from './apiError';

/** Lỗi giống hệt axios ném ra: `axios.isAxiosError` chỉ kiểm tra cờ `isAxiosError`. */
const axiosError = (status: number | undefined, data?: unknown) => ({
  isAxiosError: true,
  message: 'Request failed',
  response: status === undefined ? undefined : { status, data },
});

const FALLBACK = 'Không thể lưu. Vui lòng thử lại.';

describe('getApiErrorMessage — shape cũ của middleware validate', () => {
  // Đúng tình huống người dân gặp: SĐT có dấu cách bị validator chặn, server trả
  // message tiếng Anh chung chung và để câu tiếng Việt trong errors[].
  it('prefers the Vietnamese field message over "Validation failed"', () => {
    const error = axiosError(400, {
      success: false,
      message: 'Validation failed',
      errors: [{ field: 'phone', message: 'Số điện thoại không hợp lệ' }],
    });
    expect(getApiErrorMessage(error, FALLBACK)).toBe('Số điện thoại không hợp lệ');
  });

  it('joins several distinct field messages, capped at three', () => {
    const error = axiosError(400, {
      message: 'Validation failed',
      errors: [
        { field: 'title', message: 'Tiêu đề phải từ 3 đến 200 ký tự.' },
        { field: 'description', message: 'Mô tả phải từ 10 đến 2000 ký tự' },
        { field: 'description', message: 'Mô tả phải từ 10 đến 2000 ký tự' },
        { field: 'phone', message: 'Số điện thoại không hợp lệ' },
        { field: 'category', message: 'Loại sự cố không hợp lệ' },
      ],
    });
    expect(getApiErrorMessage(error, FALLBACK)).toBe(
      'Tiêu đề phải từ 3 đến 200 ký tự; Mô tả phải từ 10 đến 2000 ký tự; Số điện thoại không hợp lệ',
    );
  });

  it('never shows the literal "Validation failed" even without errors[]', () => {
    expect(getApiErrorMessage(axiosError(400, { message: 'Validation failed' }), FALLBACK)).toBe(FALLBACK);
  });
});

describe('getApiErrorMessage — shape mới (code VALIDATION_ERROR)', () => {
  it('works when message is already the first Vietnamese field message', () => {
    const error = axiosError(400, {
      message: 'Mật khẩu phải có từ 8 đến 128 ký tự',
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'password', message: 'Mật khẩu phải có từ 8 đến 128 ký tự' }],
    });
    expect(getApiErrorMessage(error, FALLBACK)).toBe('Mật khẩu phải có từ 8 đến 128 ký tự');
  });
});

describe('getApiErrorMessage — lỗi nghiệp vụ và lỗi hạ tầng', () => {
  it('uses the business message when there are no field errors', () => {
    const error = axiosError(409, {
      message: 'Sự cố vừa được người khác cập nhật.',
      code: 'STATUS_CONFLICT',
    });
    expect(getApiErrorMessage(error, FALLBACK)).toBe('Sự cố vừa được người khác cập nhật.');
  });

  it('falls back on generic English framework messages', () => {
    expect(getApiErrorMessage(axiosError(500, { message: 'Internal Server Error' }), FALLBACK)).toBe(FALLBACK);
    expect(getApiErrorMessage(axiosError(400, { message: 'Invalid _id: abc' }), FALLBACK)).toBe(FALLBACK);
    expect(getApiErrorMessage(axiosError(400, { message: 'email already exists.' }), FALLBACK)).toBe(FALLBACK);
  });

  it('falls back on network errors, non-JSON bodies and non-axios errors', () => {
    expect(getApiErrorMessage(axiosError(undefined), FALLBACK)).toBe(FALLBACK);
    expect(getApiErrorMessage(axiosError(502, '<html>Bad gateway</html>'), FALLBACK)).toBe(FALLBACK);
    expect(getApiErrorMessage(new Error('boom'), FALLBACK)).toBe(FALLBACK);
    expect(getApiErrorMessage(null, FALLBACK)).toBe(FALLBACK);
  });

  it('ignores blank or malformed field entries', () => {
    const error = axiosError(400, {
      message: 'Không được để trống tên đơn vị.',
      errors: [{ field: 'name' }, { message: '   ' }, 42],
    });
    expect(getApiErrorMessage(error, FALLBACK)).toBe('Không được để trống tên đơn vị.');
  });
});

describe('getApiErrorCode / getApiErrorStatus', () => {
  it('reads the machine-readable code and HTTP status', () => {
    const error = axiosError(409, { message: 'x', code: 'STATUS_CONFLICT' });
    expect(getApiErrorCode(error)).toBe('STATUS_CONFLICT');
    expect(getApiErrorStatus(error)).toBe(409);
  });

  it('returns undefined when there is nothing to read', () => {
    expect(getApiErrorCode(axiosError(400, { message: 'x', code: 42 }))).toBeUndefined();
    expect(getApiErrorCode(new Error('boom'))).toBeUndefined();
    expect(getApiErrorStatus(axiosError(undefined))).toBeUndefined();
  });
});

describe('isGenericServerMessage', () => {
  it('flags framework defaults but not Vietnamese business messages', () => {
    expect(isGenericServerMessage('Validation failed')).toBe(true);
    expect(isGenericServerMessage('  validation FAILED ')).toBe(true);
    expect(isGenericServerMessage('Token expired.')).toBe(true);
    expect(isGenericServerMessage('Vui lòng nêu rõ lý do từ chối.')).toBe(false);
  });
});
