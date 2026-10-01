import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_REOPEN_RULES,
  getClosedAt,
  getReopenEligibility,
  getReopenRules,
  setReopenRules,
} from './reopen';
import type { Issue } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-01T12:00:00Z').getTime();
const OWNER = 'u-owner';

const closedIssue = (overrides: Partial<Issue> & Record<string, unknown> = {}) => ({
  _id: 'i1',
  userId: { _id: OWNER, name: 'An' },
  status: 'resolved',
  mergedInto: null,
  reopenCount: 0,
  statusHistory: [
    { status: 'reported', changedAt: new Date(NOW - 20 * DAY).toISOString() },
    { status: 'resolved', changedAt: new Date(NOW - 5 * DAY).toISOString() },
  ],
  ...overrides,
}) as unknown as Issue;

/**
 * Nút "mở lại" phải ẩn/hiện ĐÚNG như backend sẽ phán quyết.
 *
 * Trước đây điều kiện ở client bỏ qua cửa sổ 30 ngày: người dân gõ xong lý do,
 * bấm gửi rồi mới bị REOPEN_WINDOW_EXPIRED. Các test dưới đây đối chiếu từng
 * nhánh với Backend/src/utils/reopenConfig.js (checkCanReopen).
 */
describe('getReopenEligibility', () => {
  beforeEach(() => setReopenRules(DEFAULT_REOPEN_RULES));

  it('allows the reporter to reopen a recently closed issue, and reports days left', () => {
    const result = getReopenEligibility(closedIssue(), OWNER, NOW);
    expect(result.allowed).toBe(true);
    expect(result.daysLeft).toBe(25);
  });

  it('works when userId is a plain string rather than a populated object', () => {
    expect(getReopenEligibility(closedIssue({ userId: OWNER as never }), OWNER, NOW).allowed).toBe(true);
  });

  it.each([
    ['MERGED_ISSUE', { mergedInto: 'other' }],
    ['ISSUE_NOT_CLOSED', { status: 'processing' }],
    ['REOPEN_LIMIT_REACHED', { reopenCount: 2 }],
  ])('blocks with %s', (code, overrides) => {
    const result = getReopenEligibility(closedIssue(overrides as never), OWNER, NOW);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(code);
  });

  it('blocks someone who is not the reporter', () => {
    expect(getReopenEligibility(closedIssue(), 'u-other', NOW).reason).toBe('NOT_REPORTER');
  });

  it('blocks a guest with no user id', () => {
    expect(getReopenEligibility(closedIssue(), undefined, NOW).reason).toBe('NOT_REPORTER');
  });

  // Đây chính là lỗi cũ: nút vẫn hiện sau 30 ngày.
  it('blocks once the window has passed', () => {
    const issue = closedIssue({
      statusHistory: [{ status: 'resolved', changedAt: new Date(NOW - 31 * DAY).toISOString() }] as never,
    });
    expect(getReopenEligibility(issue, OWNER, NOW).reason).toBe('REOPEN_WINDOW_EXPIRED');
  });

  // Backend dùng `days > windowDays`, nên đúng ngày thứ 30 vẫn còn được.
  it('still allows reopening on exactly the last day, like the backend', () => {
    const issue = closedIssue({
      statusHistory: [{ status: 'resolved', changedAt: new Date(NOW - 30 * DAY).toISOString() }] as never,
    });
    const result = getReopenEligibility(issue, OWNER, NOW);
    expect(result.allowed).toBe(true);
    expect(result.daysLeft).toBe(0);
  });

  // Phiếu bị từ chối không có resolvedAt — phải tra statusHistory.
  it('measures the window for a rejected issue from its history entry', () => {
    const issue = closedIssue({
      status: 'rejected',
      resolvedAt: null,
      statusHistory: [{ status: 'rejected', changedAt: new Date(NOW - 40 * DAY).toISOString() }] as never,
    });
    expect(getReopenEligibility(issue, OWNER, NOW).reason).toBe('REOPEN_WINDOW_EXPIRED');
  });

  // Dữ liệu cũ thiếu mốc đóng: backend không chặn, client cũng không được chặn oan.
  it('does not block an old issue with no recorded closing time', () => {
    const issue = closedIssue({ statusHistory: [] as never, resolvedAt: null, updatedAt: undefined });
    const result = getReopenEligibility(issue, OWNER, NOW);
    expect(result.allowed).toBe(true);
    expect(result.daysLeft).toBeNull();
  });

  it('follows rules loaded from the server instead of hardcoded numbers', () => {
    setReopenRules({ maxCount: 1, windowDays: 3, minReasonLength: 20, maxReasonLength: 300 });
    expect(getReopenEligibility(closedIssue({ reopenCount: 1 }), OWNER, NOW).reason).toBe('REOPEN_LIMIT_REACHED');
    expect(getReopenEligibility(closedIssue(), OWNER, NOW).reason).toBe('REOPEN_WINDOW_EXPIRED');
  });
});

describe('getClosedAt', () => {
  it('uses the most recent closing entry, not the first', () => {
    const issue = closedIssue({
      statusHistory: [
        { status: 'resolved', changedAt: '2026-01-01T00:00:00Z' },
        { status: 'processing', changedAt: '2026-02-01T00:00:00Z' },
        { status: 'resolved', changedAt: '2026-03-01T00:00:00Z' },
      ] as never,
    });
    expect(getClosedAt(issue)?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('falls back to resolvedAt, then updatedAt', () => {
    expect(getClosedAt(closedIssue({ statusHistory: [] as never, resolvedAt: '2026-05-01T00:00:00Z' }))?.toISOString())
      .toBe('2026-05-01T00:00:00.000Z');
    expect(getClosedAt(closedIssue({ statusHistory: [] as never, resolvedAt: null, updatedAt: '2026-06-01T00:00:00Z' }))?.toISOString())
      .toBe('2026-06-01T00:00:00.000Z');
  });
});

describe('setReopenRules', () => {
  beforeEach(() => setReopenRules(DEFAULT_REOPEN_RULES));

  // Meta lỗi hoặc trả dữ liệu hỏng không được làm mất luật dự phòng.
  it.each([[null], [undefined], [{}], [{ maxCount: 'x' }], [{ maxCount: -1 }]])(
    'keeps the fallback rules for bad input %p',
    (input) => {
      setReopenRules(input as never);
      expect(getReopenRules()).toEqual(DEFAULT_REOPEN_RULES);
    },
  );

  it('accepts a complete, valid rule set', () => {
    const next = { maxCount: 3, windowDays: 14, minReasonLength: 5, maxReasonLength: 800 };
    setReopenRules(next);
    expect(getReopenRules()).toEqual(next);
  });
});
