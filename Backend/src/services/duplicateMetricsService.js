const metrics = {
  startedAt: new Date(),
  requests: 0,
  embeddingRequests: 0,
  mixedRequests: 0,
  fallbackRequests: 0,
  providerErrors: 0,
  cacheHits: 0,
  cacheMisses: 0,
  totalLatencyMs: 0,
  totalCandidates: 0,
  confirmations: 0,
  merges: 0,
};

const recordCandidateRequest = ({ mode, providerError, latencyMs, candidateCount }) => {
  metrics.requests += 1;
  if (mode === 'embedding') metrics.embeddingRequests += 1;
  else if (mode === 'mixed') metrics.mixedRequests += 1;
  else metrics.fallbackRequests += 1;
  if (providerError) metrics.providerErrors += 1;
  metrics.totalLatencyMs += Math.max(0, latencyMs || 0);
  metrics.totalCandidates += Math.max(0, candidateCount || 0);
};

const recordDuplicateConfirmation = () => {
  metrics.confirmations += 1;
};

const recordDuplicateMerge = () => {
  metrics.merges += 1;
};

const recordEmbeddingCacheResult = (hit) => {
  if (hit) metrics.cacheHits += 1;
  else metrics.cacheMisses += 1;
};

const recordEmbeddingProviderError = () => {
  metrics.providerErrors += 1;
};

const getDuplicateMetrics = () => ({
  ...metrics,
  avgLatencyMs: metrics.requests ? Math.round(metrics.totalLatencyMs / metrics.requests) : 0,
  avgCandidates: metrics.requests
    ? Math.round((metrics.totalCandidates / metrics.requests) * 100) / 100
    : 0,
  fallbackRate: metrics.requests
    ? Math.round((metrics.fallbackRequests / metrics.requests) * 10000) / 100
    : 0,
  providerErrorRate: metrics.requests
    ? Math.round((metrics.providerErrors / metrics.requests) * 10000) / 100
    : 0,
  cacheHitRate: metrics.cacheHits + metrics.cacheMisses
    ? Math.round((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 10000) / 100
    : 0,
  confirmationRate: metrics.requests
    ? Math.round((metrics.confirmations / metrics.requests) * 10000) / 100
    : 0,
  mergeRate: metrics.requests
    ? Math.round((metrics.merges / metrics.requests) * 10000) / 100
    : 0,
});

module.exports = {
  recordCandidateRequest,
  recordDuplicateConfirmation,
  recordDuplicateMerge,
  recordEmbeddingCacheResult,
  recordEmbeddingProviderError,
  getDuplicateMetrics,
};
