const ApiError = require('../utils/apiError');
const auditService = require('../services/auditService');
const {
  recalculateIssuePriority,
  runPriorityBatch,
} = require('../services/priorityService');
const { getPublicPriorityConfig } = require('../utils/priorityConfig');

const getPriorityConfig = (req, res) => {
  res.json({ success: true, data: { config: getPublicPriorityConfig() } });
};

const recalculatePriority = async (req, res, next) => {
  try {
    const result = await recalculateIssuePriority(req.params.id);
    if (!result) throw ApiError.notFound('Sự cố không tồn tại');
    await auditService.recordAudit({
      actor: req.user,
      action: 'issue.priority_recalculated',
      entityType: 'Issue',
      entityId: req.params.id,
      description: `Tính lại điểm ưu tiên: ${result.priorityScore ?? 'không áp dụng'}`,
      metadata: { priorityLevel: result.priorityLevel, priorityVersion: result.priorityVersion },
      request: req,
    });
    res.json({ success: true, message: 'Đã tính lại điểm ưu tiên.', data: { priority: result } });
  } catch (error) {
    next(error);
  }
};

const recalculatePriorityBatch = async (req, res, next) => {
  try {
    const result = await runPriorityBatch({
      limit: req.body.limit,
      concurrency: req.body.concurrency,
    });
    res.json({ success: true, message: 'Đã hoàn thành lượt tính điểm ưu tiên.', data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPriorityConfig, recalculatePriority, recalculatePriorityBatch };
