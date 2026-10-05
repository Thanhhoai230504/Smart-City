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

describe('IssueController — toggleVote()', () => {
  const Issue = require('../../src/models/Issue');
  const { enqueuePriorityRecalculation } = require('../../src/services/priorityService');

  /** Mock Mongoose Query: .select() trả về chính nó, await ra `result`. */
  const mockQuery = (result) => {
    const q = { then: (res, rej) => Promise.resolve(result).then(res, rej) };
    q.select = jest.fn(() => q);
    return q;
  };
  const callToggle = async (userId = 'u1') => {
    const res = { json: jest.fn(), status: jest.fn() };
    res.status.mockReturnValue(res);
    const next = jest.fn();
    await issueController.toggleVote({ params: { id: 'issue1' }, user: { id: userId } }, res, next);
    expect(next).not.toHaveBeenCalled();
    return res;
  };

  beforeEach(() => jest.clearAllMocks());

  // Lệnh thêm chỉ khớp khi người này CHƯA ủng hộ → $inc luôn đi cùng đúng một
  // thay đổi của mảng, hai người bấm cùng lúc không làm lệch voteCount.
  it('adds a vote with one conditional write', async () => {
    Issue.findOneAndUpdate.mockReturnValueOnce(mockQuery({ _id: 'issue1', voteCount: 4 }));

    const res = await callToggle();

    expect(Issue.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'issue1', isDeleted: false, mergedInto: null, votes: { $ne: 'u1' } },
      { $addToSet: { votes: 'u1' }, $inc: { voteCount: 1 } },
      { new: true }
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { voted: true, voteCount: 4 } });
    expect(enqueuePriorityRecalculation).toHaveBeenCalledWith('issue1');
  });

  it('removes the vote when the user had already voted', async () => {
    Issue.findOneAndUpdate
      .mockReturnValueOnce(mockQuery(null))
      .mockReturnValueOnce(mockQuery({ _id: 'issue1', voteCount: 3 }));

    const res = await callToggle();

    expect(Issue.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: 'issue1', isDeleted: false, mergedInto: null, votes: 'u1' },
      { $pull: { votes: 'u1' }, $inc: { voteCount: -1 } },
      { new: true }
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { voted: false, voteCount: 3 } });
  });

  it('404 for a missing issue, 400 for a merged one', async () => {
    Issue.findOneAndUpdate.mockReturnValue(mockQuery(null));
    Issue.findOne.mockReturnValueOnce(mockQuery(null));
    const missing = await callToggle();
    expect(missing.status).toHaveBeenCalledWith(404);

    Issue.findOne.mockReturnValueOnce(mockQuery({ mergedInto: 'other', votes: [] }));
    const merged = await callToggle();
    expect(merged.status).toHaveBeenCalledWith(400);
  });

  it('returns the current state when a parallel request of the same user won the race', async () => {
    Issue.findOneAndUpdate.mockReturnValue(mockQuery(null));
    Issue.findOne.mockReturnValueOnce(mockQuery({ mergedInto: null, votes: ['u1'], voteCount: 7 }));

    const res = await callToggle();

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { voted: true, voteCount: 7 } });
    expect(enqueuePriorityRecalculation).not.toHaveBeenCalled();
  });
});
