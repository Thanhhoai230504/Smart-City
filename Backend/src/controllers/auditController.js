const auditService = require('../services/auditService');

const getAuditLogs = async (req, res, next) => {
  try {
    const data = await auditService.getAuditLogs(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAuditLogs };
