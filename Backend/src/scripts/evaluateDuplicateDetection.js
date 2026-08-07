const pairs = require('../data/duplicateEvaluationPairs.json');
const { scoreDuplicateCandidate } = require('../services/duplicateCandidateService');
const { DUPLICATE_THRESHOLDS } = require('../utils/duplicateConfig');

const evaluate = (dataset, threshold = DUPLICATE_THRESHOLDS.possible) => {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let trueNegative = 0;

  for (const pair of dataset) {
    const scored = scoreDuplicateCandidate({
      query: pair.query,
      candidate: pair.candidate,
      referenceDate: new Date(pair.recordedAt),
    });
    const predicted = scored.duplicateScore >= threshold;
    if (predicted && pair.isDuplicate) truePositive += 1;
    else if (predicted) falsePositive += 1;
    else if (pair.isDuplicate) falseNegative += 1;
    else trueNegative += 1;
  }

  const precision = truePositive / Math.max(1, truePositive + falsePositive);
  const recall = truePositive / Math.max(1, truePositive + falseNegative);
  const f1 = 2 * precision * recall / Math.max(Number.EPSILON, precision + recall);
  return { threshold, truePositive, falsePositive, falseNegative, trueNegative, precision, recall, f1 };
};

const chooseThreshold = (dataset) => {
  const thresholds = Array.from({ length: 10 }, (_, index) => 0.45 + index * 0.05);
  return thresholds
    .map((threshold) => evaluate(dataset, Number(threshold.toFixed(2))))
    .sort((left, right) => (
      right.f1 - left.f1
      || right.precision - left.precision
      || right.recall - left.recall
      || right.threshold - left.threshold
    ))[0];
};

const runEvaluation = (dataset = pairs) => {
  const sorted = [...dataset]
    .sort((left, right) => new Date(left.recordedAt) - new Date(right.recordedAt));
  const splitIndex = Math.max(1, Math.floor(sorted.length * 0.7));
  const calibration = sorted.slice(0, splitIndex);
  const test = sorted.slice(splitIndex);
  const selectedCalibration = chooseThreshold(calibration);

  return {
    mode: 'lexical_fallback_baseline',
    note: 'Fixture khoi tao nho; can du lieu da gan nhan thuc te truoc khi thay threshold production.',
    datasetSize: sorted.length,
    split: { calibration: calibration.length, test: test.length, strategy: 'time_split_70_30' },
    configuredThreshold: DUPLICATE_THRESHOLDS.possible,
    selectedThreshold: selectedCalibration.threshold,
    calibrationMetrics: selectedCalibration,
    testMetrics: evaluate(test, selectedCalibration.threshold),
    configuredThresholdTestMetrics: evaluate(test),
  };
};

if (require.main === module) {
  console.log(JSON.stringify(runEvaluation(), null, 2));
}

module.exports = { evaluate, chooseThreshold, runEvaluation };
