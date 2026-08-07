const Issue = require('../models/Issue');
const Place = require('../models/Place');
const { getSlaHours } = require('../utils/slaConfig');
const {
  PRIORITY_VERSION,
  PRIORITY_WEIGHTS,
  CATEGORY_SEVERITY,
  PRIORITY_GEO,
  PRIORITY_VOTE_CAP,
  getPriorityLevel,
} = require('../utils/priorityConfig');

const HOUR_MS = 60 * 60 * 1000;
const OPEN_STATUSES = ['reported', 'processing'];
const SENSITIVE_PLACE_TYPES = ['hospital', 'school'];

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value, digits = 1) => {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
};

const calculateAgeSlaFactor = (issue, now) => {
  const createdAt = new Date(issue.createdAt || now);
  const ageHours = Math.max(0, (now.getTime() - createdAt.getTime()) / HOUR_MS);
  const defaultSlaHours = getSlaHours(issue.category);

  if (issue.dueAt) {
    const dueAt = new Date(issue.dueAt);
    if (now >= dueAt) {
      return {
        score: 100,
        rawValue: {
          ageHours: round(ageHours),
          overdueHours: round((now.getTime() - dueAt.getTime()) / HOUR_MS),
          dueAt,
        },
        message: `Đã quá hạn ${round((now.getTime() - dueAt.getTime()) / HOUR_MS)} giờ`,
      };
    }

    const assignedAt = issue.assignedAt ? new Date(issue.assignedAt) : createdAt;
    const totalMs = Math.max(HOUR_MS, dueAt.getTime() - assignedAt.getTime());
    const elapsedMs = Math.max(0, now.getTime() - assignedAt.getTime());
    const score = clamp((elapsedMs / totalMs) * 100);
    return {
      score,
      rawValue: {
        ageHours: round(ageHours),
        hoursUntilDue: round((dueAt.getTime() - now.getTime()) / HOUR_MS),
        dueAt,
      },
      message: `Đã dùng ${round(score)}% thời gian SLA`,
    };
  }

  const score = clamp((ageHours / defaultSlaHours) * 100);
  return {
    score,
    rawValue: { ageHours: round(ageHours), referenceSlaHours: defaultSlaHours },
    message: `Tồn đọng ${round(ageHours)} giờ (mốc tham chiếu ${defaultSlaHours} giờ)`,
  };
};

const calculateSensitivePlaceFactor = (nearestSensitivePlace) => {
  if (!nearestSensitivePlace || !Number.isFinite(nearestSensitivePlace.distanceMeters)) {
    return {
      score: 0,
      rawValue: null,
      message: `Không có bệnh viện/trường học trong ${PRIORITY_GEO.sensitiveRadiusMeters} m`,
    };
  }

  const distance = Math.max(0, nearestSensitivePlace.distanceMeters);
  const score = distance <= 100 ? 100 : distance <= 300 ? 75 : 40;
  const typeLabel = nearestSensitivePlace.type === 'hospital' ? 'bệnh viện' : 'trường học';

  return {
    score,
    rawValue: {
      placeId: nearestSensitivePlace._id || null,
      name: nearestSensitivePlace.name || null,
      type: nearestSensitivePlace.type,
      distanceMeters: round(distance, 0),
    },
    message: `Cách ${typeLabel} gần nhất ${round(distance, 0)} m`,
  };
};

const buildFactor = (code, normalizedScore, weight, rawValue, message) => ({
  code,
  rawValue,
  normalizedScore: round(clamp(normalizedScore)),
  weight,
  points: round(clamp(normalizedScore) * weight),
  message,
});

/**
 * Hàm thuần: cùng đầu vào luôn cho cùng kết quả, không đọc/ghi DB.
 * Mỗi yếu tố được chuẩn hoá về 0–100 rồi nhân trọng số công khai.
 */
const calculatePriorityScore = ({
  issue,
  nearbyCount = 0,
  nearestSensitivePlace = null,
  now = new Date(),
}) => {
  const severityScore = CATEGORY_SEVERITY[issue.category] || CATEGORY_SEVERITY.other;
  const ageSla = calculateAgeSlaFactor(issue, now);
  const voteCount = Math.max(0, Number(issue.voteCount) || 0);
  const voteScore = Math.log1p(Math.min(voteCount, PRIORITY_VOTE_CAP))
    / Math.log1p(PRIORITY_VOTE_CAP) * 100;
  const normalizedNearbyCount = Math.max(0, Number(nearbyCount) || 0);
  const densityScore = clamp(
    (normalizedNearbyCount / PRIORITY_GEO.nearbyDensityCap) * 100
  );
  const sensitivePlace = calculateSensitivePlaceFactor(nearestSensitivePlace);

  const factors = [
    buildFactor(
      'severity',
      severityScore,
      PRIORITY_WEIGHTS.severity,
      { category: issue.category },
      `Mức nghiêm trọng của loại sự cố: ${round(severityScore)}/100`
    ),
    buildFactor(
      'age_sla',
      ageSla.score,
      PRIORITY_WEIGHTS.ageSla,
      ageSla.rawValue,
      ageSla.message
    ),
    buildFactor(
      'votes',
      voteScore,
      PRIORITY_WEIGHTS.votes,
      { voteCount, cap: PRIORITY_VOTE_CAP },
      `${voteCount} lượt ủng hộ`
    ),
    buildFactor(
      'nearby_density',
      densityScore,
      PRIORITY_WEIGHTS.nearbyDensity,
      {
        nearbyCount: normalizedNearbyCount,
        radiusMeters: PRIORITY_GEO.nearbyRadiusMeters,
      },
      `${normalizedNearbyCount} sự cố đang mở trong bán kính ${PRIORITY_GEO.nearbyRadiusMeters} m`
    ),
    buildFactor(
      'sensitive_place',
      sensitivePlace.score,
      PRIORITY_WEIGHTS.sensitivePlace,
      sensitivePlace.rawValue,
      sensitivePlace.message
    ),
  ];

  const priorityScore = round(factors.reduce((sum, factor) => sum + factor.points, 0));
  return {
    priorityScore,
    priorityLevel: getPriorityLevel(priorityScore),
    priorityFactors: factors,
    priorityVersion: PRIORITY_VERSION,
    priorityCalculatedAt: now,
  };
};

