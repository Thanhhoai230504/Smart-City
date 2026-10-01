import { describe, it, expect } from 'vitest';
import { canRateIssue, MAX_RATING_COMMENT_LENGTH } from './rating';
import type { Issue } from '../types';

const OWNER = 'u-owner';
const issue = (overrides: Record<string, unknown> = {}) => ({
  _id: 'i1',
  userId: { _id: OWNER, name: 'An' },
  status: 'resolved',
  mergedInto: null,
  rating: { score: null, comment: null, ratedAt: null },
  ...overrides,
}) as unknown as Issue;

/**
 * Nút đánh giá phải hiện ĐÚNG như backend (ratingService.rateIssue) sẽ nhận.
 *
 * Lỗi cũ: web chỉ cho đánh giá phiếu `resolved`, trong khi backend từ task I1 đã
 * mở cho cả phiếu `rejected` — đúng nhóm người dân dễ không hài lòng nhất lại
 * không thấy nút. Và web không kiểm tra phiếu đã gộp, nên nút hiện rồi bấm mới 404.
 */
describe('canRateIssue', () => {
  it('lets the reporter rate a resolved issue', () => {
    expect(canRateIssue(issue(), OWNER)).toBe(true);
  });

  // Đây là lỗi vừa sửa.
  it('lets the reporter rate a REJECTED issue too', () => {
    expect(canRateIssue(issue({ status: 'rejected' }), OWNER)).toBe(true);
  });

  it('works when userId is a plain string', () => {
    expect(canRateIssue(issue({ userId: OWNER }), OWNER)).toBe(true);
  });

  it.each([['reported'], ['processing']])('hides the button while the issue is %s', (status) => {
    expect(canRateIssue(issue({ status }), OWNER)).toBe(false);
  });

  it('hides the button for anyone but the reporter, and for guests', () => {
    expect(canRateIssue(issue(), 'u-other')).toBe(false);
    expect(canRateIssue(issue(), undefined)).toBe(false);
  });

  it('hides the button once the issue has been rated', () => {
    expect(canRateIssue(issue({ rating: { score: 4, comment: null, ratedAt: '2026-10-01' } }), OWNER)).toBe(false);
  });

  // Backend tìm phiếu với `mergedInto: null` — phiếu đã gộp trả 404.
  it('hides the button on a merged issue', () => {
    expect(canRateIssue(issue({ mergedInto: 'other-id' }), OWNER)).toBe(false);
  });

  it('matches the 500-character comment limit of the backend model', () => {
    expect(MAX_RATING_COMMENT_LENGTH).toBe(500);
  });
});
