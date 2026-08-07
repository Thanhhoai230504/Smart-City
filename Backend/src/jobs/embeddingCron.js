const cron = require('node-cron');
const { runEmbeddingBatch } = require('../services/embeddingService');

const startEmbeddingCron = () => {
  const schedule = process.env.EMBEDDING_CRON_SCHEDULE || '*/5 * * * *';
  const limit = Number.parseInt(process.env.EMBEDDING_BATCH_LIMIT, 10) || 100;
  const concurrency = Number.parseInt(process.env.EMBEDDING_BATCH_CONCURRENCY, 10) || 3;

  cron.schedule(schedule, async () => {
    try {
      const result = await runEmbeddingBatch({ limit, concurrency });
      if (result.scanned) {
        console.log(`Embedding: updated ${result.updated}/${result.scanned}, failed ${result.failed}`);
      }
    } catch (error) {
      console.error('Embedding cron failed:', error.message);
    }
  });

  console.log(`Embedding cron scheduled (${schedule}, batch ${limit})`);
};

module.exports = { startEmbeddingCron };
