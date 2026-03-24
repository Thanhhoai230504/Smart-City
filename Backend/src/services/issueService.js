const Issue = require('../models/Issue');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { getIO } = require('../config/socket');
const cloudinary = require('../config/cloudinary');

const getIssues = async ({ status, category, page = 1, limit = 10, sort = '-createdAt' }) => {
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const [issues, total] = await Promise.all([
    Issue.find(filter)
      .populate('userId', 'name email')
      .populate('adminId', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum),
    Issue.countDocuments(filter)
  ]);

  return {
    issues,
    pagination: {
      current: pageNum,
      pages: Math.ceil(total / limitNum),
      total,
      limit: limitNum
    }
  };
};

const getIssueById = async (id) => {
  const issue = await Issue.findById(id)
    .populate('userId', 'name email')
    .populate('adminId', 'name email');

  if (!issue) {
    throw ApiError.notFound('Issue not found.');
  }
  return issue;
};

const createIssue = async ({ title, description, category, location, latitude, longitude, file, user }) => {
  let uploadedFileId = null;

  try {
    const imageUrl = file ? file.path : null;
    if (file && file.filename) {
      uploadedFileId = file.filename;
    }

    const issue = await Issue.create({
      title, description, category, location, latitude, longitude, imageUrl,
      userId: user.id,
      statusHistory: [{
        status: 'reported',
        changedBy: user.id,
        changedAt: new Date(),
        note: 'Sự cố được báo cáo'
      }]
    });

    await issue.populate('userId', 'name email');

    // Notify all admins
    try {
      const adminUsers = await User.find({ role: 'admin', isActive: true }).select('_id');
      const io = getIO();

      for (const admin of adminUsers) {
        const notification = await Notification.create({
          userId: admin._id,
          type: 'issue_created',
          title: 'Sự cố mới',
          message: `${user.name || 'Người dùng'} đã báo cáo sự cố "${issue.title}"`,
          issueId: issue._id
        });
        io.to(`user_${admin._id}`).emit('notification:new', notification);
      }

      io.to('admins').emit('issue:created', {
        message: `New issue reported: ${issue.title}`,
        issue
      });
    } catch (socketError) {
      console.warn('Socket.io/Notification error:', socketError.message);
    }

    return issue;
  } catch (error) {
    if (uploadedFileId) {
      try {
        await cloudinary.uploader.destroy(uploadedFileId);
        console.log(`🗑️  Rolled back Cloudinary image: ${uploadedFileId}`);
      } catch (cleanupError) {
        console.error('⚠️  Failed to cleanup Cloudinary image:', cleanupError.message);
      }
    }
    throw error;
  }
};

const updateIssueStatus = async (issueId, { status, note, adminUser }) => {
  const validStatuses = ['reported', 'processing', 'resolved', 'rejected'];

  if (!status || !validStatuses.includes(status)) {
    throw ApiError.badRequest(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  const updateData = {
    status,
    adminId: adminUser.id,
    $push: {
      statusHistory: {
        status,
        changedBy: adminUser.id,
        changedAt: new Date(),
        note: note || ''
      }
    }
  };

  if (status === 'resolved') {
    updateData.resolvedAt = new Date();
  }

  const issue = await Issue.findByIdAndUpdate(issueId, updateData, { new: true, runValidators: true })
    .populate('userId', 'name email')
    .populate('adminId', 'name email');

  if (!issue) {
    throw ApiError.notFound('Issue not found.');
  }

  // Create notification for reporter
  const statusLabels = { processing: 'Đang xử lý', resolved: 'Đã xử lý', rejected: 'Từ chối' };
  try {
    const reporterId = issue.userId._id || issue.userId;
    const notification = await Notification.create({
      userId: reporterId,
      type: status === 'resolved' ? 'issue_resolved' : status === 'rejected' ? 'issue_rejected' : 'issue_updated',
      title: `Sự cố ${statusLabels[status] || status}`,
      message: `Sự cố "${issue.title}" đã được cập nhật trạng thái: ${statusLabels[status] || status}`,
      issueId: issue._id
    });

    const io = getIO();
    io.to(`user_${reporterId}`).emit('notification:new', notification);
    io.to(`user_${reporterId}`).emit('issue:updated', { message: notification.message, issue });

    if (status === 'resolved') {
      io.to(`user_${reporterId}`).emit('issue:resolved', { message: notification.message, issue });
    }
  } catch (socketError) {
    console.warn('Socket/Notification error:', socketError.message);
  }

  return issue;
};

const deleteIssue = async (id) => {
  const issue = await Issue.findByIdAndDelete(id);
  if (!issue) {
    throw ApiError.notFound('Issue not found.');
  }
  return issue;
};

const getMyIssues = async ({ userId, status, page = 1, limit = 10 }) => {
  const filter = { userId };
  if (status) filter.status = status;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const [issues, total] = await Promise.all([
    Issue.find(filter)
      .populate('adminId', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum),
    Issue.countDocuments(filter)
  ]);

  return {
    issues,
    pagination: {
      current: pageNum,
      pages: Math.ceil(total / limitNum),
      total,
      limit: limitNum
    }
  };
};
const deleteMyIssue = async (issueId, userId) => {
  const issue = await Issue.findById(issueId);
  if (!issue) throw ApiError.notFound('Issue not found.');

  if (issue.userId.toString() !== userId.toString()) {
    throw ApiError.forbidden('You can only delete your own issues.');
  }
  if (issue.status !== 'reported') {
    throw ApiError.badRequest('Only issues with status "reported" can be deleted.');
  }

  await Issue.findByIdAndDelete(issueId);
  return issue;
};

const updateMyIssue = async (issueId, userId, { title, description }) => {
  const issue = await Issue.findById(issueId);
  if (!issue) throw ApiError.notFound('Issue not found.');

  if (issue.userId.toString() !== userId.toString()) {
    throw ApiError.forbidden('You can only edit your own issues.');
  }
  if (issue.status !== 'reported') {
    throw ApiError.badRequest('Only issues with status "reported" can be edited.');
  }

  if (title) issue.title = title.trim();
  if (description) issue.description = description.trim();
  await issue.save();
  await issue.populate('userId', 'name email');

  return issue;
};

module.exports = {
  getIssues,
  getIssueById,
  createIssue,
  updateIssueStatus,
  deleteIssue,
  getMyIssues,
  deleteMyIssue,
  updateMyIssue
};
