jest.mock('../../src/services/issueService');
jest.mock('../../src/services/ratingService');
jest.mock('../../src/services/assignmentService');
jest.mock('../../src/services/duplicateService');
jest.mock('../../src/services/auditService');
jest.mock('../../src/services/priorityService');
jest.mock('../../src/models/Issue');

const issueService = require('../../src/services/issueService');
const issueController = require('../../src/controllers/issueController');

const makeResponse = () => ({ json: jest.fn() });

describe('IssueController — getMyIssues()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    issueService.getMyIssues.mockResolvedValue({ issues: [], pagination: {} });
  });

  const callWith = async (query) => {
    const next = jest.fn();
    await issueController.getMyIssues(
      { user: { id: 'victim-safe-id' }, query },
      makeResponse(),
      next
    );
    expect(next).not.toHaveBeenCalled();
    return issueService.getMyIssues.mock.calls[0][0];
  };

  it('forwards the authenticated user id and supported filters', async () => {
    const args = await callWith({ page: '2', limit: '10', status: 'resolved' });

    expect(args).toEqual({
      userId: 'victim-safe-id',
      status: 'resolved',
      page: '2',
      limit: '10',
    });
  });

  it('ignores a userId sent by the client (IDOR)', async () => {
    const args = await callWith({ userId: 'other-user-id' });

    expect(args.userId).toBe('victim-safe-id');
  });

  it('drops a MongoDB operator object injected through status', async () => {
    // Express dùng query parser `qs`, nên `?status[$ne]=null` tới đây là object.
    const args = await callWith({ status: { $ne: null } });

    expect(args.status).toBeUndefined();
  });

  it('does not forward unsupported query params', async () => {
    const args = await callWith({ isDeleted: 'false', mergedInto: 'null', sort: 'voteCount' });

    expect(Object.keys(args).sort()).toEqual(['limit', 'page', 'status', 'userId']);
  });

  it('passes service errors to the error middleware', async () => {
    const error = new Error('db down');
    issueService.getMyIssues.mockRejectedValue(error);
    const next = jest.fn();

    await issueController.getMyIssues({ user: { id: 'u1' }, query: {} }, makeResponse(), next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
