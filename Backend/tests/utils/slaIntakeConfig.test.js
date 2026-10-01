const {
  INTAKE_SLA_HOURS,
  FALLBACK_INTAKE_HOURS,
  ISSUE_CATEGORIES,
  getIntakeHours,
  calculateIntakeDueAt,
  getSlaHours,
} = require('../../src/utils/slaConfig');

describe('slaConfig — hạn tiếp nhận (E6)', () => {
  it('triages urgent categories faster than their whole resolution SLA', () => {
    // Ngập nước và cây đổ có SLA xử lý 12 giờ. Nếu hạn tiếp nhận cũng là 24 giờ
    // thì phiếu còn chờ phân công lâu hơn cả thời gian cho phép để xử lý — vô lý.
    expect(getIntakeHours('flooding')).toBeLessThan(getSlaHours('flooding'));
    expect(getIntakeHours('tree')).toBeLessThan(getSlaHours('tree'));
  });

  it('gives routine categories a working day', () => {
    expect(getIntakeHours('pothole')).toBe(24);
    expect(getIntakeHours('garbage')).toBe(8);
  });

  it('covers every issue category', () => {
    for (const category of ISSUE_CATEGORIES) {
      expect(INTAKE_SLA_HOURS[category]).toBeGreaterThan(0);
    }
  });

  it('falls back for an unknown category', () => {
    expect(getIntakeHours('unknown')).toBe(FALLBACK_INTAKE_HOURS);
    expect(getIntakeHours(undefined)).toBe(FALLBACK_INTAKE_HOURS);
  });

  it('calculates the deadline from the report time, not from now', () => {
    const createdAt = new Date('2026-09-01T00:00:00Z');
    const due = calculateIntakeDueAt('pothole', createdAt);
    expect(due.getTime() - createdAt.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
