const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Issue = require('../models/Issue');
const { generateIssueEmbedding } = require('../services/embeddingService');
const { configureDnsServers } = require('../config/dns');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const backfillIssueEmbeddings = async ({ batchSize = 50, concurrency = 3 } = {}) => {
  const safeBatchSize = Math.min(500, Math.max(1, Number.parseInt(batchSize, 10) || 50));
  const safeConcurrency = Math.min(10, Math.max(1, Number.parseInt(concurrency, 10) || 3));
  let lastId = null;
  let scanned = 0;
  let updated = 0;
  let failed = 0;

  while (true) {
    const filter = {
      isDeleted: false,
      mergedInto: null,
      status: { $in: ['reported', 'processing'] },
    };
    if (lastId) filter._id = { $gt: lastId };
    const issues = await Issue.find(filter)
      .select('_id')
      .sort({ _id: 1 })
      .limit(safeBatchSize)
      .lean();
    if (!issues.length) break;

    for (let index = 0; index < issues.length; index += safeConcurrency) {
      const chunk = issues.slice(index, index + safeConcurrency);
      const results = await Promise.allSettled(
        chunk.map((issue) => generateIssueEmbedding(issue._id))
      );
      updated += results.filter((result) => result.status === 'fulfilled').length;
      failed += results.filter((result) => result.status === 'rejected').length;
    }

    scanned += issues.length;
    lastId = issues[issues.length - 1]._id;
    console.log(`Embedding backfill: ${scanned} scanned, ${updated} updated, ${failed} failed`);
  }
  return { scanned, updated, failed };
};

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  configureDnsServers();
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await backfillIssueEmbeddings({
    batchSize: process.env.EMBEDDING_BACKFILL_BATCH_SIZE,
    concurrency: process.env.EMBEDDING_BATCH_CONCURRENCY,
  });
  console.log('Embedding backfill completed:', result);
};

if (require.main === module) {
  run()
    .catch((error) => {
      console.error('Embedding backfill failed:', error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { backfillIssueEmbeddings };
