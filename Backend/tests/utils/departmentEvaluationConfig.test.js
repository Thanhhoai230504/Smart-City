const {
  DECISIONS,
  DECISION_LABELS,
  EXPECTED_DECISION,
  isDeviation,
  deviationMessage,
  formatPeriodVN,
} = require('../../src/utils/departmentEvaluationConfig');

/**
 * Quyết định khen thưởng / phê bình do lãnh đạo ghi; hệ thống chỉ gợi ý. Quyết định
 * khác gợi ý thì bắt buộc nêu lý do — các test dưới khoá đúng luật "thế nào là khác".
 */
describe('departmentEvaluationConfig', () => {
  it('has four decisions, each with a Vietnamese label', () => {
    expect(DECISIONS).toEqual(['commend', 'acknowledge', 'remind', 'criticize']);
    for (const d of DECISIONS) expect(DECISION_LABELS[d]).toBeTruthy();
  });

  it('maps every suggestion label to the decision it suggests', () => {
    expect(EXPECTED_DECISION).toEqual({
      commend: 'commend', meet: 'acknowledge', improve: 'remind', insufficient: null,
    });
  });

  it.each([
    ['commend', 'commend', false],
    ['acknowledge', 'meet', false],
    ['remind', 'improve', false],
    ['commend', 'meet', true],
    ['acknowledge', 'improve', true],
    ['remind', 'commend', true],
  ])('decision %s against suggestion %s → deviates = %s', (decision, label, expected) => {
    expect(isDeviation(decision, label)).toBe(expected);
  });

  // Hệ thống không bao giờ gợi ý phê bình: phê bình luôn phải có lý do.
  it.each(['commend', 'meet', 'improve', 'insufficient'])('always treats "criticize" as a deviation (suggestion %s)', (label) => {
    expect(isDeviation('criticize', label)).toBe(true);
  });

  // Chưa đủ dữ liệu = hệ thống không có cơ sở gợi ý, nên quyết định nào cũng cần căn cứ.
  it.each(DECISIONS)('treats any decision as a deviation when data was insufficient (%s)', (decision) => {
    expect(isDeviation(decision, 'insufficient')).toBe(true);
  });

  it('explains why a reason is required', () => {
    expect(deviationMessage('commend', { label: 'improve', labelText: 'Cần nhắc nhở' }))
      .toMatch(/Cần nhắc nhở.*Khen thưởng/);
    expect(deviationMessage('remind', { label: 'insufficient', labelText: 'Chưa đủ dữ liệu' }))
      .toMatch(/chưa đủ dữ liệu/i);
  });

  it('formats a period in Vietnam time regardless of the server timezone', () => {
    expect(formatPeriodVN({
      from: new Date('2026-08-31T17:00:00.000Z'),
      to: new Date('2026-09-30T16:59:59.999Z'),
    })).toBe('01/09/2026 – 30/09/2026');
  });
});
