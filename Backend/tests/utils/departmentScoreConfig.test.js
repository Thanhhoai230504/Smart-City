const {
  computeDepartmentScore,
  MIN_CLOSED_FOR_SCORE,
  SCORE_VERSION,
  getPublicScoreConfig,
} = require('../../src/utils/departmentScoreConfig');

/**
 * Điểm đánh giá đơn vị là cơ sở để lãnh đạo cân nhắc khen thưởng hay phê bình,
 * nên từng nhánh phải đúng và giải thích được. Các ca ngưỡng được dựng sẵn số liệu
 * để rơi ĐÚNG vào 85 / 84 / 60 / 59 điểm.
 */
const base = (o = {}) => ({
  closed: 10, resolvedWithDue: 10, onTime: 10,
  ratingCount: 0, ratingSum: 0,
  reopened: 0, openNow: 0, overdueNow: 0, escalatedOpen: 0,
  ...o,
});

describe('computeDepartmentScore', () => {
  it('does not rank a department with too few closed tasks', () => {
    const r = computeDepartmentScore(base({ closed: MIN_CLOSED_FOR_SCORE - 1, resolvedWithDue: 1, onTime: 1 }));
    expect(r.score).toBeNull();
    expect(r.label).toBe('insufficient');
    expect(r.reasons[0]).toMatch(/cần ít nhất 5 việc/);
  });

  it('gives 100 and a commendation to a flawless department', () => {
    const r = computeDepartmentScore(base({ ratingCount: 5, ratingSum: 25, openNow: 2 }));
    expect(r.score).toBe(100);
    expect(r.label).toBe('commend');
    expect(r.version).toBe(SCORE_VERSION);
  });

  // Thiếu đánh giá không được tính là 0 điểm hài lòng — chia lại trọng số.
  it('re-distributes weight when there are too few ratings, instead of scoring them as zero', () => {
    const r = computeDepartmentScore(base({ ratingCount: 2, ratingSum: 2 }));
    const sat = r.components.find((c) => c.key === 'satisfaction');
    expect(sat.value).toBeNull();
    expect(sat.weight).toBe(0);
    expect(r.score).toBe(100);
    expect(r.reasons.join(' ')).toMatch(/chưa tính thành phần hài lòng/);
  });

  it('keeps component weights summing to 1 and points summing to the score', () => {
    const r = computeDepartmentScore(base({ onTime: 7, ratingCount: 4, ratingSum: 14, reopened: 2, openNow: 5, overdueNow: 1 }));
    const w = r.components.reduce((s, c) => s + c.weight, 0);
    const p = r.components.reduce((s, c) => s + c.points, 0);
    expect(w).toBeCloseTo(1, 2);
    expect(p).toBeCloseTo(r.score, 0);
  });

  describe('label thresholds', () => {
    // Không có đánh giá, không khiếu nại, không tồn đọng: điểm chỉ còn phụ thuộc tỷ lệ đúng hạn.
    const withOnTime = (onTime, total) => computeDepartmentScore(base({ closed: total, resolvedWithDue: total, onTime }));

    it.each([
      [23, 32, 85, 'commend'],
      [7, 10, 84, 'meet'],
      [2, 8, 60, 'meet'],
      [37, 160, 59, 'improve'],
    ])('%i/%i on time -> %i points, %s', (onTime, total, score, label) => {
      const r = withOnTime(onTime, total);
      expect(r.score).toBe(score);
      expect(r.label).toBe(label);
    });
  });

  it('does not commend a department that still has escalated open tasks', () => {
    const r = computeDepartmentScore(base({ openNow: 10, overdueNow: 0, escalatedOpen: 1 }));
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.label).toBe('meet');
    expect(r.attention[0]).toMatch(/leo cấp/);
    expect(r.reasons.join(' ')).toMatch(/hạ xuống "Đạt yêu cầu"/);
  });

  it('flags a large overdue backlog only when there is enough open work to judge', () => {
    expect(computeDepartmentScore(base({ openNow: 4, overdueNow: 2 })).attention).toHaveLength(1);
    expect(computeDepartmentScore(base({ openNow: 2, overdueNow: 2 })).attention).toHaveLength(0);
  });

  it('treats an empty backlog as full marks, not as missing data', () => {
    const r = computeDepartmentScore(base({ openNow: 0 }));
    expect(r.components.find((c) => c.key === 'noBacklog').value).toBe(1);
  });

  // Toàn việc bị từ chối (không có hạn xử lý xong): không có cơ sở chấm đúng hạn.
  it('skips the on-time component when nothing was resolved against a deadline', () => {
    const r = computeDepartmentScore(base({ resolvedWithDue: 0, onTime: 0 }));
    expect(r.components.find((c) => c.key === 'onTime').value).toBeNull();
    expect(r.reasons.join(' ')).toMatch(/chưa tính thành phần đúng hạn/);
    expect(r.score).not.toBeNull();
  });

  // Việc bị mở lại đang mở nên không nằm trong "đã đóng": tỷ lệ = mở lại / (đóng + mở lại).
  it('measures complaints against closed + reopened, so the rate never exceeds 100%', () => {
    const r = computeDepartmentScore(base({ closed: 5, reopened: 5 }));
    expect(r.components.find((c) => c.key === 'noComplaint').value).toBeCloseTo(0.5, 3);
  });

  it('counts complaints: reopened work lowers the score', () => {
    const clean = computeDepartmentScore(base()).score;
    const complained = computeDepartmentScore(base({ reopened: 5 })).score;
    expect(complained).toBeLessThan(clean);
  });

  it('clamps inconsistent data instead of going above 100', () => {
    const r = computeDepartmentScore(base({ onTime: 12, resolvedWithDue: 10 }));
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('getPublicScoreConfig', () => {
  it('exposes weights that sum to 1 and the version', () => {
    const c = getPublicScoreConfig();
    expect(Object.values(c.weights).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 5);
    expect(c.version).toBe(SCORE_VERSION);
  });
});
