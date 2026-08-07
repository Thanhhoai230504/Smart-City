const cron = require('node-cron');
const { runPriorityBatch } = require('../services/priorityService');

const startPriorityCron = () => {
  const schedule = process.env.PRIORITY_CRON_SCHEDULE || '*/15 * * * *';
  const limit = Number.parseInt(process.env.PRIORITY_BATCH_LIMIT, 10) || 500;
  const concurrency = Number.parseInt(process.env.PRIORITY_BATCH_CONCURRENCY, 10) || 5;

  cron.schedule(schedule, async () => {
    try {
      const result = await runPriorityBatch({ limit, concurrency });
      if (result.scanned) {
        console.log(`Priority: updated ${result.updated}/${result.scanned}, failed ${result.failed}`);
      }
    } catch (error) {
      console.error('Priority cron failed:', error.message);
    }
  });

  console.log(`Priority cron scheduled (${schedule}, batch ${limit})`);
};

module.exports = { startPriorityCron };
