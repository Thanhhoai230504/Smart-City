jest.mock('../../src/models/User');
jest.mock('../../src/models/Issue');
jest.mock('../../src/models/Notification');
jest.mock('../../src/models/AuditLog');
jest.mock('../../src/services/sessionService');

const User = require('../../src/models/User');
const Issue = require('../../src/models/Issue');
const Notification = require('../../src/models/Notification');
const AuditLog = require('../../src/models/AuditLog');
const sessionService = require('../../src/services/sessionService');
const accountService = require('../../src/services/accountService');

const localUser = (overrides = {}) => ({
  _id: 'u1',
  name: 'Nguyễn Văn A',
  email: 'a@example.com',
  provider: 'local',
  role: 'user',
  isActive: true,
  avatar: 'https://x/y.png',
  providerId: null,
  watchedDistricts: ['Hải Châu'],
  comparePassword: jest.fn().mockResolvedValue(true),
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe('accountService.deleteAccount (B8)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Issue.updateMany.mockResolvedValue({ modifiedCount: 3 });
    AuditLog.updateMany.mockResolvedValue({ modifiedCount: 2 });
    Notification.deleteMany.mockResolvedValue({ deletedCount: 7 });
    User.countDocuments.mockResolvedValue(1);
    sessionService.revokeAllSessions.mockResolvedValue(2);
  });

  const mockUser = (user) => User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue(user),
  });

  describe('ẩn danh hoá thay vì xoá cứng', () => {
    // Xoá cứng sẽ kéo theo phiếu, bình luận và lịch sử xử lý, làm sai lệch mọi
    // thống kê đã công bố và phá tham chiếu changedBy/assignedBy.
    it('scrubs the identifying fields on the user record', async () => {
      const user = localUser();
      mockUser(user);

      await accountService.deleteAccount('u1', { password: 'pw' });

      expect(user.name).toBe(accountService.ANONYMIZED_NAME);
      expect(user.email).not.toBe('a@example.com');
      expect(user.avatar).toBeNull();
      expect(user.isActive).toBe(false);
      expect(user.watchedDistricts).toEqual([]);
      expect(user.save).toHaveBeenCalled();
    });

    it('produces a unique, non-reversible replacement email', async () => {
      const a = accountService.anonymizedEmail('a@example.com');
      const b = accountService.anonymizedEmail('b@example.com');

      expect(a).not.toBe(b);
      expect(a).not.toContain('a@example.com');
      // Phải vẫn là email hợp lệ vì model có unique index và validate định dạng.
      expect(a).toMatch(/^deleted-[a-f0-9]{24}@deleted\.invalid$/);
    });

    it('is stable for the same input so two runs do not collide differently', () => {
      expect(accountService.anonymizedEmail('a@example.com'))
        .toBe(accountService.anonymizedEmail('A@Example.com'));
    });

    // Để null thì vẫn còn một đường đăng nhập nếu có lỗi logic ở chỗ khác.
    it('replaces the password with a random value nobody knows', async () => {
      const user = localUser();
      mockUser(user);

      await accountService.deleteAccount('u1', { password: 'pw' });

      expect(user.password).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('PII nằm ngoài bảng User', () => {
    // Số điện thoại người báo cáo nhập khi gửi phiếu — không nằm ở User.
    it('removes the reporter phone from every issue they filed', async () => {
      mockUser(localUser());

      const result = await accountService.deleteAccount('u1', { password: 'pw' });

      expect(Issue.updateMany).toHaveBeenCalledWith(
        { userId: 'u1', phone: { $ne: null } },
        { $set: { phone: null } }
      );
      expect(result.anonymizedIssues).toBe(3);
    });

    it('keeps the issues themselves so statistics stay correct', async () => {
      mockUser(localUser());

      await accountService.deleteAccount('u1', { password: 'pw' });

      expect(Issue.deleteMany).not.toHaveBeenCalled();
    });

    // Giữ actorId để chuỗi trách nhiệm còn đọc được; chỉ gỡ dấu vết kỹ thuật.
    it('scrubs IP and user-agent from audit logs but keeps the trail', async () => {
      mockUser(localUser());

      await accountService.deleteAccount('u1', { password: 'pw' });

      expect(AuditLog.updateMany).toHaveBeenCalledWith(
        { actorId: 'u1' },
        { $set: { ipAddress: null, userAgent: null } }
      );
      expect(AuditLog.deleteMany).not.toHaveBeenCalled();
    });

    it('deletes notifications outright since they help nobody else', async () => {
      mockUser(localUser());

      const result = await accountService.deleteAccount('u1', { password: 'pw' });

      expect(Notification.deleteMany).toHaveBeenCalledWith({ userId: 'u1' });
      expect(result.deletedNotifications).toBe(7);
    });

    it('cuts every login session', async () => {
      mockUser(localUser());

      await accountService.deleteAccount('u1', { password: 'pw' });

      expect(sessionService.revokeAllSessions).toHaveBeenCalledWith('u1');
    });
  });

  describe('rào chắn', () => {
    // Xoá tài khoản không hoàn tác được, và access token có thể đã bị đánh cắp.
    it('requires the password for a local account', async () => {
      mockUser(localUser());

      await expect(accountService.deleteAccount('u1', {}))
        .rejects.toMatchObject({ statusCode: 400, code: 'PASSWORD_REQUIRED' });
    });

    it('refuses a wrong password', async () => {
      mockUser(localUser({ comparePassword: jest.fn().mockResolvedValue(false) }));

      await expect(accountService.deleteAccount('u1', { password: 'wrong' }))
        .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_PASSWORD' });
    });

    // Tài khoản Google không có mật khẩu để nhập.
    it('does not ask a Google account for a password', async () => {
      const user = localUser({ provider: 'google', comparePassword: jest.fn() });
      mockUser(user);

      await expect(accountService.deleteAccount('u1', {})).resolves.toBeTruthy();
      expect(user.comparePassword).not.toHaveBeenCalled();
    });

    // Admin cuối cùng tự xoá thì chỉ sửa trực tiếp database mới khôi phục được.
    it('refuses to delete the last remaining admin', async () => {
      mockUser(localUser({ role: 'admin' }));
      User.countDocuments.mockResolvedValue(0);

      await expect(accountService.deleteAccount('u1', { password: 'pw' }))
        .rejects.toMatchObject({ statusCode: 400, code: 'LAST_ADMIN' });
    });

    it('allows deleting an admin when another one remains', async () => {
      mockUser(localUser({ role: 'admin' }));
      User.countDocuments.mockResolvedValue(2);

      await expect(accountService.deleteAccount('u1', { password: 'pw' })).resolves.toBeTruthy();
    });

    it('writes nothing when a guard refuses', async () => {
      const user = localUser({ comparePassword: jest.fn().mockResolvedValue(false) });
      mockUser(user);

      await expect(accountService.deleteAccount('u1', { password: 'wrong' })).rejects.toThrow();

      expect(user.save).not.toHaveBeenCalled();
      expect(Issue.updateMany).not.toHaveBeenCalled();
      expect(Notification.deleteMany).not.toHaveBeenCalled();
    });

    it('raises 404 for a missing user', async () => {
      mockUser(null);

      await expect(accountService.deleteAccount('nope', { password: 'pw' }))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