const findPriorityContext = async (issue) => {
  const point = issue.geo?.coordinates?.length === 2
    ? issue.geo
    : { type: 'Point', coordinates: [issue.longitude, issue.latitude] };

  const [nearbyResult, sensitivePlaces] = await Promise.all([
    Issue.aggregate([
      {
        $geoNear: {
          near: point,
          key: 'geo',
          distanceField: 'distanceMeters',
          maxDistance: PRIORITY_GEO.nearbyRadiusMeters,
          spherical: true,
          query: {
            _id: { $ne: issue._id },
            status: { $in: OPEN_STATUSES },
            isDeleted: false,
            mergedInto: null,
          },
        },
      },
      { $count: 'count' },
    ]),
    Place.aggregate([
      {
        $geoNear: {
          near: point,
          key: 'geo',
          distanceField: 'distanceMeters',
          maxDistance: PRIORITY_GEO.sensitiveRadiusMeters,
          spherical: true,
          query: { isActive: true, type: { $in: SENSITIVE_PLACE_TYPES } },
        },
      },
      { $limit: 1 },
      { $project: { name: 1, type: 1, distanceMeters: 1 } },
    ]),
  ]);

  return {
    nearbyCount: nearbyResult[0]?.count || 0,
    nearestSensitivePlace: sensitivePlaces[0] || null,
  };
};

const recalculateIssuePriority = async (issueId, { now = new Date() } = {}) => {
  const issue = await Issue.findById(issueId)
    .select('category status voteCount createdAt assignedAt dueAt geo latitude longitude isDeleted mergedInto')
    .lean();
  if (!issue) return null;

  if (issue.isDeleted || issue.mergedInto || !OPEN_STATUSES.includes(issue.status)) {
    const cleared = {
      priorityScore: null,
      priorityLevel: null,
      priorityFactors: [],
      priorityVersion: PRIORITY_VERSION,
      priorityCalculatedAt: now,
    };
    await Issue.updateOne({ _id: issue._id }, { $set: cleared });
    return { _id: issue._id, ...cleared };
  }

  const context = await findPriorityContext(issue);
  const result = calculatePriorityScore({ issue, ...context, now });
  await Issue.updateOne({ _id: issue._id }, { $set: result });
  return { _id: issue._id, ...result };
};

const recalculateWithRetry = async (issueId, options = {}, maxAttempts = 2) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await recalculateIssuePriority(issueId, options);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

const runPriorityBatch = async ({ limit = 500, concurrency = 5, now = new Date() } = {}) => {
  const safeLimit = Math.min(5000, Math.max(1, Number.parseInt(limit, 10) || 500));
  const safeConcurrency = Math.min(20, Math.max(1, Number.parseInt(concurrency, 10) || 5));
  const issues = await Issue.find({
    isDeleted: false,
    mergedInto: null,
    status: { $in: OPEN_STATUSES },
  })
    .select('_id')
    .sort({ priorityCalculatedAt: 1, createdAt: 1 })
    .limit(safeLimit)
    .lean();

  let updated = 0;
  let failed = 0;
  for (let index = 0; index < issues.length; index += safeConcurrency) {
    const chunk = issues.slice(index, index + safeConcurrency);
    const results = await Promise.allSettled(
      chunk.map((issue) => recalculateWithRetry(issue._id, { now }))
    );
    updated += results.filter((result) => result.status === 'fulfilled').length;
    failed += results.filter((result) => result.status === 'rejected').length;
  }

  return { scanned: issues.length, updated, failed, version: PRIORITY_VERSION };
};

// Hàng đợi nhỏ trong tiến trình giúp request vote/phân công không phải chờ các geo query.
const pendingIssueIds = new Set();
let queueScheduled = false;
let queueDraining = false;

const drainPriorityQueue = async () => {
  if (queueDraining) return;
  queueScheduled = false;
  queueDraining = true;
  try {
    while (pendingIssueIds.size) {
      const ids = [...pendingIssueIds];
      pendingIssueIds.clear();
      for (const issueId of ids) {
        try {
          await recalculateWithRetry(issueId);
        } catch (error) {
          console.warn(`Priority recalculation failed for ${issueId}:`, error.message);
        }
      }
    }
  } finally {
    queueDraining = false;
  }
};

const enqueuePriorityRecalculation = (issueId) => {
  if (!issueId) return;
  pendingIssueIds.add(issueId.toString());
  // Jest dùng model mock; không khởi chạy việc nền ngoài vòng đời của test.
  if (process.env.NODE_ENV === 'test' || queueScheduled || queueDraining) return;
  queueScheduled = true;
  setImmediate(drainPriorityQueue);
};

module.exports = {
  calculatePriorityScore,
  recalculateIssuePriority,
  runPriorityBatch,
  enqueuePriorityRecalculation,
  drainPriorityQueue,
};
