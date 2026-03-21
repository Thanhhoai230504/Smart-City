import axiosClient from './axiosClient';

export const notificationApi = {
  getNotifications: (params?: Record<string, string | number>) =>
    axiosClient.get('/notifications', { params }),

  getUnreadCount: () =>
    axiosClient.get('/notifications/unread-count'),

  markAsRead: (id: string) =>
    axiosClient.patch(`/notifications/${id}/read`),

  markAllAsRead: () =>
    axiosClient.patch('/notifications/read-all'),
};
