const Comment = require('../models/Comment');
const Issue = require('../models/Issue');
const Notification = require('../models/Notification');
const ApiError = require('../utils/apiError');
const { getIO } = require('../config/socket');

/**
 * @desc    Get comments for an issue
 * @route   GET /api/issues/:issueId/comments
 * @access  Public
 */
const getComments = async (req, res, next) => {
  try {
    const comments = await Comment.find({ issueId: req.params.issueId })
      .populate('userId', 'name email role')
      .sort('createdAt');

    res.json({ success: true, data: { comments } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add comment to an issue
 * @route   POST /api/issues/:issueId/comments
 * @access  Private
 */
const addComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      throw ApiError.badRequest('Content is required');
    }

    const issue = await Issue.findById(req.params.issueId).populate('userId', 'name email');
    if (!issue) throw ApiError.notFound('Issue not found');

    const comment = await Comment.create({
      issueId: req.params.issueId,
      userId: req.user.id,
      content: content.trim()
    });

    await comment.populate('userId', 'name email role');

    // Notify the other party
    try {
      const io = getIO();
      const isAdmin = req.user.role === 'admin';
      const reporterId = typeof issue.userId === 'object' ? issue.userId._id : issue.userId;

      // Create notification
      const targetUserId = isAdmin ? reporterId : null;
      if (targetUserId) {
        const notification = await Notification.create({
          userId: targetUserId,
          type: 'comment',
          title: 'Bình luận mới',
          message: `${req.user.name || 'Admin'} đã bình luận về sự cố "${issue.title}"`,
          issueId: issue._id
        });
        io.to(`user_${targetUserId}`).emit('notification:new', notification);
      }

      // Notify admins if comment from user
      if (!isAdmin) {
        const User = require('../models/User');
        const adminUsers = await User.find({ role: 'admin', isActive: true }).select('_id');
        for (const admin of adminUsers) {
          const adminNotif = await Notification.create({
            userId: admin._id,
            type: 'comment',
            title: 'Bình luận mới từ người dân',
            message: `${req.user.name || 'Người dùng'} bình luận về "${issue.title}"`,
            issueId: issue._id
          });
          io.to(`user_${admin._id}`).emit('notification:new', adminNotif);
        }
      }
    } catch (socketError) {
      console.warn('Socket.io not available:', socketError.message);
    }

    res.status(201).json({ success: true, data: { comment } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getComments, addComment };
