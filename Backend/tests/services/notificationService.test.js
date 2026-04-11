jest.mock('../../src/models/Notification');

const Notification = require('../../src/models/Notification');
const notificationService = require('../../src/services/notificationService');

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotifications()', () => {
    it('should return paginated notifications with unread count', async () => {
      const mockNotifications = [
        { _id: '1', title: 'Notif 1', isRead: false },
        { _id: '2', title: 'Notif 2', isRead: true },
      ];
      Notification.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockNotifications),
          }),
        }),
      });
      Notification.countDocuments
        .mockResolvedValueOnce(2)   // total
        .mockResolvedValueOnce(1);  // unreadCount

      const result = await notificationService.getNotifications('user1', { page: 1, limit: 20 });

      expect(result.notifications).toHaveLength(2);
      expect(result.unreadCount).toBe(1);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.current).toBe(1);
    });

    it('should use default page and limit', async () => {
      Notification.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      Notification.countDocuments.mockResolvedValue(0);

      const result = await notificationService.getNotifications('user1', {});

      expect(result.pagination.current).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });
  });

  describe('getUnreadCount()', () => {
    it('should return count of unread notifications', async () => {
      Notification.countDocuments.mockResolvedValue(5);

      const count = await notificationService.getUnreadCount('user1');

      expect(count).toBe(5);
      expect(Notification.countDocuments).toHaveBeenCalledWith({
        userId: 'user1',
        isRead: false,
      });
    });
  });

  describe('markAsRead()', () => {
    it('should throw if notification not found', async () => {
      Notification.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        notificationService.markAsRead('nonexistent', 'user1')
      ).rejects.toThrow('Notification not found');
    });

    it('should mark notification as read', async () => {
      const mockNotif = { _id: 'notif1', isRead: true };
      Notification.findOneAndUpdate.mockResolvedValue(mockNotif);

      const result = await notificationService.markAsRead('notif1', 'user1');

      expect(result.isRead).toBe(true);
      expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'notif1', userId: 'user1' },
        { isRead: true },
        { new: true }
      );
    });
  });

  describe('markAllAsRead()', () => {
    it('should mark all unread notifications as read', async () => {
      Notification.updateMany.mockResolvedValue({ modifiedCount: 3 });

      await notificationService.markAllAsRead('user1');

      expect(Notification.updateMany).toHaveBeenCalledWith(
        { userId: 'user1', isRead: false },
        { isRead: true }
      );
    });
  });
});
