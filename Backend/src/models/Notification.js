const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  type: {
    type: String,
    enum: [
      'issue_created', 'issue_updated', 'issue_resolved', 'issue_rejected',
      'comment', 'area_alert',
      // Luồng phân công & SLA
      'issue_assigned', 'sla_reminder', 'sla_escalated',
      // Phiếu chưa phân công đã quá hạn tiếp nhận (E6)
      'intake_overdue',
      // Người dân mở lại sự cố vì không đồng ý kết quả xử lý (G8)
      'issue_reopened',
      // Người dân chấm điểm chất lượng xử lý (G13)
      'issue_rated',
      // Sự cố bị thu hồi phân công khỏi đơn vị (G14)
      'issue_unassigned',
      // Gộp sự cố trùng lặp
      'issue_merged'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  issueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Issue',
    default: null
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
