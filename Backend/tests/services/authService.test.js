jest.mock('../../src/models/User');
jest.mock('../../src/services/sessionService');
jest.mock('jsonwebtoken');
jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const User = require('../../src/models/User');
const sessionService = require('../../src/services/sessionService');
const { sendEmail } = require('../../src/services/emailService');
const authService = require('../../src/services/authService');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendEmail.mockResolvedValue(true);
    // Phiên đăng nhập giờ nằm ở collection riêng (models/RefreshSession) thay vì
    // một field trên User — xem B1 trong KE-HOACH-FLUTTER-APP.md.
    sessionService.createSession.mockResolvedValue({ _id: 'sess1' });
    sessionService.rotateSession.mockResolvedValue({ _id: 'sess2' });
    sessionService.revokeSession.mockResolvedValue(1);
    sessionService.revokeAllSessions.mockResolvedValue(1);
    sessionService.wantsTokenInBody.mockReturnValue(false);
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
        password: 'bongden-hong-2026',
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
        password: 'bongden-hong-2026',
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

      const result = await authService.loginUser({
        email: 'test@test.com',
        password: '123456',
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.email).toBe('test@test.com');
      expect(sessionService.createSession).toHaveBeenCalledWith(
        'user123', 'refresh-token', expect.any(Object)
      );
    });

    // Điểm cốt lõi của B1: đăng nhập trên thiết bị mới KHÔNG được đá thiết bị cũ.
    // Trước đây User.refreshToken là một field nên mỗi lần login là ghi đè.
    it('does not revoke sessions on other devices when logging in', async () => {
      mockUserDoc.comparePassword.mockResolvedValue(true);
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUserDoc) });
      jwt.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      await authService.loginUser({
        email: 'test@test.com',
        password: '123456',
        deviceType: 'android',
        deviceName: 'Pixel 8',
      });

      expect(sessionService.revokeAllSessions).not.toHaveBeenCalled();
      expect(sessionService.createSession).toHaveBeenCalledWith(
        'user123',
        'refresh-token',
        { deviceType: 'android', deviceName: 'Pixel 8' }
      );
    });

    // Flutter native không có cookie jar nên phải nhận token qua body; web giữ
    // nguyên httpOnly cookie. Controller đọc cờ này để quyết định.
    it('flags mobile logins so the controller returns the token in the body', async () => {
      mockUserDoc.comparePassword.mockResolvedValue(true);
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUserDoc) });
      jwt.sign.mockReturnValue('tok');
      sessionService.wantsTokenInBody.mockReturnValue(true);

      const result = await authService.loginUser({
        email: 'test@test.com',
        password: '123456',
        deviceType: 'ios',
      });

      expect(result.tokenInBody).toBe(true);
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

  // Hồi quy: thiếu `jti`, hai lần ký trong cùng một giây cho ra JWT giống hệt
  // nhau và lần đăng nhập thứ hai vỡ vì unique index trên RefreshSession.tokenHash.
  // Smoke test trên server thật bắt được lỗi này; unit test mock sessionService thì không.
  describe('generateRefreshToken uniqueness', () => {
    it('includes a random jti so two tokens in the same second differ', async () => {
      const realJwt = jest.requireActual('jsonwebtoken');
      jwt.sign.mockImplementation((payload, secret, opts) => realJwt.sign(payload, secret, opts));
      const userDoc = {
        _id: 'user123',
        email: 'test@test.com',
        role: 'user',
        provider: 'local',
        isActive: true,
        isVerified: true,
        comparePassword: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(userDoc) });

      const a = await authService.loginUser({ email: 'test@test.com', password: '123456' });
      const b = await authService.loginUser({ email: 'test@test.com', password: '123456' });

      expect(a.refreshToken).not.toBe(b.refreshToken);
    });
  });

  // ─── G18: khoá tài khoản sau N lần sai liên tiếp ───
  // Rate limiter theo IP không đủ: nó dùng skipSuccessfulRequests nên chỉ đếm
  // request hỏng, và đổi IP là đếm lại từ đầu. Đếm theo TÀI KHOẢN mới chặn được
  // việc dò một tài khoản cụ thể.
  describe('khoa tai khoan khi dang nhap sai', () => {
    const lockableUser = (overrides = {}) => ({
      _id: 'user123',
      email: 'test@test.com',
      role: 'user',
      provider: 'local',
      isActive: true,
      isVerified: true,
      failedLoginAttempts: 0,
      lockUntil: null,
      comparePassword: jest.fn().mockResolvedValue(false),
      ...overrides,
    });

    it('counts a wrong password against the account', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(lockableUser()) });

      await expect(authService.loginUser({ email: 'test@test.com', password: 'wrong' }))
        .rejects.toThrow('Invalid email or password.');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({ failedLoginAttempts: 1 })
      );
    });

    it('locks the account once the threshold is reached', async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(lockableUser({ failedLoginAttempts: 4 })),
      });

      await expect(authService.loginUser({ email: 'test@test.com', password: 'wrong' }))
        .rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });

      const update = User.findByIdAndUpdate.mock.calls[0][1];
      expect(update.failedLoginAttempts).toBe(5);
      expect(update.lockUntil).toBeInstanceOf(Date);
    });

    it('refuses a locked account before even checking the password', async () => {
      const user = lockableUser({ lockUntil: new Date(Date.now() + 60_000) });
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

      await expect(authService.loginUser({ email: 'test@test.com', password: 'anything' }))
        .rejects.toMatchObject({ statusCode: 403, code: 'ACCOUNT_LOCKED' });

      // Không chạy bcrypt khi đang khoá — vừa đỡ tốn CPU, vừa không cho kẻ dò
      // đo thời gian phản hồi để suy ra mật khẩu đúng hay sai.
      expect(user.comparePassword).not.toHaveBeenCalled();
    });

    it('lets the account back in once the lock expires', async () => {
      const user = lockableUser({
        lockUntil: new Date(Date.now() - 1000),
        failedLoginAttempts: 5,
        comparePassword: jest.fn().mockResolvedValue(true),
      });
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
      jwt.sign.mockReturnValue('tok');

      await expect(authService.loginUser({ email: 'test@test.com', password: 'right' }))
        .resolves.toBeTruthy();
    });

    // Chuỗi sai phải LIÊN TIẾP mới dẫn tới khoá.
    it('resets the counter after a successful login', async () => {
      const user = lockableUser({
        failedLoginAttempts: 3,
        comparePassword: jest.fn().mockResolvedValue(true),
      });
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
      jwt.sign.mockReturnValue('tok');

      await authService.loginUser({ email: 'test@test.com', password: 'right' });

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { failedLoginAttempts: 0, lockUntil: null }
      );
    });

    it('does not write on a clean successful login', async () => {
      const user = lockableUser({ comparePassword: jest.fn().mockResolvedValue(true) });
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
      jwt.sign.mockReturnValue('tok');

      await authService.loginUser({ email: 'test@test.com', password: 'right' });

      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    // Không tiết lộ còn bao nhiêu lần thử — thông tin đó giúp kẻ dò căn nhịp.
    it('does not reveal how many attempts remain', async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(lockableUser({ failedLoginAttempts: 3 })),
      });

      await expect(authService.loginUser({ email: 'test@test.com', password: 'wrong' }))
        .rejects.toThrow('Invalid email or password.');
    });
  });

  describe('refreshAccessToken()', () => {
    it('should throw if no refresh token provided', async () => {
      await expect(authService.refreshAccessToken(null)).rejects.toThrow('No refresh token provided.');
    });

    // Token đã rotate hoặc đã thu hồi thì không còn phiên nào khớp.
    it('should throw when no active session matches the token', async () => {
      jwt.verify.mockReturnValue({ id: 'user123' });
      sessionService.findActiveSession.mockResolvedValue(null);

      await expect(authService.refreshAccessToken('old-token')).rejects.toThrow('Invalid refresh token.');
    });

    it('should throw when the session belongs to a different user', async () => {
      jwt.verify.mockReturnValue({ id: 'user123' });
      sessionService.findActiveSession.mockResolvedValue({
        _id: 's1', userId: 'someoneElse', deviceType: 'web',
      });

      await expect(authService.refreshAccessToken('tok')).rejects.toThrow('Invalid refresh token.');
    });

    it('should return new access token on valid refresh', async () => {
      jwt.verify.mockReturnValue({ id: 'user123' });
      sessionService.findActiveSession.mockResolvedValue({
        _id: 's1', userId: 'user123', deviceType: 'web',
      });
      User.findById.mockResolvedValue({
        _id: 'user123', email: 'test@test.com', role: 'user', isActive: true,
      });
      jwt.sign.mockReturnValue('new-access-token');

      const result = await authService.refreshAccessToken('valid-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
    });

    // Trước đây refresh KHÔNG rotate: một token bị đánh cắp dùng được trọn 7 ngày.
    it('rotates the refresh token so a stolen one dies after a single use', async () => {
      jwt.verify.mockReturnValue({ id: 'user123' });
      const session = { _id: 's1', userId: 'user123', deviceType: 'web' };
      sessionService.findActiveSession.mockResolvedValue(session);
      User.findById.mockResolvedValue({ _id: 'user123', role: 'user', isActive: true });
      jwt.sign.mockReturnValueOnce('new-access').mockReturnValueOnce('new-refresh');

      const result = await authService.refreshAccessToken('old-refresh');

      expect(sessionService.rotateSession).toHaveBeenCalledWith(session, 'new-refresh');
      expect(result.refreshToken).toBe('new-refresh');
    });

    it('refuses a deactivated account even with a valid session', async () => {
      jwt.verify.mockReturnValue({ id: 'user123' });
      sessionService.findActiveSession.mockResolvedValue({
        _id: 's1', userId: 'user123', deviceType: 'web',
      });
      User.findById.mockResolvedValue({ _id: 'user123', isActive: false });

      await expect(authService.refreshAccessToken('tok')).rejects.toThrow('Invalid refresh token.');
    });
  });

  describe('logoutUser()', () => {
    // Đăng xuất chỉ cắt THIẾT BỊ ĐANG DÙNG, không đá các thiết bị khác ra.
    it('revokes only the session of the device being used', async () => {
      await authService.logoutUser('user123', 'this-device-token');

      expect(sessionService.revokeSession).toHaveBeenCalledWith('this-device-token');
      expect(sessionService.revokeAllSessions).not.toHaveBeenCalled();
    });

    it('does not fail when the refresh token is already gone', async () => {
      await expect(authService.logoutUser('user123', undefined)).resolves.toBeUndefined();
      expect(sessionService.revokeSession).not.toHaveBeenCalled();
    });
  });

  describe('getProfile()', () => {
    // Query mongoose có .populate() trả về chính nó rồi mới resolve.
    const queryResolving = (value) => ({ populate: jest.fn().mockResolvedValue(value) });

    it('should throw if user not found', async () => {
      User.findById.mockReturnValue(queryResolving(null));

      await expect(authService.getProfile('invalid')).rejects.toThrow('User not found.');
    });

    it('should return user profile', async () => {
      const mockUser = { _id: 'user123', name: 'Test', email: 'test@test.com' };
      User.findById.mockReturnValue(queryResolving(mockUser));

      const result = await authService.getProfile('user123');

      expect(result).toEqual(mockUser);
    });

    // App cán bộ hiện tên đơn vị trên tab "Công việc"; trước đây profile chỉ trả
    // ObjectId nên app phải gọi thêm một request. Chỉ lấy `name code` — đúng hai
    // field web (StaffDashboard, WorkspaceSidebar) đang đọc.
    it('populate tên + mã đơn vị của cán bộ', async () => {
      const query = queryResolving({ _id: 'staff1' });
      User.findById.mockReturnValue(query);

      await authService.getProfile('staff1');

      expect(query.populate).toHaveBeenCalledWith('departmentId', 'name code');
    });
  });

  describe('updateProfile()', () => {
    it('should throw if nothing to update', async () => {
      await expect(authService.updateProfile('user123', { name: '' })).rejects.toThrow('Nothing to update');
    });

    it('should update and return user', async () => {
      const updatedUser = { _id: 'user123', name: 'New Name' };
      const query = { populate: jest.fn().mockResolvedValue(updatedUser) };
      User.findByIdAndUpdate.mockReturnValue(query);

      const result = await authService.updateProfile('user123', { name: 'New Name' });

      expect(result).toEqual(updatedUser);
      // Cùng hình dạng với getProfile — client không phải xử lý hai kiểu.
      expect(query.populate).toHaveBeenCalledWith('departmentId', 'name code');
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

    // Chính sách mật khẩu giờ nằm ở utils/passwordPolicy.js và áp cho MỌI đường
    // đặt mật khẩu (đăng ký, đổi, đặt lại) — xem tests/utils/passwordPolicy.test.js.
    it('should throw if newPassword is too short', async () => {
      await expect(authService.changePassword('user123', { currentPassword: 'old', newPassword: '12345' }))
        .rejects.toMatchObject({ statusCode: 400, code: 'PASSWORD_TOO_SHORT' });
    });

    it('should reject a common password even when long enough', async () => {
      await expect(authService.changePassword('user123', { currentPassword: 'old', newPassword: 'password123' }))
        .rejects.toMatchObject({ code: 'PASSWORD_TOO_COMMON' });
    });

    it('should throw if current password is wrong', async () => {
      const mockUser = { comparePassword: jest.fn().mockResolvedValue(false) };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      await expect(
        authService.changePassword('user123', { currentPassword: 'wrong', newPassword: 'bongden-hong-2026' })
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
