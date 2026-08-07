const AuditLog = require('../models/AuditLog');

/**
 * Audit không được làm thất bại nghiệp vụ đã ghi vào DB. Lỗi ghi log được báo ra
 * server để vận hành xử lý, nhưng response chính vẫn giữ nguyên.
 */
const recordAudit = async ({
  actor,
  action,
  entityType,
  entityId,
  description,
  metadata = {},
  request = null,
}) => {
  try {
    return await AuditLog.create({
      actorId: actor.id,
      actorRole: actor.role,
      action,
      entityType,
      entityId,
      description,
      metadata,
      ipAddress: request?.ip || null,
      userAgent: request?.get?.('user-agent') || null,
    });
  } catch (error) {
    console.warn('Audit log write error:', error.message);
    return null;
  }
};

const getAuditLogs = async ({
  action,
  entityType,
  actorId,
  dateFrom,
  dateTo,
  page = 1,
  limit = 20,
} = {}) => {
  const filter = {};
  if (action) filter.action = action;
  if (entityType) filter.entityType = entityType;
  if (actorId) filter.actorId = actorId;

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actorId', 'name email role')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: {
      current: pageNum,
      pages: Math.ceil(total / limitNum),
      total,
      limit: limitNum,
    },
  };
};

module.exports = {
  recordAudit,
  getAuditLogs,
};
