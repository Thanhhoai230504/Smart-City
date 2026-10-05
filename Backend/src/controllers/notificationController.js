const notificationService = require('../services/notificationService');

const getNotifications = async (req, res, next) => {
  try {
    const data = await notificationService.getNotifications(req.user.id, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user.id);
    res.json({ success: true, data: { notification } });
  } catch (error) {
    next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    res.json({ success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead };
