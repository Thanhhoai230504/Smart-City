const Issue = require('../models/Issue');
const Notification = require('../models/Notification');
const ApiError = require('../utils/apiError');
const { getIO } = require('../config/socket');
const cloudinary = require('../config/cloudinary');

/**
 * @desc    Get all issues (with filter & pagination)
 * @route   GET /api/issues
 * @access  Public
 */
const getIssues = async (req, res, next) => {
  try {
    const { status, category, page = 1, limit = 10, sort = '-createdAt' } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [issues, total] = await Promise.all([
      Issue.find(filter)
        .populate('userId', 'name email')
        .populate('adminId', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      Issue.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        issues,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single issue by ID
 * @route   GET /api/issues/:id
 * @access  Public
 */
const getIssueById = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('adminId', 'name email');

    if (!issue) {
      throw ApiError.notFound('Issue not found.');
    }

    res.json({
      success: true,
      data: { issue }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new issue
 * @route   POST /api/issues
 * @access  Private (logged in users)
 */
const createIssue = async (req, res, next) => {
  let uploadedFileId = null; // Track uploaded file for rollback

  try {
    const { title, description, category, location, latitude, longitude } = req.body;

    // Get image URL and public_id from uploaded file (if any)
    const imageUrl = req.file ? req.file.path : null;
    if (req.file && req.file.filename) {
      uploadedFileId = req.file.filename; // Cloudinary public_id for cleanup
    }

    const issue = await Issue.create({
      title,
      description,
      category,
      location,
      latitude,
      longitude,
      imageUrl,
      userId: req.user.id,
      statusHistory: [{
        status: 'reported',
        changedBy: req.user.id,
        changedAt: new Date(),
        note: 'Sự cố được báo cáo'
      }]
    });

    // Populate user info for response
    await issue.populate('userId', 'name email');

    // Notify all admins (create DB records + socket)
    try {
      const User = require('../models/User');
      const adminUsers = await User.find({ role: 'admin', isActive: true }).select('_id');
      const io = getIO();

      for (const admin of adminUsers) {
        const notification = await Notification.create({
          userId: admin._id,
          type: 'issue_created',
          title: 'Sự cố mới',
          message: `${req.user.name || 'Người dùng'} đã báo cáo sự cố "${issue.title}"`,
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

    res.status(201).json({
      success: true,
      message: 'Issue reported successfully.',
      data: { issue }
    });
  } catch (error) {
    // Rollback: delete uploaded image from Cloudinary if DB save failed
    if (uploadedFileId) {
      try {
        await cloudinary.uploader.destroy(uploadedFileId);
        console.log(`🗑️  Rolled back Cloudinary image: ${uploadedFileId}`);
      } catch (cleanupError) {
        console.error('⚠️  Failed to cleanup Cloudinary image:', cleanupError.message);
      }
    }
    next(error);
  }
};

/**
 * @desc    Update issue status (admin only)
 * @route   PATCH /api/issues/:id/status
 * @access  Private (Admin)
 */
const updateIssueStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['reported', 'processing', 'resolved', 'rejected'];

    if (!status || !validStatuses.includes(status)) {
      throw ApiError.badRequest(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    const updateData = {
      status,
      adminId: req.user.id,
      $push: {
        statusHistory: {
          status,
          changedBy: req.user.id,
          changedAt: new Date(),
          note: req.body.note || ''
        }
      }
    };

    // Set resolvedAt when status is resolved
    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
    }

    const issue = await Issue.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
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

    res.json({
      success: true,
      message: `Issue status updated to ${status}.`,
      data: { issue }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete issue (admin only)
 * @route   DELETE /api/issues/:id
 * @access  Private (Admin)
 */
const deleteIssue = async (req, res, next) => {
  try {
    const issue = await Issue.findByIdAndDelete(req.params.id);

    if (!issue) {
      throw ApiError.notFound('Issue not found.');
    }

    res.json({
      success: true,
      message: 'Issue deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get issues of current user
 * @route   GET /api/issues/my
 * @access  Private
 */
const getMyIssues = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { userId: req.user.id };
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

    res.json({
      success: true,
      data: {
        issues,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getIssues,
  getIssueById,
  createIssue,
  updateIssueStatus,
  deleteIssue,
  getMyIssues
};
