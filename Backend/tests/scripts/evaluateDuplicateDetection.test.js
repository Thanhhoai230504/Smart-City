const {
  evaluate,
  chooseThreshold,
  runEvaluation,
} = require('../../src/scripts/evaluateDuplicateDetection');

const pair = (scoreLike, isDuplicate, recordedAt) => ({
  recordedAt,
  isDuplicate,
  query: {
    title: scoreLike ? 'Ngap nuoc duong A' : 'Den duong hong',
    description: scoreLike ? 'Nuoc dang cao sau mua' : 'Khong sang ban dem',
    category: scoreLike ? 'flooding' : 'streetlight',
  },
  candidate: {
    title: scoreLike ? 'Duong A ngap nuoc' : 'Rac thai ton dong',
    description: scoreLike ? 'Mua lam nuoc dang cao' : 'Rac boc mui ven duong',
    category: scoreLike ? 'flooding' : 'garbage',
    distanceMeters: scoreLike ? 20 : 450,
    createdAt: recordedAt,
  },
});

describe('Duplicate evaluation script', () => {
  const dataset = [
    pair(true, true, '2026-01-01T00:00:00.000Z'),
    pair(false, false, '2026-02-01T00:00:00.000Z'),
    pair(true, true, '2026-03-01T00:00:00.000Z'),
    pair(false, false, '2026-04-01T00:00:00.000Z'),
  ];

  it('calculates the confusion matrix and bounded quality metrics', () => {
    const metrics = evaluate(dataset, 0.45);
    expect(metrics.truePositive + metrics.falsePositive + metrics.falseNegative + metrics.trueNegative)
      .toBe(dataset.length);
    expect(metrics.precision).toBeGreaterThanOrEqual(0);
    expect(metrics.f1).toBeLessThanOrEqual(1);
  });

  it('selects a threshold from calibration data and keeps a time-based holdout', () => {
    expect(chooseThreshold(dataset).threshold).toBeGreaterThanOrEqual(0.45);

    const report = runEvaluation(dataset);
    expect(report.mode).toBe('lexical_fallback_baseline');
    expect(report.split).toEqual({ calibration: 2, test: 2, strategy: 'time_split_70_30' });
    expect(report.selectedThreshold).toBe(report.calibrationMetrics.threshold);
  });
});
