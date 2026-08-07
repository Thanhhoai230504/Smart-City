const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Issue = require('../models/Issue');
const Place = require('../models/Place');
const { recalculateIssuePriority } = require('../services/priorityService');
const { configureDnsServers } = require('../config/dns');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const OPEN_STATUSES = ['reported', 'processing'];

const backfillPriorityScores = async ({ batchSize = 200, concurrency = 5 } = {}) => {
  const safeBatchSize = Math.min(1000, Math.max(1, Number.parseInt(batchSize, 10) || 200));
  const safeConcurrency = Math.min(20, Math.max(1, Number.parseInt(concurrency, 10) || 5));
  let lastId = null;
  let scanned = 0;
  let updated = 0;
  let failed = 0;

  await Promise.all([Issue.createIndexes(), Place.createIndexes()]);

  while (true) {
    const filter = {
      isDeleted: false,
      mergedInto: null,
      status: { $in: OPEN_STATUSES },
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
        chunk.map((issue) => recalculateIssuePriority(issue._id))
      );
      updated += results.filter((result) => result.status === 'fulfilled').length;
      failed += results.filter((result) => result.status === 'rejected').length;
    }

    scanned += issues.length;
    lastId = issues[issues.length - 1]._id;
    console.log(`Priority backfill: ${scanned} scanned, ${updated} updated, ${failed} failed`);
  }

  return { scanned, updated, failed };
};

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  configureDnsServers();
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await backfillPriorityScores({
    batchSize: process.env.PRIORITY_BACKFILL_BATCH_SIZE,
    concurrency: process.env.PRIORITY_BATCH_CONCURRENCY,
  });
  console.log('Priority backfill completed:', result);
};

if (require.main === module) {
  run()
    .catch((error) => {
      console.error('Priority backfill failed:', error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { backfillPriorityScores };
