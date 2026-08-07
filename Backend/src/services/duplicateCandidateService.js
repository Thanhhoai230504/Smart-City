const Issue = require('../models/Issue');
const ApiError = require('../utils/apiError');
const { getEmbeddingProvider } = require('./embeddingProvider');
const {
  buildEmbeddingText,
  createSourceHash,
  enqueueIssueEmbedding,
  EMBEDDING_METADATA_PROJECTION,
} = require('./embeddingService');
const {
  DUPLICATE_VERSION,
  DUPLICATE_WEIGHTS,
  DUPLICATE_THRESHOLDS,
  DUPLICATE_CANDIDATES,
  getDuplicateConfidence,
} = require('../utils/duplicateConfig');
const { recordEmbeddingCacheResult } = require('./duplicateMetricsService');

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = ['reported', 'processing'];
const STOP_WORDS = new Set([
  'va', 'la', 'bi', 'tai', 'tren', 'duong', 'gan', 'mot', 'co', 'can',
  'dang', 'nay', 'do', 'cho', 'khu', 'vuc', 'rat', 'da', 'o', 'voi',
]);

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));
const round = (value, digits = 4) => {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
};

const normalizeForLexical = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokenize = (value) => new Set(
  normalizeForLexical(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
);

const lexicalSimilarity = (left, right) => {
  const a = tokenize(left);
  const b = tokenize(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
};

const cosineSimilarity = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || !left.length) {
    return null;
  }
  let dot = 0;
  let normLeft = 0;
  let normRight = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    normLeft += left[index] ** 2;
    normRight += right[index] ** 2;
  }
  if (!normLeft || !normRight) return 0;
  return clamp01(dot / (Math.sqrt(normLeft) * Math.sqrt(normRight)));
};

const scoreDuplicateCandidate = ({
  query,
  candidate,
  queryVector = null,
  provider = null,
  referenceDate = new Date(),
}) => {
  const candidateVector = candidate.embedding?.vector;
  const compatibleEmbedding = Boolean(
    queryVector
    && candidate.embedding?.status === 'ready'
    && candidate.embedding?.model === provider?.model
    && candidate.embedding?.version === provider?.version
    && candidateVector?.length === queryVector.length
  );
  const queryText = `${query.title} ${query.description}`;
  const candidateText = `${candidate.title} ${candidate.description}`;
  const semanticSimilarity = compatibleEmbedding
    ? cosineSimilarity(queryVector, candidateVector)
    : lexicalSimilarity(queryText, candidateText);
  const geoProximity = clamp01(1 - candidate.distanceMeters / DUPLICATE_CANDIDATES.radiusMeters);
  const sameCategory = candidate.category === query.category ? 1 : 0;
  const dayDifference = Math.abs(
    referenceDate.getTime() - new Date(candidate.createdAt).getTime()
  ) / DAY_MS;
  const recency = clamp01(1 - dayDifference / DUPLICATE_CANDIDATES.recencyWindowDays);

  const duplicateScore = round(
    semanticSimilarity * DUPLICATE_WEIGHTS.semantic
    + geoProximity * DUPLICATE_WEIGHTS.geo
    + sameCategory * DUPLICATE_WEIGHTS.category
    + recency * DUPLICATE_WEIGHTS.recency
  );

  const reasons = [
    `${compatibleEmbedding ? 'Độ giống ngữ nghĩa' : 'Độ giống từ khóa'} ${Math.round(semanticSimilarity * 100)}%`,
    `Cách vị trí báo cáo ${Math.round(candidate.distanceMeters)} m`,
  ];
  if (sameCategory) reasons.push('Cùng loại sự cố');
  if (dayDifference <= 1) reasons.push('Được báo trong vòng 24 giờ');
  else reasons.push(`Chênh lệch thời gian ${Math.round(dayDifference)} ngày`);

  return {
    duplicateScore,
    confidence: getDuplicateConfidence(duplicateScore),
    method: compatibleEmbedding ? 'embedding' : 'lexical_fallback',
    semanticSimilarity: round(semanticSimilarity),
    geoProximity: round(geoProximity),
    sameCategory: Boolean(sameCategory),
    recency: round(recency),
    reasons,
  };
};

