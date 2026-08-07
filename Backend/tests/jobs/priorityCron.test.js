jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../src/services/priorityService', () => ({ runPriorityBatch: jest.fn() }));

const cron = require('node-cron');
const { runPriorityBatch } = require('../../src/services/priorityService');
const { startPriorityCron } = require('../../src/jobs/priorityCron');

describe('Priority cron', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('registers the default schedule and runs a bounded batch', async () => {
    runPriorityBatch.mockResolvedValue({ scanned: 2, updated: 2, failed: 0 });
    startPriorityCron();

    expect(cron.schedule).toHaveBeenCalledWith('*/15 * * * *', expect.any(Function));
    const callback = cron.schedule.mock.calls[0][1];
    await callback();

    expect(runPriorityBatch).toHaveBeenCalledWith({ limit: 500, concurrency: 5 });
  });

  it('honors environment overrides', () => {
    process.env.PRIORITY_CRON_SCHEDULE = '0 * * * *';
    process.env.PRIORITY_BATCH_LIMIT = '120';
    process.env.PRIORITY_BATCH_CONCURRENCY = '8';

    startPriorityCron();
    expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
  });
});
