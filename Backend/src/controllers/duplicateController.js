const {
  findDuplicateCandidates,
  findDuplicateCandidatesForIssue,
} = require('../services/duplicateCandidateService');
const { getPublicDuplicateConfig } = require('../utils/duplicateConfig');
const {
  recordCandidateRequest,
  getDuplicateMetrics,
} = require('../services/duplicateMetricsService');

const getDuplicateConfig = (req, res) => {
  res.json({ success: true, data: { config: getPublicDuplicateConfig() } });
};

const getMetrics = (req, res) => {
  res.json({ success: true, data: { metrics: getDuplicateMetrics() } });
};

const getDuplicateCandidates = async (req, res, next) => {
  try {
    const startedAt = Date.now();
    const result = await findDuplicateCandidates(req.body);
    recordCandidateRequest({
      mode: result.meta.mode,
      providerError: result.meta.providerError,
      latencyMs: Date.now() - startedAt,
      candidateCount: result.candidates.length,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getDuplicateCandidatesForIssue = async (req, res, next) => {
  try {
    const startedAt = Date.now();
    const result = await findDuplicateCandidatesForIssue(req.params.id);
    recordCandidateRequest({
      mode: result.meta.mode,
      providerError: result.meta.providerError,
      latencyMs: Date.now() - startedAt,
      candidateCount: result.candidates.length,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDuplicateConfig,
  getMetrics,
  getDuplicateCandidates,
  getDuplicateCandidatesForIssue,
};
