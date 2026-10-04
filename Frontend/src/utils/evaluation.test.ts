import { describe, expect, it } from 'vitest';
import {
  EVALUATION_DECISIONS,
  EVALUATION_LIMITS,
  EXPECTED_DECISION,
  deviationHint,
  isDeviation,
  isOpenPeriod,
  suggestedDecision,
  validateEvaluationForm,
} from './evaluation';

/**
 * Luật phải khớp backend (utils/departmentEvaluationConfig.js): hệ thống gợi ý, lãnh
 * đạo quyết; quyết định khác gợi ý phải có lý do. Backend vẫn kiểm lại lần cuối.
 */
describe('evaluation decisions', () => {
  it('lists four decisions in order, each with a label and a description', () => {
    expect(EVALUATION_DECISIONS.map((d) => d.value)).toEqual(['commend', 'acknowledge', 'remind', 'criticize']);
    for (const d of EVALUATION_DECISIONS) {
      expect(d.label).toBeTruthy();
      expect(d.description).toBeTruthy();
    }
  });

  it('maps suggestions to decisions like the backend', () => {
    expect(EXPECTED_DECISION).toEqual({ commend: 'commend', meet: 'acknowledge', improve: 'remind', insufficient: null });
    expect(suggestedDecision('meet')).toBe('acknowledge');
    expect(suggestedDecision('insufficient')).toBeNull();
  });

  it.each([
    ['commend', 'commend', false],
    ['remind', 'improve', false],
    ['commend', 'improve', true],
    ['criticize', 'improve', true],
    ['acknowledge', 'insufficient', true],
  ] as const)('decision %s vs suggestion %s → deviates %s', (decision, label, expected) => {
    expect(isDeviation(decision, label)).toBe(expected);
  });

  it('explains the deviation in plain words', () => {
    expect(deviationHint('commend', 'improve', 'Cần nhắc nhở')).toMatch(/Cần nhắc nhở/);
    expect(deviationHint('remind', 'insufficient', 'Chưa đủ dữ liệu')).toMatch(/chưa đủ dữ liệu/i);
    expect(deviationHint('remind', 'improve', 'Cần nhắc nhở')).toBeNull();
  });
});

describe('validateEvaluationForm', () => {
  const ok = { decision: 'remind' as const, content: 'Còn nhiều việc trễ hạn cần khắc phục.', documentNumber: '', deviationReason: '' };

  it('passes a decision that follows the suggestion', () => {
    expect(validateEvaluationForm(ok, 'improve')).toEqual({});
  });

  it('requires a decision and enough content', () => {
    expect(validateEvaluationForm({ ...ok, decision: null }, 'improve')).toHaveProperty('decision');
    expect(validateEvaluationForm({ ...ok, content: 'ngắn' }, 'improve')).toHaveProperty('content');
    expect(validateEvaluationForm({ ...ok, content: 'x'.repeat(EVALUATION_LIMITS.contentMax + 1) }, 'improve')).toHaveProperty('content');
  });

  it('requires a reason only when the decision differs from the suggestion', () => {
    expect(validateEvaluationForm({ ...ok, decision: 'commend' }, 'improve')).toHaveProperty('deviationReason');
    expect(validateEvaluationForm({ ...ok, decision: 'commend', deviationReason: 'Có thành tích đột xuất trong mùa mưa bão.' }, 'improve')).toEqual({});
  });

  it('limits the document number', () => {
    expect(validateEvaluationForm({ ...ok, documentNumber: 'x'.repeat(EVALUATION_LIMITS.documentMax + 1) }, 'improve')).toHaveProperty('documentNumber');
  });
});

describe('isOpenPeriod', () => {
  const now = new Date('2026-10-04T05:00:00Z');

  it('flags a period that runs up to now (still changing)', () => {
    expect(isOpenPeriod(new Date('2026-10-04T04:30:00Z'), now)).toBe(true);
  });

  it('accepts a period that has already closed', () => {
    expect(isOpenPeriod(new Date('2026-09-30T16:59:59.999Z'), now)).toBe(false);
  });
});
