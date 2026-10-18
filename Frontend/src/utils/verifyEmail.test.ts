import { describe, it, expect } from 'vitest';
import { initialResendCooldown, RESEND_COOLDOWN_SECONDS } from './verifyEmail';

describe('initialResendCooldown', () => {
  it('starts the countdown right after a successful registration, like the app', () => {
    expect(initialResendCooldown({ justRegistered: true, emailSent: true })).toBe(RESEND_COOLDOWN_SECONDS);
    // Phản hồi không có cờ thì coi như đã gửi (mặc định của máy chủ).
    expect(initialResendCooldown({ justRegistered: true })).toBe(RESEND_COOLDOWN_SECONDS);
  });

  it('lets the user resend at once when the first email failed to send', () => {
    expect(initialResendCooldown({ justRegistered: true, emailSent: false })).toBe(0);
  });

  it('does not block when arriving from the login page or a reload without state', () => {
    expect(initialResendCooldown(null)).toBe(0);
    expect(initialResendCooldown(undefined)).toBe(0);
    expect(initialResendCooldown({ from: '/login' })).toBe(0);
  });

  it('matches the 60-second cooldown enforced by the server', () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(60);
  });
});
