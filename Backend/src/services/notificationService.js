const Notification = require('../models/Notification');
const ApiError = require('../utils/apiError');

const getNotifications = async (userId, { page = 1, limit = 20 }) => {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find({ userId })
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum),
    Notification.countDocuments({ userId }),
    Notification.countDocuments({ userId, isRead: false })
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      current: pageNum,
      pages: Math.ceil(total / limitNum),
      total,
      limit: limitNum
    }
  };
};

const getUnreadCount = async (userId) => {
  const count = await Notification.countDocuments({ userId, isRead: false });
  return count;
};

const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true },
    { new: true }
  );
  if (!notification) throw ApiError.notFound('Notification not found');
  return notification;
};

const markAllAsRead = async (userId) => {
  await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true }
  );
};

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead };
