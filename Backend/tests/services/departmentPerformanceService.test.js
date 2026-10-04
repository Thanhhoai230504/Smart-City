const { resolvePeriod, rankRows, toMetrics, MAX_RANGE_DAYS } = require('../../src/services/departmentPerformanceService');

/**
 * Phép gom dữ liệu được kiểm trên MongoDB thật bằng bộ dữ liệu tổng hợp đã biết
 * đáp án (26/26 chỉ số khớp — xem TIEN-DO.md Giai đoạn 6f). Ở đây kiểm các hàm thuần.
 */
describe('resolvePeriod', () => {
  const now = new Date('2026-10-02T05:00:00Z');

  it('defaults to the last 30 days', () => {
    const p = resolvePeriod({}, now);
    expect(p.to).toEqual(now);
    expect((p.to - p.from) / 86400000).toBe(30);
  });

  it('accepts an explicit period', () => {
    const p = resolvePeriod({ from: '2026-09-01T00:00:00+07:00', to: '2026-09-30T23:59:59+07:00' }, now);
    expect(p.from.toISOString()).toBe('2026-08-31T17:00:00.000Z');
  });

  it.each([
    ['an unparsable date', { from: 'abc' }, /không hợp lệ/],
    ['a start after the end', { from: '2026-09-30', to: '2026-09-01' }, /phải trước/],
    ['a period longer than a year', { from: '2025-01-01', to: '2026-06-01' }, new RegExp(String(MAX_RANGE_DAYS))],
  ])('rejects %s with a 400', (_, input, msg) => {
    try {
      resolvePeriod(input, now);
      throw new Error('không ném lỗi');
    } catch (e) {
      expect(e.statusCode).toBe(400);
      expect(e.message).toMatch(msg);
    }
  });
});

describe('toMetrics', () => {
  // Tỷ lệ đúng hạn chia cho việc CÓ hạn — bản cũ chia cho mọi việc xong nên bị kéo thấp oan.
  it('computes the on-time rate over resolved tasks that had a deadline', () => {
    expect(toMetrics({ resolved: 10, resolvedWithDue: 4, onTime: 3 }).onTimeRate).toBe(75);
  });

  it('returns null instead of 0 when there is nothing to measure', () => {
    const m = toMetrics({});
    expect([m.onTimeRate, m.avgResolutionHours, m.avgRating, m.complaintRate]).toEqual([null, null, null, null]);
  });

  it('measures complaints against closed + reopened', () => {
    expect(toMetrics({ closed: 6, reopened: 2 }).complaintRate).toBe(25);
  });
});

describe('rankRows', () => {
  const row = (name, score, onTimeRate = 80, closed = 10) => ({
    name, metrics: { onTimeRate, closed, assigned: closed }, score: { score },
  });

  it('ranks only departments with enough data, best first, and lists the rest after', () => {
    const r = rankRows([row('A', 70), row('B', null), row('C', 90), row('D', null)]);
    expect(r.map((x) => [x.name, x.rank])).toEqual([['C', 1], ['A', 2], ['B', null], ['D', null]]);
  });

  it('breaks ties by on-time rate, then by volume', () => {
    const r = rankRows([row('A', 80, 70), row('B', 80, 90), row('C', 80, 90, 20)]);
    expect(r.map((x) => x.name)).toEqual(['C', 'B', 'A']);
  });
});
