jest.mock('../../src/services/duplicateCandidateService');
jest.mock('../../src/services/duplicateMetricsService');

const candidateService = require('../../src/services/duplicateCandidateService');
const metricsService = require('../../src/services/duplicateMetricsService');
const duplicateController = require('../../src/controllers/duplicateController');

const makeResponse = () => ({ json: jest.fn() });

describe('DuplicateController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the public config without an API key or vector', () => {
    const res = makeResponse();

    duplicateController.getDuplicateConfig({}, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({
      success: true,
      data: { config: expect.objectContaining({ version: 'duplicate-v1' }) },
    }));
    expect(JSON.stringify(payload)).not.toMatch(/api.?key|embedding\.vector/i);
  });

  it('returns ranked candidates and records operational metrics', async () => {
    const result = {
      candidates: [{ issue: { _id: 'issue-1' }, score: 0.84 }],
      meta: { mode: 'embedding', providerError: false },
    };
    candidateService.findDuplicateCandidates.mockResolvedValue(result);
    const res = makeResponse();
    const next = jest.fn();

    await duplicateController.getDuplicateCandidates(
      { body: { title: 'Ngập đường', description: 'Nước dâng cao', category: 'flooding' } },
      res,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: result });
    expect(metricsService.recordCandidateRequest).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'embedding',
      providerError: false,
      candidateCount: 1,
      latencyMs: expect.any(Number),
    }));
  });

  it('uses the route issue id for an admin lookup', async () => {
    const result = { candidates: [], meta: { mode: 'lexical_fallback', providerError: true } };
    candidateService.findDuplicateCandidatesForIssue.mockResolvedValue(result);
    const res = makeResponse();

    await duplicateController.getDuplicateCandidatesForIssue(
      { params: { id: 'issue-2' } },
      res,
      jest.fn()
    );

    expect(candidateService.findDuplicateCandidatesForIssue).toHaveBeenCalledWith('issue-2');
    expect(metricsService.recordCandidateRequest).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'lexical_fallback',
      providerError: true,
      candidateCount: 0,
    }));
  });

  it('passes service errors to the error middleware', async () => {
    const error = new Error('provider failed');
    candidateService.findDuplicateCandidates.mockRejectedValue(error);
    const next = jest.fn();

    await duplicateController.getDuplicateCandidates({ body: {} }, makeResponse(), next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
