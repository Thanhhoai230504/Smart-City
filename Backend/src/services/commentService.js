const Comment = require('../models/Comment');
const Issue = require('../models/Issue');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { getIO } = require('../config/socket');

const getComments = async (issueId) => {
  const comments = await Comment.find({ issueId })
    .populate('userId', 'name email role')
    .sort('createdAt');
  return comments;
};

const addComment = async (issueId, { content, user }) => {
  if (!content || !content.trim()) {
    throw ApiError.badRequest('Content is required');
  }

  const issue = await Issue.findById(issueId).populate('userId', 'name email');
  if (!issue) throw ApiError.notFound('Issue not found');

  const comment = await Comment.create({
    issueId,
    userId: user.id,
    content: content.trim()
  });

  await comment.populate('userId', 'name email role');

  // Notify the other party
  try {
    const io = getIO();
    const isAdmin = user.role === 'admin';
    const reporterId = typeof issue.userId === 'object' ? issue.userId._id : issue.userId;

    // Admin comments → notify reporter
    if (isAdmin && reporterId) {
      const notification = await Notification.create({
        userId: reporterId,
        type: 'comment',
        title: 'Bình luận mới',
        message: `${user.name || 'Admin'} đã bình luận về sự cố "${issue.title}"`,
        issueId: issue._id
      });
      io.to(`user_${reporterId}`).emit('notification:new', notification);
    }

    // User comments → notify all admins
    if (!isAdmin) {
      const adminUsers = await User.find({ role: 'admin', isActive: true }).select('_id');
      for (const admin of adminUsers) {
        const adminNotif = await Notification.create({
          userId: admin._id,
          type: 'comment',
          title: 'Bình luận mới từ người dân',
          message: `${user.name || 'Người dùng'} bình luận về "${issue.title}"`,
          issueId: issue._id
        });
        io.to(`user_${admin._id}`).emit('notification:new', adminNotif);
      }
    }
  } catch (socketError) {
    console.warn('Socket.io not available:', socketError.message);
  }

  return comment;
};

module.exports = { getComments, addComment };
