const metricsService = require('../../src/services/duplicateMetricsService');

describe('DuplicateMetricsService', () => {
  it('exposes latency, fallback, cache and decision rates without raw data', () => {
    const before = metricsService.getDuplicateMetrics();
    metricsService.recordCandidateRequest({
      mode: 'lexical_fallback',
      providerError: true,
      latencyMs: 120,
      candidateCount: 2,
    });
    metricsService.recordEmbeddingCacheResult(true);
    metricsService.recordEmbeddingCacheResult(false);
    metricsService.recordDuplicateConfirmation();
    metricsService.recordDuplicateMerge();

    const after = metricsService.getDuplicateMetrics();
    expect(after.requests).toBe(before.requests + 1);
    expect(after.avgLatencyMs).toBe(120);
    expect(after.avgCandidates).toBe(2);
    expect(after.cacheHitRate).toBe(50);
    expect(after.confirmationRate).toBe(100);
    expect(after.mergeRate).toBe(100);
    expect(JSON.stringify(after)).not.toMatch(/vector|description|title/i);
  });
});
