const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const User = require('../models/User');
const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');
const DepartmentEvaluation = require('../models/DepartmentEvaluation');
const ApiError = require('../utils/apiError');
const { computeDepartmentScore, getPublicScoreConfig } = require('../utils/departmentScoreConfig');

/**
 * Đánh giá hiệu quả đơn vị xử lý THEO KỲ — để lãnh đạo có căn cứ khen thưởng hay
 * phê bình. Thay thế cách tính cũ của departmentService.getDepartmentStats ở ba chỗ
 * chưa công bằng:
 *
 * 1. Bản cũ chỉ tính toàn thời gian; đánh giá luôn theo kỳ (tháng, quý, năm).
 * 2. Bản cũ chia số việc đúng hạn cho MỌI việc đã xong, kể cả việc không có hạn —
 *    những việc đó không bao giờ "đúng hạn" được, nên tỷ lệ bị kéo thấp oan.
 * 3. Việc bị thu hồi/chuyển sang đơn vị khác biến mất khỏi lịch sử đơn vị cũ. Giờ
 *    nhật ký ghi `previousDepartmentId` nên đếm được số lần bị lấy việc (chỉ từ khi
 *    có trường này — dữ liệu trước đó không có).
 *
 * Mọi chỉ số "trong kỳ" dùng mốc thời gian của chính sự kiện đó (giao việc, đóng
 * việc, mở lại, đánh giá). Các chỉ số tồn đọng (đang mở, quá hạn, leo cấp) là ảnh
 * chụp HIỆN TẠI, không phụ thuộc kỳ.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 30;
const TIMEZONE = 'Asia/Ho_Chi_Minh';
const OPEN_STATUSES = ['reported', 'processing'];
const EVIDENCE_LIMIT = 10;

/** Chuẩn hoá kỳ đánh giá. Mặc định 30 ngày gần nhất; tối đa 366 ngày. */
const resolvePeriod = ({ from, to } = {}, now = new Date()) => {
  const end = to ? new Date(to) : now;
  const start = from ? new Date(from) : new Date(end.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw ApiError.badRequest('Khoảng thời gian không hợp lệ');
  }
  if (start >= end) throw ApiError.badRequest('Ngày bắt đầu phải trước ngày kết thúc');
  if ((end - start) / DAY_MS > MAX_RANGE_DAYS) {
    throw ApiError.badRequest(`Mỗi kỳ đánh giá tối đa ${MAX_RANGE_DAYS} ngày`);
  }
  return { from: start, to: end };
};

// ─── Biểu thức tổng hợp dùng chung ───────────────────────────────────────────

const notNull = (field) => ({ $ne: [{ $ifNull: [field, null] }, null] });
const inPeriod = (field, { from, to }) => ({ $and: [notNull(field), { $gte: [field, from] }, { $lte: [field, to] }] });
const count = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });

/**
 * Thời điểm ĐÓNG việc: resolvedAt với phiếu đã xử lý; với phiếu bị từ chối thì lấy
 * lần chuyển sang `rejected` gần nhất trong statusHistory (phiếu từ chối không có resolvedAt).
 */
const CLOSED_AT = {
  $switch: {
    branches: [
      { case: { $eq: ['$status', 'resolved'] }, then: '$resolvedAt' },
      {
        case: { $eq: ['$status', 'rejected'] },
        then: {
          $max: {
            $map: {
              input: {
                $filter: {
                  input: { $ifNull: ['$statusHistory', []] },
                  as: 'h',
                  cond: { $eq: ['$$h.status', 'rejected'] },
                },
              },
              as: 'h',
              in: '$$h.changedAt',
            },
          },
        },
      },
    ],
    default: null,
  },
};

