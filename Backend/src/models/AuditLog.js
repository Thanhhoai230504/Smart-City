const mongoose = require('mongoose');

const AUDIT_ACTIONS = [
  'user.role_changed',
  'user.active_changed',
  'department.staff_changed',
  'issue.deleted',
  'issue.status_changed',
  'issue.assigned',
  'issue.unassigned',
  'issue.claimed',
    'issue.merged',
    'issue.priority_recalculated',
];

const auditLogSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  actorRole: {
    type: String,
    enum: ['user', 'staff', 'admin'],
    required: true,
  },
  action: {
    type: String,
    enum: AUDIT_ACTIONS,
    required: true,
    index: true,
  },
  entityType: {
    type: String,
    enum: ['User', 'Issue', 'Department'],
    required: true,
    index: true,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ipAddress: {
    type: String,
    default: null,
  },
  userAgent: {
    type: String,
    default: null,
    maxlength: 500,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
AuditLog.ACTIONS = AUDIT_ACTIONS;

module.exports = AuditLog;
