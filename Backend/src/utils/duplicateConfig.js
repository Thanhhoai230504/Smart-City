const DUPLICATE_VERSION = 'duplicate-v1';
const EMBEDDING_VERSION = 'embedding-v1';

const DUPLICATE_WEIGHTS = Object.freeze({
  semantic: 0.65,
  geo: 0.20,
  category: 0.10,
  recency: 0.05,
});

const DUPLICATE_THRESHOLDS = Object.freeze({
  high: 0.82,
  possible: 0.70,
  minimum: 0.45,
});

const DUPLICATE_CANDIDATES = Object.freeze({
  radiusMeters: 500,
  maxGeoCandidates: 40,
  maxResults: 6,
  recencyWindowDays: 30,
});

const EMBEDDING_CONFIG = Object.freeze({
  provider: process.env.EMBEDDING_PROVIDER || 'gemini',
  model: process.env.EMBEDDING_MODEL || 'gemini-embedding-001',
  dimensions: Math.min(3072, Math.max(128, Number.parseInt(process.env.EMBEDDING_DIMENSIONS, 10) || 768)),
  timeoutMs: Math.min(15000, Math.max(1000, Number.parseInt(process.env.EMBEDDING_TIMEOUT_MS, 10) || 3500)),
  maxAttempts: Math.min(3, Math.max(1, Number.parseInt(process.env.EMBEDDING_MAX_ATTEMPTS, 10) || 2)),
});

const getDuplicateConfidence = (score) => {
  if (score >= DUPLICATE_THRESHOLDS.high) return 'high';
  if (score >= DUPLICATE_THRESHOLDS.possible) return 'possible';
  return 'low';
};

const getPublicDuplicateConfig = () => ({
  version: DUPLICATE_VERSION,
  embeddingVersion: EMBEDDING_VERSION,
  weights: DUPLICATE_WEIGHTS,
  thresholds: DUPLICATE_THRESHOLDS,
  candidates: DUPLICATE_CANDIDATES,
  provider: EMBEDDING_CONFIG.provider,
  model: EMBEDDING_CONFIG.model,
  dimensions: EMBEDDING_CONFIG.dimensions,
});

module.exports = {
  DUPLICATE_VERSION,
  EMBEDDING_VERSION,
  DUPLICATE_WEIGHTS,
  DUPLICATE_THRESHOLDS,
  DUPLICATE_CANDIDATES,
  EMBEDDING_CONFIG,
  getDuplicateConfidence,
  getPublicDuplicateConfig,
};
