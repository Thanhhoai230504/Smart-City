import { describe, it, expect } from 'vitest';
import { oauthErrorMessage } from './oauthError';

describe('oauthErrorMessage', () => {
  it('không có mã lỗi thì không hiện gì', () => {
    expect(oauthErrorMessage(null)).toBeNull();
    expect(oauthErrorMessage('')).toBeNull();
  });

  it('tài khoản bị khoá nói đúng lý do', () => {
    expect(oauthErrorMessage('account_locked')).toContain('đã bị khoá');
  });

  // Máy chủ thiếu GOOGLE_CLIENT_ID/SECRET: chỉ tắt đăng nhập Google, gợi ý dùng email.
  it('máy chủ chưa bật Google thì gợi ý đăng nhập bằng email', () => {
    expect(oauthErrorMessage('oauth_unavailable')).toContain('đăng nhập bằng email');
  });

  it('mọi mã khác (Huỷ, state không khớp...) là thất bại chung', () => {
    expect(oauthErrorMessage('oauth_failed')).toBe('Đăng nhập bằng Google thất bại. Vui lòng thử lại.');
    expect(oauthErrorMessage('something_else')).toBe('Đăng nhập bằng Google thất bại. Vui lòng thử lại.');
  });
});
