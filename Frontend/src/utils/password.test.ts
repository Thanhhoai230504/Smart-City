import { describe, it, expect } from 'vitest';
import { getPasswordLengthError, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, PASSWORD_HINT } from './password';

describe('quy tắc độ dài mật khẩu', () => {
  // Backend (utils/passwordPolicy.js) yêu cầu 8 — web từng ghi 6 ở ba màn hình.
  it('matches the backend minimum of 8 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(PASSWORD_HINT).toContain('8');
  });

  it('rejects 6–7 characters, the lengths the old UI used to accept', () => {
    expect(getPasswordLengthError('abc123')).toBe('Mật khẩu phải có ít nhất 8 ký tự');
    expect(getPasswordLengthError('abcd123')).not.toBeNull();
  });

  it('accepts exactly the minimum and the maximum length', () => {
    expect(getPasswordLengthError('abcd1234')).toBeNull();
    expect(getPasswordLengthError('a'.repeat(MAX_PASSWORD_LENGTH))).toBeNull();
  });

  it('rejects passwords longer than the backend cap', () => {
    expect(getPasswordLengthError('a'.repeat(MAX_PASSWORD_LENGTH + 1))).toBe('Mật khẩu không quá 128 ký tự');
  });
});
