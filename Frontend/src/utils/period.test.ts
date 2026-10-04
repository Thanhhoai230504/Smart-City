import { describe, it, expect } from 'vitest';
import { getPeriodRange, validateCustomPeriod, formatPeriod, PERIOD_PRESETS } from './period';

// Mốc "bây giờ" cố định, dựng bằng giờ ĐỊA PHƯƠNG để test đúng ở mọi múi giờ (máy dev
// ở UTC+7, máy CI ở UTC).
const NOW = new Date(2026, 9, 2, 14, 30); // 14:30 ngày 02/10/2026

describe('getPeriodRange', () => {
  it('this month: from the 1st at 00:00 until now', () => {
    const r = getPeriodRange({ preset: 'thisMonth' }, NOW);
    expect(r.from).toEqual(new Date(2026, 9, 1));
    expect(r.to).toEqual(NOW);
  });

  it('last month: the whole of September, to the last millisecond', () => {
    const r = getPeriodRange({ preset: 'lastMonth' }, NOW);
    expect(r.from).toEqual(new Date(2026, 8, 1));
    expect(r.to).toEqual(new Date(2026, 8, 30, 23, 59, 59, 999));
  });

  it('last month across a year boundary', () => {
    const r = getPeriodRange({ preset: 'lastMonth' }, new Date(2027, 0, 15));
    expect(r.from).toEqual(new Date(2026, 11, 1));
    expect(r.to).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
  });

  it('this quarter: Q4 starts on 1 October', () => {
    expect(getPeriodRange({ preset: 'thisQuarter' }, NOW).from).toEqual(new Date(2026, 9, 1));
  });

  it('last quarter: the whole of Q3 (July–September)', () => {
    const r = getPeriodRange({ preset: 'lastQuarter' }, NOW);
    expect(r.from).toEqual(new Date(2026, 6, 1));
    expect(r.to).toEqual(new Date(2026, 8, 30, 23, 59, 59, 999));
  });

  it('this year: from 1 January', () => {
    expect(getPeriodRange({ preset: 'thisYear' }, NOW).from).toEqual(new Date(2026, 0, 1));
  });

  it('last 30 days', () => {
    const r = getPeriodRange({ preset: 'last30' }, NOW);
    expect(Math.round((r.to.getTime() - r.from.getTime()) / 86400000)).toBe(30);
  });

  it('custom: whole days, end of the last day included', () => {
    const r = getPeriodRange({ preset: 'custom', from: '2026-09-10', to: '2026-09-20' }, NOW);
    expect(r.from).toEqual(new Date(2026, 8, 10));
    expect(r.to).toEqual(new Date(2026, 8, 20, 23, 59, 59, 999));
  });

  it('offers every preset with a Vietnamese label', () => {
    expect(PERIOD_PRESETS.map((p) => p.value)).toEqual(
      ['thisMonth', 'lastMonth', 'thisQuarter', 'lastQuarter', 'thisYear', 'last30', 'custom'],
    );
  });
});

describe('validateCustomPeriod', () => {
  it.each([
    ['', '2026-09-20', /Chọn đủ/],
    ['2026-09-20', '2026-09-10', /trước/],
    ['2025-01-01', '2026-06-01', /366/],
  ])('rejects %s – %s', (from, to, msg) => {
    expect(validateCustomPeriod(from, to)).toMatch(msg);
  });

  it('accepts a sensible range', () => {
    expect(validateCustomPeriod('2026-09-01', '2026-09-30')).toBeNull();
  });
});

describe('formatPeriod', () => {
  it('formats as dd/mm/yyyy – dd/mm/yyyy', () => {
    expect(formatPeriod({ from: new Date(2026, 8, 1), to: new Date(2026, 8, 30, 23, 59) })).toBe('01/09/2026 – 30/09/2026');
  });
});
