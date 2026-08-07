const PRIORITY_VERSION = 'priority-v1';

const PRIORITY_WEIGHTS = Object.freeze({
  severity: 0.30,
  ageSla: 0.25,
  votes: 0.15,
  nearbyDensity: 0.15,
  sensitivePlace: 0.15,
});

const CATEGORY_SEVERITY = Object.freeze({
  flooding: 100,
  tree: 100,
  pothole: 75,
  streetlight: 65,
  garbage: 60,
  other: 50,
});

const PRIORITY_THRESHOLDS = Object.freeze({
  critical: 80,
  high: 60,
  medium: 35,
});

const PRIORITY_GEO = Object.freeze({
  nearbyRadiusMeters: 500,
  nearbyDensityCap: 10,
  sensitiveRadiusMeters: 500,
});

const PRIORITY_VOTE_CAP = 50;

const getPriorityLevel = (score) => {
  if (score >= PRIORITY_THRESHOLDS.critical) return 'critical';
  if (score >= PRIORITY_THRESHOLDS.high) return 'high';
  if (score >= PRIORITY_THRESHOLDS.medium) return 'medium';
  return 'low';
};

const getPublicPriorityConfig = () => ({
  version: PRIORITY_VERSION,
  weights: PRIORITY_WEIGHTS,
  thresholds: PRIORITY_THRESHOLDS,
  geo: PRIORITY_GEO,
  voteCap: PRIORITY_VOTE_CAP,
});

module.exports = {
  PRIORITY_VERSION,
  PRIORITY_WEIGHTS,
  CATEGORY_SEVERITY,
  PRIORITY_THRESHOLDS,
  PRIORITY_GEO,
  PRIORITY_VOTE_CAP,
  getPriorityLevel,
  getPublicPriorityConfig,
};
