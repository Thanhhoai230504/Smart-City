import { describe, it, expect } from 'vitest';
import { shouldResetScroll } from './scrollReset';

describe('shouldResetScroll', () => {
  it('goes back to the top when moving to another page', () => {
    expect(shouldResetScroll('/', '/issues', 'PUSH')).toBe(true);
    expect(shouldResetScroll('/issues', '/issues/abc', 'PUSH')).toBe(true);
    // Chuyển hướng (ProtectedRoute → /login, đăng nhập xong → trang cũ) cũng là sang trang mới.
    expect(shouldResetScroll('/report', '/login', 'REPLACE')).toBe(true);
  });

  it('leaves Back/Forward to the browser’s own scroll restoration', () => {
    expect(shouldResetScroll('/issues/abc', '/issues', 'POP')).toBe(false);
  });

  it('does not jump when only the query changes on the same page', () => {
    // Cùng pathname: đổi bộ lọc, sang ?page=2…
    expect(shouldResetScroll('/issues', '/issues', 'PUSH')).toBe(false);
    expect(shouldResetScroll('/issues', '/issues', 'REPLACE')).toBe(false);
  });
});
