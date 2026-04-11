jest.mock('../../src/models/User');

const User = require('../../src/models/User');
const userService = require('../../src/services/userService');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUsers()', () => {
    it('should return paginated users with default params', async () => {
      const mockUsers = [
        { _id: '1', name: 'User 1', role: 'user' },
        { _id: '2', name: 'User 2', role: 'admin' },
      ];
      User.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockUsers),
          }),
        }),
      });
      User.countDocuments.mockResolvedValue(2);

      const result = await userService.getUsers({ page: 1, limit: 10 });

      expect(result.users).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.current).toBe(1);
    });

    it('should apply role filter', async () => {
      User.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      User.countDocuments.mockResolvedValue(0);

      await userService.getUsers({ role: 'admin', page: 1, limit: 10 });

      expect(User.find).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
    });

    it('should apply isActive filter', async () => {
      User.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      User.countDocuments.mockResolvedValue(0);

      await userService.getUsers({ isActive: 'true', page: 1, limit: 10 });

      expect(User.find).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
    });
  });

  describe('updateUserRole()', () => {
    it('should throw for invalid role', async () => {
      await expect(
        userService.updateUserRole('target1', 'superadmin', 'admin1')
      ).rejects.toThrow('Role must be user or admin');
    });

    it('should throw when changing own role', async () => {
      await expect(
        userService.updateUserRole('admin1', 'user', 'admin1')
      ).rejects.toThrow('Cannot change your own role');
    });

    it('should throw if target user not found', async () => {
      User.findByIdAndUpdate.mockResolvedValue(null);

      await expect(
        userService.updateUserRole('nonexistent', 'admin', 'admin1')
      ).rejects.toThrow('User not found');
    });

    it('should update role successfully', async () => {
      const updatedUser = { _id: 'target1', role: 'admin' };
      User.findByIdAndUpdate.mockResolvedValue(updatedUser);

      const result = await userService.updateUserRole('target1', 'admin', 'admin1');

      expect(result.role).toBe('admin');
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('target1', { role: 'admin' }, { new: true });
    });
  });

  describe('toggleUserActive()', () => {
    it('should throw when deactivating own account', async () => {
      await expect(
        userService.toggleUserActive('admin1', 'admin1')
      ).rejects.toThrow('Cannot deactivate your own account');
    });

    it('should throw if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await expect(
        userService.toggleUserActive('nonexistent', 'admin1')
      ).rejects.toThrow('User not found');
    });

    it('should toggle isActive from true to false', async () => {
      const mockUser = { _id: 'user1', isActive: true, save: jest.fn().mockResolvedValue(true) };
      User.findById.mockResolvedValue(mockUser);

      const result = await userService.toggleUserActive('user1', 'admin1');

      expect(result.isActive).toBe(false);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should toggle isActive from false to true', async () => {
      const mockUser = { _id: 'user1', isActive: false, save: jest.fn().mockResolvedValue(true) };
      User.findById.mockResolvedValue(mockUser);

      const result = await userService.toggleUserActive('user1', 'admin1');

      expect(result.isActive).toBe(true);
    });
  });
});
