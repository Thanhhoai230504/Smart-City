jest.mock('../../src/models/User');
jest.mock('../../src/services/sessionService');
jest.mock('../../src/services/emailService', () => ({ sendEmail: jest.fn() }));

const crypto = require('crypto');
const User = require('../../src/models/User');
const sessionService = require('../../src/services/sessionService');
const { sendEmail } = require('../../src/services/emailService');
const authService = require('../../src/services/authService');

const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

const localUser = (overrides = {}) => ({
  _id: 'u1',
  name: 'Nguyễn Văn A',
  email: 'a@example.com',
  provider: 'local',
  isActive: true,
  isVerified: true,
  passwordResetSentAt: null,
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe('authService — quên mật khẩu (B7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendEmail.mockResolvedValue(true);
    sessionService.revokeAllSessions.mockResolvedValue(2);
  });

  describe('forgotPassword', () => {
    it('stores only a hash of the reset token, never the token itself', async () => {
      const user = localUser();
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

      await authService.forgotPassword('a@example.com');

      expect(user.passwordResetTokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(user.passwordResetExpires.getTime()).toBeGreaterThan(Date.now());
      expect(sendEmail).toHaveBeenCalled();
    });

    it('puts the raw token in the email link but not in the database', async () => {
      const user = localUser();
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

      await authService.forgotPassword('a@example.com');

      const html = sendEmail.mock.calls[0][2];
      const match = html.match(/reset-password\?token=([a-f0-9]{64})/);
      expect(match).not.toBeNull();
      // Link chứa token thô; DB chỉ có hash của nó.
      expect(user.passwordResetTokenHash).toBe(hash(match[1]));
      expect(html).not.toContain(user.passwordResetTokenHash);
    });

    // Trả lời khác nhau cho email tồn tại và không tồn tại sẽ biến endpoint này
    // thành công cụ dò xem địa chỉ nào đã đăng ký.
    it('responds identically for an unknown email', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await expect(authService.forgotPassword('nobody@example.com'))
        .resolves.toEqual({ sent: true });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('responds identically for a deactivated account', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(localUser({ isActive: false })) });

      await expect(authService.forgotPassword('a@example.com')).resolves.toEqual({ sent: true });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    // Tài khoản Google không có mật khẩu để đặt lại — service lọc provider:'local'
    // ngay ở query nên không bao giờ gửi mail cho họ.
    it('only looks up local accounts', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await authService.forgotPassword('a@example.com');

      expect(User.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'local' })
      );
    });

    it('honours a cooldown so one address cannot be mail-bombed', async () => {
      const user = localUser({ passwordResetSentAt: new Date() });
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

      await authService.forgotPassword('a@example.com');

      expect(sendEmail).not.toHaveBeenCalled();
    });

    // Nhà cung cấp email lỗi thì cho thử lại ngay, đừng bắt chờ hết cooldown.
    it('clears the cooldown marker when the email fails to send', async () => {
      const user = localUser();
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
      sendEmail.mockResolvedValue(false);

      await authService.forgotPassword('a@example.com');

      expect(user.passwordResetSentAt).toBeNull();
    });

    it('uses a short lifetime because the link grants account access', () => {
      expect(authService.PASSWORD_RESET_TTL_MS).toBeLessThanOrEqual(60 * 60 * 1000);
    });
  });

  describe('resetPassword', () => {
    it('sets the new password and burns the token', async () => {
      const user = localUser({ passwordResetTokenHash: hash('tok'), passwordResetExpires: new Date(Date.now() + 1000) });
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

      await authService.resetPassword('tok', 'newpass123');

      expect(user.password).toBe('newpass123');
      expect(user.passwordResetTokenHash).toBeNull();
      expect(user.passwordResetExpires).toBeNull();
      expect(user.save).toHaveBeenCalled();
    });

    it('looks the token up by hash, never by the raw value', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(localUser()) });

      await authService.resetPassword('tok', 'newpass123');

      expect(User.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ passwordResetTokenHash: hash('tok') })
      );
    });

    // Người dùng đặt lại mật khẩu thường vì nghi tài khoản bị chiếm — phải cắt
    // được thiết bị của kẻ tấn công chứ không chỉ đổi mật khẩu.
    it('revokes every session so a thief is logged out everywhere', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(localUser()) });

      await authService.resetPassword('tok', 'newpass123');

      expect(sessionService.revokeAllSessions).toHaveBeenCalledWith('u1');
    });

    it('also marks the account verified, since the email was proven', async () => {
      const user = localUser({ isVerified: false });
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

      await authService.resetPassword('tok', 'newpass123');

      expect(user.isVerified).toBe(true);
    });

    it('refuses an unknown or expired token with a machine-readable code', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await expect(authService.resetPassword('bad', 'newpass123'))
        .rejects.toMatchObject({ statusCode: 400, code: 'RESET_TOKEN_INVALID' });
    });

    it('only accepts a token that has not expired', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(localUser()) });

      await authService.resetPassword('tok', 'newpass123');

      const filter = User.findOne.mock.calls[0][0];
      expect(filter.passwordResetExpires.$gt).toBeInstanceOf(Date);
    });
  });
});
