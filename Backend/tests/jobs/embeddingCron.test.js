jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../src/services/embeddingService', () => ({ runEmbeddingBatch: jest.fn() }));

const cron = require('node-cron');
const { runEmbeddingBatch } = require('../../src/services/embeddingService');
const { startEmbeddingCron } = require('../../src/jobs/embeddingCron');

describe('Embedding cron', () => {
  beforeEach(() => jest.clearAllMocks());

  it('runs pending embeddings in a small bounded batch', async () => {
    runEmbeddingBatch.mockResolvedValue({ scanned: 3, updated: 2, failed: 1 });
    startEmbeddingCron();
    expect(cron.schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function));
    await cron.schedule.mock.calls[0][1]();
    expect(runEmbeddingBatch).toHaveBeenCalledWith({ limit: 100, concurrency: 3 });
  });
});