/** Các phép đếm cho một nhóm sự cố (một đơn vị, một loại, một cán bộ, một kỳ con). */
const metricAccumulators = (period, now) => {
  const isOpen = { $in: ['$status', OPEN_STATUSES] };
  const resolvedIn = { $and: [{ $eq: ['$status', 'resolved'] }, inPeriod('$resolvedAt', period)] };
  const resolvedWithDue = { $and: [resolvedIn, notNull('$dueAt')] };
  const timed = { $and: [resolvedIn, notNull('$assignedAt')] };
  const ratedIn = { $and: [inPeriod('$rating.ratedAt', period), notNull('$rating.score')] };
  return {
    assigned: count(inPeriod('$assignedAt', period)),
    closed: count(inPeriod('$_closedAt', period)),
    resolved: count(resolvedIn),
    rejected: count({ $and: [{ $eq: ['$status', 'rejected'] }, inPeriod('$_closedAt', period)] }),
    resolvedWithDue: count(resolvedWithDue),
    onTime: count({ $and: [resolvedWithDue, { $lte: ['$resolvedAt', '$dueAt'] }] }),
    hoursSum: { $sum: { $cond: [timed, { $divide: [{ $subtract: ['$resolvedAt', '$assignedAt'] }, 3600000] }, 0] } },
    hoursCount: count(timed),
    openNow: count(isOpen),
    overdueNow: count({ $and: [isOpen, notNull('$dueAt'), { $lt: ['$dueAt', now] }] }),
    escalatedOpen: count({ $and: [isOpen, { $gte: [{ $ifNull: ['$escalationLevel', 0] }, 2] }] }),
    reopened: count(inPeriod('$lastReopenedAt', period)),
    ratingCount: count(ratedIn),
    ratingSum: { $sum: { $cond: [ratedIn, '$rating.score', 0] } },
    lowRatings: count({ $and: [ratedIn, { $lte: ['$rating.score', 2] }] }),
  };
};

const ZERO = {
  assigned: 0, closed: 0, resolved: 0, rejected: 0, resolvedWithDue: 0, onTime: 0,
  hoursSum: 0, hoursCount: 0, openNow: 0, overdueNow: 0, escalatedOpen: 0,
  reopened: 0, ratingCount: 0, ratingSum: 0, lowRatings: 0, revoked: 0,
};

const round1 = (v) => Math.round(v * 10) / 10;

/** Chuyển số đếm thô thành chỉ số hiển thị (tỷ lệ %, trung bình). */
const toMetrics = (raw) => {
  const m = { ...ZERO, ...raw };
  return {
    assigned: m.assigned,
    closed: m.closed,
    resolved: m.resolved,
    rejected: m.rejected,
    onTimeRate: m.resolvedWithDue > 0 ? Math.round((m.onTime / m.resolvedWithDue) * 100) : null,
    onTime: m.onTime,
    resolvedWithDue: m.resolvedWithDue,
    avgResolutionHours: m.hoursCount > 0 ? round1(m.hoursSum / m.hoursCount) : null,
    avgRating: m.ratingCount > 0 ? round1(m.ratingSum / m.ratingCount) : null,
    ratingCount: m.ratingCount,
    lowRatings: m.lowRatings,
    reopened: m.reopened,
    complaintRate: m.closed + m.reopened > 0 ? Math.round((m.reopened / (m.closed + m.reopened)) * 100) : null,
    openNow: m.openNow,
    overdueNow: m.overdueNow,
    escalatedOpen: m.escalatedOpen,
    revoked: m.revoked,
  };
};

const baseMatch = (extra = {}) => ({ isDeleted: false, mergedInto: null, departmentId: { $ne: null }, ...extra });

/**
 * Số lần một đơn vị bị lấy việc trong kỳ: thu hồi, hoặc phân công lại sang đơn vị
 * khác. Đọc từ nhật ký — chỉ có từ khi controller ghi `previousDepartmentId`.
 */
