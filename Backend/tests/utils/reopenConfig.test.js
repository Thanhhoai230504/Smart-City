const {
  MAX_REOPEN_COUNT,
  REOPEN_WINDOW_DAYS,
  getClosedAt,
  checkCanReopen,
} = require('../../src/utils/reopenConfig');

const now = new Date('2026-10-01T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const closedIssue = (overrides = {}) => ({
  _id: 'i1',
  userId: { _id: 'reporter1' },
  status: 'resolved',
  reopenCount: 0,
  mergedInto: null,
  statusHistory: [
    { status: 'processing', changedAt: new Date(now - 10 * DAY) },
    { status: 'resolved', changedAt: new Date(now - 2 * DAY) },
  ],
  ...overrides,
});

describe('reopenConfig.getClosedAt', () => {
  it('uses the most recent close entry in statusHistory', () => {
    expect(getClosedAt(closedIssue())).toEqual(new Date(now - 2 * DAY));
  });

  // Phiếu bị 'rejected' KHÔNG có resolvedAt, nên không thể chỉ dựa vào field đó.
  it('works for a rejected issue that has no resolvedAt', () => {
    const issue = closedIssue({
      status: 'rejected',
      resolvedAt: null,
      statusHistory: [{ status: 'rejected', changedAt: new Date(now - 3 * DAY) }],
    });
    expect(getClosedAt(issue)).toEqual(new Date(now - 3 * DAY));
  });

  it('falls back to resolvedAt when history is missing', () => {
    const at = new Date(now - 5 * DAY);
    expect(getClosedAt({ statusHistory: [], resolvedAt: at })).toEqual(at);
  });

  it('falls back to updatedAt as a last resort for legacy rows', () => {
    const at = new Date(now - 7 * DAY);
    expect(getClosedAt({ updatedAt: at })).toEqual(at);
  });

  it('returns null when nothing is known', () => {
    expect(getClosedAt({})).toBeNull();
  });
});

describe('reopenConfig.checkCanReopen', () => {
  it('allows the reporter to reopen a recently resolved issue', () => {
    expect(checkCanReopen(closedIssue(), 'reporter1', now)).toEqual({ ok: true });
  });

  it('allows reopening a rejected issue too', () => {
    const issue = closedIssue({
      status: 'rejected',
      statusHistory: [{ status: 'rejected', changedAt: new Date(now - 1 * DAY) }],
    });
    expect(checkCanReopen(issue, 'reporter1', now)).toEqual({ ok: true });
  });

  // Mỗi nhánh từ chối trả một mã riêng để app mobile hiện đúng màn hình/thông
  // báo mà không phải so khớp chuỗi tiếng Việt.
  it.each([
    ['NOT_REPORTER', closedIssue(), 'someoneElse'],
    ['ISSUE_NOT_CLOSED', closedIssue({ status: 'processing' }), 'reporter1'],
    ['REOPEN_LIMIT_REACHED', closedIssue({ reopenCount: MAX_REOPEN_COUNT }), 'reporter1'],
    ['MERGED_ISSUE', closedIssue({ mergedInto: 'other1' }), 'reporter1'],
  ])('refuses with code %s', (code, issue, userId) => {
    expect(checkCanReopen(issue, userId, now)).toMatchObject({ ok: false, code });
  });

  it('refuses once the reopen window has expired', () => {
    const issue = closedIssue({
      statusHistory: [{
        status: 'resolved',
        changedAt: new Date(now - (REOPEN_WINDOW_DAYS + 1) * DAY),
      }],
    });
    expect(checkCanReopen(issue, 'reporter1', now)).toMatchObject({
      ok: false, code: 'REOPEN_WINDOW_EXPIRED',
    });
  });

  it('still allows reopening exactly on the last day of the window', () => {
    const issue = closedIssue({
      statusHistory: [{
        status: 'resolved',
        changedAt: new Date(now - REOPEN_WINDOW_DAYS * DAY),
      }],
    });
    expect(checkCanReopen(issue, 'reporter1', now)).toEqual({ ok: true });
  });

  // Phiếu cũ không có mốc đóng nào thì không được chặn oan vì cửa sổ thời gian.
  it('does not block on the window when the close time is unknown', () => {
    const issue = closedIssue({ statusHistory: [], resolvedAt: null, updatedAt: null });
    expect(checkCanReopen(issue, 'reporter1', now)).toEqual({ ok: true });
  });

  it('compares ids across ObjectId and string without false negatives', () => {
    const issue = closedIssue({ userId: { _id: { toString: () => 'reporter1' } } });
    expect(checkCanReopen(issue, { toString: () => 'reporter1' }, now)).toEqual({ ok: true });
  });

  it('refuses a missing issue', () => {
    expect(checkCanReopen(null, 'reporter1', now)).toMatchObject({ ok: false, code: 'ISSUE_NOT_FOUND' });
  });
});
