jest.mock('../../src/models/User');
jest.mock('jsonwebtoken');
jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const User = require('../../src/models/User');
const { sendEmail } = require('../../src/services/emailService');
const authService = require('../../src/services/authService');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendEmail.mockResolvedValue(true);
  });

  describe('registerUser()', () => {
    it('should throw if email already exists', async () => {
      User.findOne.mockResolvedValue({ email: 'test@test.com' });

      await expect(
        authService.registerUser({ name: 'Test', email: 'test@test.com', password: '123456' })
      ).rejects.toThrow('Email already registered.');
    });

    it('should create and return new user', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        _id: 'user123',
        name: 'Test User',
        email: 'test@test.com',
        role: 'user',
      });

      const result = await authService.registerUser({
        name: 'Test User',
        email: 'test@test.com',
        password: '123456',
      });

      expect(result).toEqual({
        id: 'user123',
        name: 'Test User',
        email: 'test@test.com',
        role: 'user',
        isVerified: false,
        verificationEmailSent: true,
      });
      expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test User',
        email: 'test@test.com',
        password: '123456',
        isVerified: false,
        emailVerificationTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        emailVerificationExpires: expect.any(Date),
        emailVerificationSentAt: expect.any(Date),
      }));
      expect(sendEmail).toHaveBeenCalledWith(
        'test@test.com',
        expect.stringContaining('Smart City'),
        expect.stringContaining('/verify-email?token=')
      );
    });
  });

  describe('loginUser()', () => {
    const mockUserDoc = {
      _id: 'user123',
      name: 'Test',
      email: 'test@test.com',
      role: 'user',
      isActive: true,
      comparePassword: jest.fn(),
    };

    it('should throw if user not found', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await expect(
        authService.loginUser({ email: 'none@test.com', password: '123456' })
      ).rejects.toThrow('Invalid email or password.');
    });

    it('should throw if account is deactivated', async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({ ...mockUserDoc, isActive: false }),
      });

      await expect(
        authService.loginUser({ email: 'test@test.com', password: '123456' })
      ).rejects.toThrow('Account has been deactivated.');
    });

    it('should throw if password does not match', async () => {
      mockUserDoc.comparePassword.mockResolvedValue(false);
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUserDoc),
      });

      await expect(
        authService.loginUser({ email: 'test@test.com', password: 'wrong' })
      ).rejects.toThrow('Invalid email or password.');
    });

    it('should return tokens and user on success', async () => {
      mockUserDoc.comparePassword.mockResolvedValue(true);
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUserDoc),
      });
      jwt.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      User.findByIdAndUpdate.mockResolvedValue(null);

      const result = await authService.loginUser({
        email: 'test@test.com',
        password: '123456',
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.email).toBe('test@test.com');
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user123', { refreshToken: 'refresh-token' });
    });

    it('should block an unverified local account after a valid password', async () => {
      const unverifiedUser = {
        ...mockUserDoc,
        provider: 'local',
        isVerified: false,
        comparePassword: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(unverifiedUser),
      });

      await expect(
        authService.loginUser({ email: 'test@test.com', password: '123456' })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
      });
    });
  });

  describe('verifyEmail()', () => {
    it('should verify a valid token and clear its stored hash', async () => {
      const user = {
        _id: 'user123',
        name: 'Test',
        email: 'test@test.com',
        isVerified: false,
        emailVerificationTokenHash: 'old-hash',
        emailVerificationExpires: new Date(),
        emailVerificationSentAt: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      const result = await authService.verifyEmail('a'.repeat(64));

      expect(User.findOne).toHaveBeenCalledWith(expect.objectContaining({
        emailVerificationTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        isVerified: false,
      }));
      expect(user.isVerified).toBe(true);
      expect(user.emailVerificationTokenHash).toBeNull();
      expect(user.emailVerificationExpires).toBeNull();
      expect(user.save).toHaveBeenCalled();
      expect(result.isVerified).toBe(true);
    });

    it('should reject an invalid or expired token', async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(authService.verifyEmail('b'.repeat(64)))
        .rejects.toThrow('Liên kết xác thực không hợp lệ hoặc đã hết hạn.');
    });
  });

  describe('resendVerificationEmail()', () => {
    it('should issue a new token and send a verification email', async () => {
      const user = {
        email: 'test@test.com',
        name: 'Test',
        provider: 'local',
        isVerified: false,
        emailVerificationSentAt: new Date(Date.now() - 120000),
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await expect(authService.resendVerificationEmail(' TEST@TEST.COM '))
        .resolves.toEqual({ sent: true });

      expect(User.findOne).toHaveBeenCalledWith({
        email: 'test@test.com',
        provider: 'local',
      });
      expect(user.emailVerificationTokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(user.emailVerificationExpires).toBeInstanceOf(Date);
      expect(user.save).toHaveBeenCalled();
      expect(sendEmail).toHaveBeenCalled();
    });

    it('should enforce the resend cooldown without revealing account state', async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          provider: 'local',
          isVerified: false,
          emailVerificationSentAt: new Date(),
        }),
      });

      await expect(authService.resendVerificationEmail('test@test.com'))
        .resolves.toEqual({ sent: true });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should not reveal whether an email exists or is already verified', async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(authService.resendVerificationEmail('none@test.com'))
        .resolves.toEqual({ sent: true });
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken()', () => {
    it('should throw if no refresh token provided', async () => {
      await expect(authService.refreshAccessToken(null)).rejects.toThrow('No refresh token provided.');
    });

    it('should throw if token is invalid or does not match stored', async () => {
      jwt.verify.mockReturnValue({ id: 'user123' });
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ refreshToken: 'different-token' }),
      });

      await expect(authService.refreshAccessToken('old-token')).rejects.toThrow('Invalid refresh token.');
    });

    it('should return new access token on valid refresh', async () => {
      jwt.verify.mockReturnValue({ id: 'user123' });
      const mockUser = {
        _id: 'user123',
        email: 'test@test.com',
        role: 'user',
        refreshToken: 'valid-refresh-token',
      };
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      jwt.sign.mockReturnValue('new-access-token');

      const result = await authService.refreshAccessToken('valid-refresh-token');

      expect(result).toBe('new-access-token');
    });
  });

  describe('logoutUser()', () => {
    it('should clear refreshToken for user', async () => {
      User.findByIdAndUpdate.mockResolvedValue(null);

      await authService.logoutUser('user123');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user123', { refreshToken: null });
    });
  });

  describe('getProfile()', () => {
    it('should throw if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await expect(authService.getProfile('invalid')).rejects.toThrow('User not found.');
    });

    it('should return user profile', async () => {
      const mockUser = { _id: 'user123', name: 'Test', email: 'test@test.com' };
      User.findById.mockResolvedValue(mockUser);

      const result = await authService.getProfile('user123');

      expect(result).toEqual(mockUser);
    });
  });

  describe('updateProfile()', () => {
    it('should throw if nothing to update', async () => {
      await expect(authService.updateProfile('user123', { name: '' })).rejects.toThrow('Nothing to update');
    });

    it('should update and return user', async () => {
      const updatedUser = { _id: 'user123', name: 'New Name' };
      User.findByIdAndUpdate.mockResolvedValue(updatedUser);

      const result = await authService.updateProfile('user123', { name: 'New Name' });

      expect(result).toEqual(updatedUser);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { name: 'New Name' },
        { new: true, runValidators: true }
      );
    });
  });

  describe('changePassword()', () => {
    it('should throw if currentPassword or newPassword missing', async () => {
      await expect(authService.changePassword('user123', { currentPassword: '', newPassword: '' }))
        .rejects.toThrow('Current password and new password are required');
    });

    it('should throw if newPassword is too short', async () => {
      await expect(authService.changePassword('user123', { currentPassword: 'old', newPassword: '12345' }))
        .rejects.toThrow('New password must be at least 6 characters');
    });

    it('should throw if current password is wrong', async () => {
      const mockUser = { comparePassword: jest.fn().mockResolvedValue(false) };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      await expect(
        authService.changePassword('user123', { currentPassword: 'wrong', newPassword: '123456' })
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should change password successfully', async () => {
      const mockUser = {
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
        password: 'oldHash',
      };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      await authService.changePassword('user123', {
        currentPassword: 'oldpass',
        newPassword: 'newpass123',
      });

      expect(mockUser.password).toBe('newpass123');
      expect(mockUser.save).toHaveBeenCalled();
    });
  });
});