const countRevocations = async (period, departmentId = null) => {
  const match = {
    action: { $in: ['issue.assigned', 'issue.unassigned'] },
    createdAt: { $gte: period.from, $lte: period.to },
    'metadata.previousDepartmentId': departmentId ? String(departmentId) : { $nin: [null, ''] },
  };
  const rows = await AuditLog.aggregate([
    { $match: match },
    {
      $match: {
        $expr: {
          $or: [
            { $eq: ['$action', 'issue.unassigned'] },
            { $ne: [{ $toString: '$metadata.previousDepartmentId' }, { $toString: '$metadata.departmentId' }] },
          ],
        },
      },
    },
    { $group: { _id: '$metadata.previousDepartmentId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
};

const staffCountByDepartment = async () => {
  const rows = await User.aggregate([
    { $match: { role: 'staff', isActive: true, departmentId: { $ne: null } } },
    { $group: { _id: '$departmentId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
};

/** Xếp hạng: chỉ đơn vị đủ dữ liệu mới có hạng; hoà điểm thì xét tỷ lệ đúng hạn rồi số việc. */
const rankRows = (rows) => {
  const eligible = rows.filter((r) => r.score.score !== null)
    .sort((a, b) => b.score.score - a.score.score
      || (b.metrics.onTimeRate ?? -1) - (a.metrics.onTimeRate ?? -1)
      || b.metrics.closed - a.metrics.closed);
  const rest = rows.filter((r) => r.score.score === null)
    .sort((a, b) => b.metrics.assigned - a.metrics.assigned || a.name.localeCompare(b.name, 'vi'));
  eligible.forEach((r, i) => { r.rank = i + 1; });
  rest.forEach((r) => { r.rank = null; });
  return [...eligible, ...rest];
};

/**
 * Quyết định của lãnh đạo còn hiệu lực cho ĐÚNG kỳ đang xem, theo đơn vị. So khớp chính
 * xác mốc đầu/cuối: kỳ "30 ngày qua" trôi theo thời gian, nên chỉ kỳ đã khép (tháng,
 * quý, tuỳ chọn) mới hiện lại quyết định của nó trên bảng xếp hạng.
 */
const evaluationsForPeriod = async (period) => {
  const rows = await DepartmentEvaluation.find({
    status: 'active', 'period.from': period.from, 'period.to': period.to,
  })
    .select('departmentId decision createdAt decidedBy')
    .populate('decidedBy', 'name')
    .lean();
  return new Map(rows.map((r) => [String(r.departmentId), {
    _id: r._id,
    decision: r.decision,
    decidedAt: r.createdAt,
    decidedBy: r.decidedBy?.name || null,
  }]));
};

/** Bảng xếp hạng mọi đơn vị trong kỳ. */
const getDepartmentPerformance = async (periodInput = {}, now = new Date()) => {
  const period = resolvePeriod(periodInput, now);
  const [grouped, revoked, staffCounts, departments, evaluations] = await Promise.all([
    Issue.aggregate([
      { $match: baseMatch() },
      { $addFields: { _closedAt: CLOSED_AT } },
      { $group: { _id: '$departmentId', ...metricAccumulators(period, now) } },
    ]),
    countRevocations(period),
    staffCountByDepartment(),
    Department.find().sort('name').lean(),
    evaluationsForPeriod(period),
  ]);

  const byId = new Map(grouped.map((r) => [String(r._id), r]));
  const rows = departments
    .map((dept) => {
      const id = String(dept._id);
      const raw = { ...ZERO, ...(byId.get(id) || {}), revoked: revoked.get(id) || 0 };
      return {
        departmentId: dept._id,
        name: dept.name,
        code: dept.code,
        isActive: dept.isActive,
        staffCount: staffCounts.get(id) || 0,
        metrics: toMetrics(raw),
        score: computeDepartmentScore(raw),
        evaluation: evaluations.get(id) || null,
      };
    })
    // Đơn vị đã vô hiệu hoá chỉ hiện khi có hoạt động trong kỳ hoặc còn tồn đọng.
    .filter((r) => r.isActive || r.metrics.assigned || r.metrics.closed || r.metrics.openNow);

  return { period, config: getPublicScoreConfig(), rows: rankRows(rows) };
};

// ─── Chi tiết một đơn vị ──────────────────────────────────────────────────────

const pickIssue = (i) => ({
  _id: i._id,
  title: i.title,
  category: i.category,
  status: i.status,
  assignedAt: i.assignedAt || null,
  dueAt: i.dueAt || null,
  resolvedAt: i.resolvedAt || null,
  lastReopenedAt: i.lastReopenedAt || null,
  reopenCount: i.reopenCount || 0,
  escalationLevel: i.escalationLevel || 0,
  rating: i.rating?.score ? { score: i.rating.score, comment: i.rating.comment || null, ratedAt: i.rating.ratedAt } : null,
  assignee: i.assigneeId && typeof i.assigneeId === 'object' ? { _id: i.assigneeId._id, name: i.assigneeId.name } : null,
});

const EVIDENCE_FIELDS = 'title category status assignedAt dueAt resolvedAt lastReopenedAt reopenCount escalationLevel rating assigneeId';

/** Danh sách bằng chứng: việc cần chú ý và điểm sáng, mỗi loại tối đa 10 phiếu. */
const loadEvidence = async (departmentId, period, now) => {
  const base = { departmentId, isDeleted: false, mergedInto: null };
  const find = (filter, sort) => Issue.find({ ...base, ...filter })
    .select(EVIDENCE_FIELDS).populate('assigneeId', 'name')
    .sort(sort).limit(EVIDENCE_LIMIT).lean();
  const inP = { $gte: period.from, $lte: period.to };
  const [overdue, escalated, reopened, lowRated, praised] = await Promise.all([
    find({ status: { $in: OPEN_STATUSES }, dueAt: { $ne: null, $lt: now } }, { dueAt: 1 }),
    find({ status: { $in: OPEN_STATUSES }, escalationLevel: { $gte: 2 } }, { dueAt: 1 }),
    find({ lastReopenedAt: inP }, { lastReopenedAt: -1 }),
    find({ 'rating.ratedAt': inP, 'rating.score': { $lte: 2 } }, { 'rating.ratedAt': -1 }),
    find({ 'rating.ratedAt': inP, 'rating.score': 5 }, { 'rating.ratedAt': -1 }),
  ]);
  return {
    overdue: overdue.map(pickIssue),
    escalated: escalated.map(pickIssue),
    reopened: reopened.map(pickIssue),
    lowRated: lowRated.map(pickIssue),
    praised: praised.map(pickIssue),
  };
};

/** Xu hướng theo tuần (kỳ ≤ 62 ngày) hoặc theo tháng, có điền cả kỳ con không có việc. */
const loadTrend = async (departmentId, period) => {
  const unit = (period.to - period.from) / DAY_MS <= 62 ? 'week' : 'month';
  // `startOfWeek` chỉ hợp lệ khi gom theo tuần.
  const trunc = (field) => ({
    $dateTrunc: { date: field, unit, timezone: TIMEZONE, ...(unit === 'week' ? { startOfWeek: 'monday' } : {}) },
  });
  const [assignedRows, closedRows] = await Promise.all([
    Issue.aggregate([
      { $match: baseMatch({ departmentId, assignedAt: { $gte: period.from, $lte: period.to } }) },
      { $group: { _id: trunc('$assignedAt'), assigned: { $sum: 1 } } },
    ]),
    Issue.aggregate([
      { $match: baseMatch({ departmentId, status: { $in: ['resolved', 'rejected'] } }) },
      { $addFields: { _closedAt: CLOSED_AT } },
      { $match: { $expr: inPeriod('$_closedAt', period) } },
      {
        $group: {
          _id: trunc('$_closedAt'),
          closed: { $sum: 1 },
          resolvedWithDue: count({ $and: [{ $eq: ['$status', 'resolved'] }, notNull('$dueAt')] }),
          onTime: count({ $and: [{ $eq: ['$status', 'resolved'] }, notNull('$dueAt'), { $lte: ['$resolvedAt', '$dueAt'] }] }),
        },
      },
    ]),
  ]);

  // Điền đủ mốc đầu kỳ con để biểu đồ không bỏ trống tuần/tháng không có việc.
  const buckets = new Map();
  const startOfBucket = (d) => {
    const local = new Date(d.getTime() + 7 * 3600000); // giờ Việt Nam (UTC+7, không đổi giờ mùa hè)
    const y = local.getUTCFullYear(), mo = local.getUTCMonth(), day = local.getUTCDate();
    let startLocal;
    if (unit === 'month') startLocal = Date.UTC(y, mo, 1);
    else {
      const dow = (local.getUTCDay() + 6) % 7; // thứ Hai = 0
      startLocal = Date.UTC(y, mo, day - dow);
    }
    return new Date(startLocal - 7 * 3600000);
  };
  for (let t = startOfBucket(period.from).getTime(); t <= period.to.getTime();) {
    buckets.set(t, { start: new Date(t), assigned: 0, closed: 0, onTime: 0, resolvedWithDue: 0 });
    const next = new Date(t + 7 * 3600000);
    t = unit === 'month'
      ? Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 1) - 7 * 3600000
      : t + 7 * DAY_MS;
  }
  for (const r of assignedRows) {
    const b = buckets.get(new Date(r._id).getTime());
    if (b) b.assigned = r.assigned;
  }
  for (const r of closedRows) {
    const b = buckets.get(new Date(r._id).getTime());
    if (b) Object.assign(b, { closed: r.closed, onTime: r.onTime, resolvedWithDue: r.resolvedWithDue });
  }
  return { unit, buckets: [...buckets.values()] };
};

const getDepartmentPerformanceDetail = async (departmentId, periodInput = {}, now = new Date()) => {
  if (!mongoose.isValidObjectId(departmentId)) throw ApiError.badRequest('Mã đơn vị không hợp lệ');
  const period = resolvePeriod(periodInput, now);
  const department = await Department.findById(departmentId).lean();
  if (!department) throw ApiError.notFound('Đơn vị không tồn tại');
  const deptId = department._id;
  const accumulators = metricAccumulators(period, now);

  const [overall, byCategoryRows, byStaffRows, staffUsers, revoked, trend, evidence] = await Promise.all([
    Issue.aggregate([
      { $match: baseMatch({ departmentId: deptId }) },
      { $addFields: { _closedAt: CLOSED_AT } },
      { $group: { _id: null, ...accumulators } },
    ]),
    Issue.aggregate([
      { $match: baseMatch({ departmentId: deptId }) },
      { $addFields: { _closedAt: CLOSED_AT } },
      { $group: { _id: '$category', ...accumulators } },
    ]),
    Issue.aggregate([
      { $match: baseMatch({ departmentId: deptId, assigneeId: { $ne: null } }) },
      { $addFields: { _closedAt: CLOSED_AT } },
      { $group: { _id: '$assigneeId', ...accumulators } },
    ]),
    User.find({ role: 'staff', departmentId: deptId }).select('name email isActive').lean(),
    countRevocations(period, deptId),
    loadTrend(deptId, period),
    loadEvidence(deptId, period, now),
  ]);

  const raw = { ...ZERO, ...(overall[0] || {}), revoked: revoked.get(String(deptId)) || 0 };
  const staffRaw = new Map(byStaffRows.map((r) => [String(r._id), r]));
  // Cán bộ chưa có việc trong kỳ vẫn hiện (0 việc) — vắng mặt cũng là thông tin.
  const staff = staffUsers.map((u) => ({
    userId: u._id,
    name: u.name,
    email: u.email,
    isActive: u.isActive,
    metrics: toMetrics(staffRaw.get(String(u._id)) || {}),
  }));
  // Cán bộ đã chuyển đơn vị nhưng còn việc của đơn vị này trong kỳ.
  const knownIds = new Set(staffUsers.map((u) => String(u._id)));
  const strays = byStaffRows.filter((r) => !knownIds.has(String(r._id)));
  if (strays.length) {
    const others = await User.find({ _id: { $in: strays.map((r) => r._id) } }).select('name email isActive').lean();
    for (const u of others) {
      staff.push({ userId: u._id, name: u.name, email: u.email, isActive: u.isActive, movedOut: true, metrics: toMetrics(staffRaw.get(String(u._id))) });
    }
  }
  staff.sort((a, b) => b.metrics.assigned - a.metrics.assigned || a.name.localeCompare(b.name, 'vi'));

  return {
    period,
    config: getPublicScoreConfig(),
    department: {
      _id: deptId, name: department.name, code: department.code, isActive: department.isActive,
      email: department.email || null, phone: department.phone || null,
    },
    metrics: toMetrics(raw),
    score: computeDepartmentScore(raw),
    trend,
    byCategory: byCategoryRows
      .map((r) => ({ category: r._id, metrics: toMetrics(r) }))
      .filter((r) => r.metrics.assigned || r.metrics.closed || r.metrics.openNow)
      .sort((a, b) => b.metrics.assigned - a.metrics.assigned),
    staff,
    evidence,
  };
};

module.exports = {
  resolvePeriod,
  getDepartmentPerformance,
  getDepartmentPerformanceDetail,
  // xuất để test
  toMetrics,
  rankRows,
  CLOSED_AT,
  MAX_RANGE_DAYS,
};
