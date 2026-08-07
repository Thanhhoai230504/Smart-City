const crypto = require('crypto');
const Issue = require('../models/Issue');
const { getEmbeddingProvider } = require('./embeddingProvider');
const {
  recordEmbeddingCacheResult,
  recordEmbeddingProviderError,
} = require('./duplicateMetricsService');
const { EMBEDDING_VERSION } = require('../utils/duplicateConfig');

const MAX_ERROR_LENGTH = 500;
const MAX_GENERATION_ATTEMPTS = 4;
const EMBEDDING_METADATA_PROJECTION = [
  'embedding.model',
  'embedding.version',
  'embedding.dimensions',
  'embedding.sourceHash',
  'embedding.status',
  'embedding.generatedAt',
  'embedding.processingStartedAt',
  'embedding.attempts',
  'embedding.lastError',
  '+embedding.vector',
].join(' ');

const sanitizeEmbeddingText = (value) => String(value || '')
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
  .replace(/(?:\+?84|0)[\s.-]?(?:\d[\s.-]?){8,10}\d/g, '[phone]')
  .replace(/\s+/g, ' ')
  .trim();

const buildEmbeddingText = ({ category, title, description }) => [
  `category: ${sanitizeEmbeddingText(category)}`,
  `title: ${sanitizeEmbeddingText(title)}`,
  `description: ${sanitizeEmbeddingText(description)}`,
].join('\n').slice(0, 8000);

const createSourceHash = ({ text, provider }) => crypto
  .createHash('sha256')
  .update(`${provider.name}:${provider.model}:${provider.version}:${provider.dimensions}:${text}`)
  .digest('hex');

const generateIssueEmbedding = async (issueId, { force = false, provider = getEmbeddingProvider() } = {}) => {
  const issue = await Issue.findById(issueId)
    .select(`title description category ${EMBEDDING_METADATA_PROJECTION}`);
  if (!issue) return null;

  const text = buildEmbeddingText(issue);
  const sourceHash = createSourceHash({ text, provider });
  const current = issue.embedding || {};

  if (
    !force
    && current.status === 'ready'
    && current.sourceHash === sourceHash
    && current.model === provider.model
    && current.version === provider.version
    && current.vector?.length
  ) {
    recordEmbeddingCacheResult(true);
    return { issueId: issue._id, cached: true, status: 'ready', dimensions: current.vector.length };
  }

  recordEmbeddingCacheResult(false);

  const attempts = (current.attempts || 0) + 1;
  await Issue.updateOne(
    { _id: issue._id },
    {
      $set: {
        'embedding.status': 'processing',
        'embedding.model': provider.model,
        'embedding.version': provider.version || EMBEDDING_VERSION,
        'embedding.sourceHash': sourceHash,
        'embedding.lastError': null,
        'embedding.processingStartedAt': new Date(),
      },
      $inc: { 'embedding.attempts': 1 },
    }
  );

  try {
    const vector = await provider.embed(text);
    await Issue.updateOne(
      { _id: issue._id, 'embedding.sourceHash': sourceHash },
      {
        $set: {
          'embedding.vector': vector,
          'embedding.status': 'ready',
          'embedding.model': provider.model,
          'embedding.version': provider.version || EMBEDDING_VERSION,
          'embedding.dimensions': vector.length,
          'embedding.generatedAt': new Date(),
          'embedding.processingStartedAt': null,
          'embedding.lastError': null,
        },
      }
    );
    return { issueId: issue._id, cached: false, status: 'ready', dimensions: vector.length };
  } catch (error) {
    recordEmbeddingProviderError();
    await Issue.updateOne(
      { _id: issue._id, 'embedding.sourceHash': sourceHash },
      {
        $set: {
          'embedding.status': attempts >= MAX_GENERATION_ATTEMPTS ? 'failed' : 'pending',
          'embedding.lastError': String(error.message || error).slice(0, MAX_ERROR_LENGTH),
          'embedding.processingStartedAt': null,
        },
        $unset: { 'embedding.vector': 1 },
      }
    );
    throw error;
  }
};

const markIssueEmbeddingPending = async (issueId) => {
  await Issue.updateOne(
    { _id: issueId },
    {
      $set: {
        'embedding.status': 'pending',
        'embedding.sourceHash': null,
        'embedding.lastError': null,
        'embedding.attempts': 0,
        'embedding.processingStartedAt': null,
      },
      $unset: { 'embedding.vector': 1 },
    }
  );
};

const pendingIssueIds = new Set();
let queueScheduled = false;
let queueDraining = false;

const drainEmbeddingQueue = async () => {
  if (queueDraining) return;
  queueScheduled = false;
  queueDraining = true;
  try {
    while (pendingIssueIds.size) {
      const ids = [...pendingIssueIds];
      pendingIssueIds.clear();
      for (const issueId of ids) {
        try {
          await generateIssueEmbedding(issueId);
        } catch (error) {
          console.warn(`Embedding generation failed for ${issueId}:`, error.message);
        }
      }
    }
  } finally {
    queueDraining = false;
  }
};

const enqueueIssueEmbedding = (issueId) => {
  if (!issueId) return;
  pendingIssueIds.add(issueId.toString());
  if (process.env.NODE_ENV === 'test' || queueScheduled || queueDraining) return;
  queueScheduled = true;
  setImmediate(drainEmbeddingQueue);
};

const runEmbeddingBatch = async ({ limit = 100, concurrency = 3 } = {}) => {
  const safeLimit = Math.min(1000, Math.max(1, Number.parseInt(limit, 10) || 100));
  const safeConcurrency = Math.min(10, Math.max(1, Number.parseInt(concurrency, 10) || 3));
  const staleProcessingAt = new Date(Date.now() - 15 * 60 * 1000);
  const issues = await Issue.find({
    isDeleted: false,
    mergedInto: null,
    status: { $in: ['reported', 'processing'] },
    $or: [
      { 'embedding.status': { $in: [null, 'pending'] } },
      { 'embedding.status': 'failed', 'embedding.attempts': { $lt: MAX_GENERATION_ATTEMPTS } },
      { 'embedding.status': 'processing', 'embedding.processingStartedAt': { $lt: staleProcessingAt } },
    ],
  })
    .select('_id')
    .sort({ 'embedding.generatedAt': 1, createdAt: 1 })
    .limit(safeLimit)
    .lean();

  let updated = 0;
  let failed = 0;
  for (let index = 0; index < issues.length; index += safeConcurrency) {
    const chunk = issues.slice(index, index + safeConcurrency);
    const results = await Promise.allSettled(
      chunk.map((issue) => generateIssueEmbedding(issue._id))
    );
    updated += results.filter((result) => result.status === 'fulfilled').length;
    failed += results.filter((result) => result.status === 'rejected').length;
  }
  return { scanned: issues.length, updated, failed };
};

module.exports = {
  EMBEDDING_METADATA_PROJECTION,
  sanitizeEmbeddingText,
  buildEmbeddingText,
  createSourceHash,
  generateIssueEmbedding,
  markIssueEmbeddingPending,
  enqueueIssueEmbedding,
  drainEmbeddingQueue,
  runEmbeddingBatch,
};
