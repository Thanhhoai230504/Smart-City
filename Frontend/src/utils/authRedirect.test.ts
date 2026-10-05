import { describe, it, expect } from 'vitest';
import {
  getRoleHomePath,
  isSafeRedirectPath,
  resolvePostLoginPath,
  toRedirectPath,
} from './authRedirect';

describe('getRoleHomePath', () => {
  it('sends each role to its own workspace', () => {
    expect(getRoleHomePath('admin')).toBe('/admin');
    expect(getRoleHomePath('staff')).toBe('/staff');
    expect(getRoleHomePath('user')).toBe('/');
    expect(getRoleHomePath(undefined)).toBe('/');
  });
});

describe('toRedirectPath', () => {
  // ProtectedRoute truyền nguyên object Location qua state.
  it('rebuilds the path from a router Location object', () => {
    expect(toRedirectPath({ pathname: '/issues/abc', search: '?tab=1', hash: '#binh-luan' }))
      .toBe('/issues/abc?tab=1#binh-luan');
    expect(toRedirectPath({ pathname: '/report' })).toBe('/report');
  });

  it('passes strings through and rejects anything else', () => {
    expect(toRedirectPath('/report')).toBe('/report');
    expect(toRedirectPath({ search: '?x' })).toBeNull();
    expect(toRedirectPath(42)).toBeNull();
    expect(toRedirectPath(null)).toBeNull();
  });
});

describe('isSafeRedirectPath — chống open redirect', () => {
  it('accepts internal paths', () => {
    expect(isSafeRedirectPath('/report')).toBe(true);
    expect(isSafeRedirectPath('/issues/65f0c0ffee?x=1#y')).toBe(true);
    expect(isSafeRedirectPath('/')).toBe(true);
  });

  it('rejects absolute and protocol-relative URLs', () => {
    expect(isSafeRedirectPath('https://evil.example/login')).toBe(false);
    expect(isSafeRedirectPath('//evil.example')).toBe(false);
    expect(isSafeRedirectPath('/\\evil.example')).toBe(false);
    expect(isSafeRedirectPath('javascript:alert(1)')).toBe(false);
    expect(isSafeRedirectPath('report')).toBe(false);
  });

  it('rejects control characters, empty and oversized values', () => {
    expect(isSafeRedirectPath('/report\n//evil.example')).toBe(false);
    expect(isSafeRedirectPath('')).toBe(false);
    expect(isSafeRedirectPath(`/${'a'.repeat(3000)}`)).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
  });

  it('never sends the user back into the login flow', () => {
    expect(isSafeRedirectPath('/login')).toBe(false);
    expect(isSafeRedirectPath('/login?error=oauth_failed')).toBe(false);
    expect(isSafeRedirectPath('/register')).toBe(false);
    expect(isSafeRedirectPath('/auth/callback')).toBe(false);
    expect(isSafeRedirectPath('/LOGIN')).toBe(false);
    // Tiền tố trùng tên nhưng là trang khác thì vẫn hợp lệ.
    expect(isSafeRedirectPath('/loginhelp')).toBe(true);
  });
});

describe('resolvePostLoginPath', () => {
  it('returns to the page the guest was sent away from', () => {
    expect(resolvePostLoginPath({ pathname: '/report' }, 'user')).toBe('/report');
    expect(resolvePostLoginPath('/issues/abc?x=1', 'staff')).toBe('/issues/abc?x=1');
  });

  it('falls back to the role home for missing or unsafe targets', () => {
    expect(resolvePostLoginPath(null, 'admin')).toBe('/admin');
    expect(resolvePostLoginPath('//evil.example', 'staff')).toBe('/staff');
    expect(resolvePostLoginPath('/login', 'user')).toBe('/');
  });

  // Đăng nhập từ trang chủ: cán bộ/quản trị vào thẳng bàn làm việc.
  it('treats the homepage as "no preference"', () => {
    expect(resolvePostLoginPath('/', 'staff')).toBe('/staff');
    expect(resolvePostLoginPath('/', 'user')).toBe('/');
  });

  it('does not send a role into an area it cannot open', () => {
    expect(resolvePostLoginPath('/admin/users', 'user')).toBe('/');
    expect(resolvePostLoginPath('/admin?tab=audit', 'staff')).toBe('/staff');
    expect(resolvePostLoginPath('/staff', 'admin')).toBe('/admin');
    expect(resolvePostLoginPath('/admin?tab=audit', 'admin')).toBe('/admin?tab=audit');
    // '/administration' không thuộc khu vực /admin.
    expect(resolvePostLoginPath('/administration', 'user')).toBe('/administration');
  });
});
