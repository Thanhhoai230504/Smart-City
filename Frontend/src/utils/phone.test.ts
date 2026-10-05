import { describe, it, expect } from 'vitest';
import { isValidPhone, normalizePhone } from './phone';

describe('số điện thoại liên hệ — khớp validator backend', () => {
  it('accepts mobile and landline numbers in the formats the backend accepts', () => {
    expect(isValidPhone('0901234567')).toBe(true);
    expect(isValidPhone('+84901234567')).toBe(true);
    expect(isValidPhone('02363822000')).toBe(true);
  });

  // Cách gõ phổ biến nhất — trước đây bị server chặn với "Validation failed".
  it('normalises spaces, dots, dashes and brackets before checking', () => {
    expect(normalizePhone(' 0901 234 567 ')).toBe('0901234567');
    expect(normalizePhone('(0236) 3822.000')).toBe('02363822000');
    expect(isValidPhone('0901-234-567')).toBe(true);
  });

  it('rejects numbers the backend would reject', () => {
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone('090123456')).toBe(false); // thiếu số
    expect(isValidPhone('090123456789')).toBe(false); // thừa số
    expect(isValidPhone('84901234567')).toBe(false); // thiếu dấu +
    expect(isValidPhone('0901abc567')).toBe(false);
  });
});
