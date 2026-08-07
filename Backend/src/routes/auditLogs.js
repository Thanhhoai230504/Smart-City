const express = require('express');
const { query } = require('express-validator');
const validate = require('../middleware/validate');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { getAuditLogs } = require('../controllers/auditController');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

router.get(
  '/',
  authMiddleware,
  adminMiddleware,
  query('action').optional().isIn(AuditLog.ACTIONS).withMessage('action không hợp lệ'),
  query('entityType').optional().isIn(['User', 'Issue', 'Department'])
    .withMessage('entityType không hợp lệ'),
  query('actorId').optional().isMongoId().withMessage('actorId không hợp lệ'),
  query('dateFrom').optional().isISO8601().withMessage('dateFrom không hợp lệ'),
  query('dateTo').optional().isISO8601().withMessage('dateTo không hợp lệ'),
  query('page').optional().isInt({ min: 1 }).withMessage('page không hợp lệ'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit không hợp lệ'),
  validate,
  getAuditLogs
);

module.exports = router;
