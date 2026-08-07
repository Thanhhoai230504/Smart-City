jest.mock('../../src/services/priorityService');
jest.mock('../../src/services/auditService');

const priorityService = require('../../src/services/priorityService');
const auditService = require('../../src/services/auditService');
const priorityController = require('../../src/controllers/priorityController');

const makeResponse = () => ({ json: jest.fn() });

describe('PriorityController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auditService.recordAudit.mockResolvedValue(null);
  });

  it('returns the public scoring config', () => {
    const res = makeResponse();
    priorityController.getPriorityConfig({}, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: { config: expect.objectContaining({ version: 'priority-v1' }) },
    }));
  });

  it('recalculates one issue and records a manual audit entry', async () => {
    priorityService.recalculateIssuePriority.mockResolvedValue({
      _id: 'issue-1',
      priorityScore: 82.5,
      priorityLevel: 'critical',
      priorityVersion: 'priority-v1',
    });
    const req = {
      params: { id: 'issue-1' },
      user: { id: 'admin-1', role: 'admin' },
    };
    const res = makeResponse();
    const next = jest.fn();

    await priorityController.recalculatePriority(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(auditService.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'issue.priority_recalculated',
      entityId: 'issue-1',
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('passes not-found errors to the error middleware', async () => {
    priorityService.recalculateIssuePriority.mockResolvedValue(null);
    const req = { params: { id: 'missing' }, user: { id: 'admin-1', role: 'admin' } };
    const next = jest.fn();

    await priorityController.recalculatePriority(req, makeResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('runs a bounded batch using request parameters', async () => {
    const result = { scanned: 20, updated: 19, failed: 1, version: 'priority-v1' };
    priorityService.runPriorityBatch.mockResolvedValue(result);
    const res = makeResponse();

    await priorityController.recalculatePriorityBatch(
      { body: { limit: 20, concurrency: 3 } },
      res,
      jest.fn()
    );

    expect(priorityService.runPriorityBatch).toHaveBeenCalledWith({ limit: 20, concurrency: 3 });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: result }));
  });
});