const findGeoCandidates = async ({ query, excludeIssueId, referenceDate }) => {
  const timeWindowMs = DUPLICATE_CANDIDATES.recencyWindowDays * DAY_MS;
  const geoQuery = {
    status: { $in: OPEN_STATUSES },
    isDeleted: false,
    mergedInto: null,
    createdAt: {
      $gte: new Date(referenceDate.getTime() - timeWindowMs),
      $lte: new Date(referenceDate.getTime() + timeWindowMs),
    },
  };
  if (excludeIssueId) geoQuery._id = { $ne: excludeIssueId };

  return Issue.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [query.longitude, query.latitude] },
        key: 'geo',
        distanceField: 'distanceMeters',
        maxDistance: DUPLICATE_CANDIDATES.radiusMeters,
        spherical: true,
        query: geoQuery,
      },
    },
    { $limit: DUPLICATE_CANDIDATES.maxGeoCandidates },
    {
      $project: {
        title: 1,
        description: 1,
        category: 1,
        status: 1,
        location: 1,
        district: 1,
        latitude: 1,
        longitude: 1,
        imageUrl: 1,
        voteCount: 1,
        createdAt: 1,
        distanceMeters: 1,
        embedding: 1,
      },
    },
  ]);
};

const findDuplicateCandidates = async ({
  title,
  description,
  category,
  latitude,
  longitude,
  issueId = null,
  createdAt = null,
}, { provider = getEmbeddingProvider() } = {}) => {
  const query = {
    title: String(title || '').trim(),
    description: String(description || '').trim(),
    category,
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
  const referenceDate = createdAt ? new Date(createdAt) : new Date();
  const [candidates, sourceIssue] = await Promise.all([
    findGeoCandidates({ query, excludeIssueId: issueId, referenceDate }),
    issueId
      ? Issue.findById(issueId).select(EMBEDDING_METADATA_PROJECTION).lean()
      : Promise.resolve(null),
  ]);

  let queryVector = null;
  let providerError = null;
  const queryText = buildEmbeddingText(query);
  const sourceHash = createSourceHash({ text: queryText, provider });
  const sourceEmbedding = sourceIssue?.embedding;
  const canUseCachedSource = sourceEmbedding?.status === 'ready'
    && sourceEmbedding.sourceHash === sourceHash
    && sourceEmbedding.model === provider.model
    && sourceEmbedding.version === provider.version
    && sourceEmbedding.vector?.length;

  if (canUseCachedSource) {
    recordEmbeddingCacheResult(true);
    queryVector = sourceEmbedding.vector;
  } else if (provider.available !== false) {
    if (issueId) recordEmbeddingCacheResult(false);
    try {
      queryVector = await provider.embed(queryText);
    } catch (error) {
      providerError = error.message || 'Embedding provider unavailable';
    }
  } else {
    providerError = 'Embedding provider unavailable';
  }

  if (issueId && !canUseCachedSource) enqueueIssueEmbedding(issueId);

  const scored = candidates.map((candidate) => {
    const scoredCandidate = scoreDuplicateCandidate({
      query,
      candidate,
      queryVector,
      provider,
      referenceDate,
    });
    if (scoredCandidate.method === 'lexical_fallback') enqueueIssueEmbedding(candidate._id);

    return {
      issue: {
        _id: candidate._id,
        title: candidate.title,
        description: candidate.description,
        category: candidate.category,
        status: candidate.status,
        location: candidate.location,
        district: candidate.district,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        imageUrl: candidate.imageUrl,
        voteCount: candidate.voteCount || 0,
        createdAt: candidate.createdAt,
      },
      distanceMeters: Math.round(candidate.distanceMeters),
      ...scoredCandidate,
    };
  })
    .filter((candidate) => candidate.duplicateScore >= DUPLICATE_THRESHOLDS.minimum)
    .sort((left, right) => right.duplicateScore - left.duplicateScore
      || left.distanceMeters - right.distanceMeters)
    .slice(0, DUPLICATE_CANDIDATES.maxResults);

  const embeddingCount = scored.filter((candidate) => candidate.method === 'embedding').length;
  return {
    candidates: scored,
    meta: {
      version: DUPLICATE_VERSION,
      mode: embeddingCount === scored.length && scored.length
        ? 'embedding'
        : embeddingCount
          ? 'mixed'
          : 'lexical_fallback',
      provider: provider.name,
      model: provider.model,
      providerError,
      geoCandidatesScanned: candidates.length,
    },
  };
};

const findDuplicateCandidatesForIssue = async (issueId, options = {}) => {
  const issue = await Issue.findOne({ _id: issueId, isDeleted: false, mergedInto: null })
    .select('title description category latitude longitude createdAt')
    .lean();
  if (!issue) throw ApiError.notFound('Sự cố không tồn tại hoặc đã được gộp');
  return findDuplicateCandidates({ ...issue, issueId: issue._id }, options);
};

module.exports = {
  normalizeForLexical,
  lexicalSimilarity,
  cosineSimilarity,
  scoreDuplicateCandidate,
  findDuplicateCandidates,
  findDuplicateCandidatesForIssue,
};
