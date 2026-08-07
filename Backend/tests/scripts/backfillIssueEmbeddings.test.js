jest.mock('../../src/models/Issue');
jest.mock('../../src/services/embeddingService');

const Issue = require('../../src/models/Issue');
const embeddingService = require('../../src/services/embeddingService');
const { backfillIssueEmbeddings } = require('../../src/scripts/backfillIssueEmbeddings');

const queryResult = (items) => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(items),
});

describe('Embedding backfill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('paginates by id, bounds concurrency work and continues after one failure', async () => {
    Issue.find
      .mockReturnValueOnce(queryResult([{ _id: '1' }, { _id: '2' }, { _id: '3' }]))
      .mockReturnValueOnce(queryResult([]));
    embeddingService.generateIssueEmbedding.mockImplementation(async (id) => {
      if (id === '2') throw new Error('temporary provider error');
      return { issueId: id, status: 'ready' };
    });

    const result = await backfillIssueEmbeddings({ batchSize: 3, concurrency: 2 });

    expect(result).toEqual({ scanned: 3, updated: 2, failed: 1 });
    expect(embeddingService.generateIssueEmbedding).toHaveBeenCalledTimes(3);
    expect(Issue.find.mock.calls[1][0]._id).toEqual({ $gt: '3' });
  });
});
