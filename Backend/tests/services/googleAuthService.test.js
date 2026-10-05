jest.mock('google-auth-library', () => {
  const verifyIdToken = jest.fn();
  return { OAuth2Client: jest.fn(() => ({ verifyIdToken })), __verifyIdToken: verifyIdToken };
});
jest.mock('../../src/models/User');
jest.mock('../../src/services/authService', () => ({ generateTokensForUser: jest.fn() }));
jest.mock('../../src/services/sessionService', () => ({ revokeAllSessions: jest.fn() }));

const { __verifyIdToken: verifyIdToken } = require('google-auth-library');
const User = require('../../src/models/User');
const { generateTokensForUser } = require('../../src/services/authService');
const { revokeAllSessions } = require('../../src/services/sessionService');
const {
  allowedAudiences,
  verifyGoogleIdToken,
  findOrCreateGoogleUser,
  loginWithGoogleIdToken,
} = require('../../src/services/googleAuthService');

const WEB_CLIENT_ID = 'web-client.apps.googleusercontent.com';
const ENV = { GOOGLE_CLIENT_ID: WEB_CLIENT_ID };

const ticket = (payload) => ({ getPayload: () => payload });
const googlePayload = (overrides = {}) => ({
  sub: 'google-sub-1',
  email: 'Nguoi.Dan@Gmail.com',
  email_verified: true,
  name: 'Nguyễn Văn An',
  picture: 'https://lh3.googleusercontent.com/a/avatar',
  ...overrides,
});

const expectApiError = async (promise, { status, code }) => {
  const error = await promise.catch((e) => e);
  expect(error).toBeInstanceOf(Error);
  expect(error.statusCode).toBe(status);
  expect(error.code).toBe(code);
  return error;
};

describe('googleAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('allowedAudiences()', () => {
    it('gồm client ID web và các client mobile khai thêm, bỏ khoảng trắng/ô rỗng', () => {
      expect(allowedAudiences({
        GOOGLE_CLIENT_ID: ` ${WEB_CLIENT_ID} `,
        GOOGLE_MOBILE_CLIENT_IDS: 'ios-client, ,  other-client ',
      })).toEqual([WEB_CLIENT_ID, 'ios-client', 'other-client']);
      expect(allowedAudiences({})).toEqual([]);
    });
  });

  describe('verifyGoogleIdToken()', () => {
    it('chưa cấu hình client ID → 503 và KHÔNG gọi thư viện (thư viện bỏ qua kiểm tra aud khi thiếu audience)', async () => {
      await expectApiError(verifyGoogleIdToken('token', {}), { status: 503, code: 'GOOGLE_SIGN_IN_DISABLED' });
      expect(verifyIdToken).not.toHaveBeenCalled();
    });

    it('luôn truyền danh sách audience cho thư viện', async () => {
      verifyIdToken.mockResolvedValue(ticket(googlePayload()));

      await verifyGoogleIdToken('id-token', { ...ENV, GOOGLE_MOBILE_CLIENT_IDS: 'ios-client' });

      expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'id-token', audience: [WEB_CLIENT_ID, 'ios-client'] });
    });

    it('token cấp cho app khác (sai aud) → 401 GOOGLE_TOKEN_INVALID', async () => {
      verifyIdToken.mockRejectedValue(new Error('Wrong recipient, payload audience != requiredAudience'));

      await expectApiError(verifyGoogleIdToken('token-of-other-app', ENV), { status: 401, code: 'GOOGLE_TOKEN_INVALID' });
    });

    it('token hết hạn / sai chữ ký → 401 GOOGLE_TOKEN_INVALID', async () => {
      verifyIdToken.mockRejectedValue(new Error('Token used too late, 1 > 0: {}'));
      await expectApiError(verifyGoogleIdToken('expired', ENV), { status: 401, code: 'GOOGLE_TOKEN_INVALID' });

      verifyIdToken.mockRejectedValue(new Error('Invalid token signature: x.y.z'));
      await expectApiError(verifyGoogleIdToken('forged', ENV), { status: 401, code: 'GOOGLE_TOKEN_INVALID' });
    });

    it('không tải được khoá công khai của Google → 503, không đổ lỗi cho token', async () => {
      verifyIdToken.mockRejectedValue(new Error('Failed to retrieve verification certificates: getaddrinfo ENOTFOUND'));

      const error = await expectApiError(verifyGoogleIdToken('token', ENV), { status: 503, code: undefined });
      expect(error.message).toMatch(/Google/);
    });

    it('payload thiếu sub hoặc email → 401 GOOGLE_TOKEN_INVALID', async () => {
      verifyIdToken.mockResolvedValue(ticket(googlePayload({ sub: undefined })));
      await expectApiError(verifyGoogleIdToken('token', ENV), { status: 401, code: 'GOOGLE_TOKEN_INVALID' });

      verifyIdToken.mockResolvedValue(ticket(googlePayload({ email: undefined })));
      await expectApiError(verifyGoogleIdToken('token', ENV), { status: 401, code: 'GOOGLE_TOKEN_INVALID' });
    });

    it('email chưa được Google xác minh → 401 GOOGLE_EMAIL_NOT_VERIFIED (chặn chiếm tài khoản local cùng email)', async () => {
      verifyIdToken.mockResolvedValue(ticket(googlePayload({ email_verified: false })));
      await expectApiError(verifyGoogleIdToken('token', ENV), { status: 401, code: 'GOOGLE_EMAIL_NOT_VERIFIED' });

      verifyIdToken.mockResolvedValue(ticket(googlePayload({ email_verified: undefined })));
      await expectApiError(verifyGoogleIdToken('token', ENV), { status: 401, code: 'GOOGLE_EMAIL_NOT_VERIFIED' });
    });

    it('token hợp lệ → hồ sơ Google', async () => {
      verifyIdToken.mockResolvedValue(ticket(googlePayload()));

      await expect(verifyGoogleIdToken('token', ENV)).resolves.toEqual({
        googleId: 'google-sub-1',
        email: 'Nguoi.Dan@Gmail.com',
        name: 'Nguyễn Văn An',
        avatar: 'https://lh3.googleusercontent.com/a/avatar',
      });
    });
  });

  describe('findOrCreateGoogleUser()', () => {
    const profile = {
      googleId: 'google-sub-1',
      email: ' Nguoi.Dan@Gmail.com ',
      name: 'Nguyễn Văn An',
      avatar: 'https://lh3.googleusercontent.com/a/avatar',
    };

    it('đã có tài khoản Google → dùng lại, không tạo mới', async () => {
      const existing = { isVerified: true, save: jest.fn() };
      User.findOne.mockResolvedValueOnce(existing);

      await expect(findOrCreateGoogleUser(profile)).resolves.toBe(existing);
      expect(User.findOne).toHaveBeenCalledWith({ provider: 'google', providerId: 'google-sub-1' });
      expect(existing.save).not.toHaveBeenCalled();
      expect(User.create).not.toHaveBeenCalled();
    });

    it('tài khoản Google cũ chưa đánh dấu xác minh → đánh dấu rồi lưu', async () => {
      const existing = { isVerified: false, save: jest.fn() };
      User.findOne.mockResolvedValueOnce(existing);

      await findOrCreateGoogleUser(profile);

      expect(existing.isVerified).toBe(true);
      expect(existing.save).toHaveBeenCalled();
    });

    it('có tài khoản local ĐÃ xác thực cùng email → liên kết, giữ mật khẩu của chủ email', async () => {
      const local = {
        _id: 'u-local',
        name: 'Tên cũ',
        provider: 'local',
        isVerified: true,
        password: '$2a$10$hash-cua-chu-email',
        save: jest.fn(),
      };
      User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(local);

      await expect(findOrCreateGoogleUser(profile)).resolves.toBe(local);

      expect(User.findOne).toHaveBeenLastCalledWith({ email: 'nguoi.dan@gmail.com', provider: 'local' });
      expect(local).toMatchObject({
        provider: 'google',
        providerId: 'google-sub-1',
        avatar: profile.avatar,
        isVerified: true,
        password: '$2a$10$hash-cua-chu-email',
        name: 'Tên cũ',
      });
      expect(local.save).toHaveBeenCalled();
      expect(revokeAllSessions).not.toHaveBeenCalled();
      expect(User.create).not.toHaveBeenCalled();
    });

    it('tài khoản local CHƯA xác thực (có thể do kẻ xấu đăng ký trước) → xoá mật khẩu, thu hồi phiên, lấy tên Google', async () => {
      const local = {
        _id: 'u-squatter',
        name: 'Kẻ đăng ký trước',
        provider: 'local',
        isVerified: false,
        password: '$2a$10$hash-cua-ke-xau',
        emailVerificationTokenHash: 'hash',
        emailVerificationExpires: new Date(),
        passwordResetTokenHash: 'reset-hash',
        passwordResetExpires: new Date(),
        failedLoginAttempts: 3,
        save: jest.fn(),
      };
      User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(local);

      await findOrCreateGoogleUser(profile);

      expect(local).toMatchObject({
        provider: 'google',
        providerId: 'google-sub-1',
        isVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpires: null,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        lockUntil: null,
        name: 'Nguyễn Văn An',
      });
      // Mật khẩu kẻ xấu đặt không còn đăng nhập được nữa.
      expect(local.password).toBeUndefined();
      expect(local.save).toHaveBeenCalled();
      expect(revokeAllSessions).toHaveBeenCalledWith('u-squatter');
    });

    it('chưa có gì → tạo tài khoản provider google, đã xác minh, email chữ thường', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockImplementation(async (doc) => doc);

      await findOrCreateGoogleUser(profile);

      expect(User.create).toHaveBeenCalledWith({
        name: 'Nguyễn Văn An',
        email: 'nguoi.dan@gmail.com',
        provider: 'google',
        providerId: 'google-sub-1',
        avatar: profile.avatar,
        isVerified: true,
      });
    });

    it('token không kèm tên → lấy phần trước @; tên quá dài bị cắt cho vừa User.name', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockImplementation(async (doc) => doc);

      await findOrCreateGoogleUser({ ...profile, name: undefined });
      expect(User.create).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'nguoi.dan' }));

      await findOrCreateGoogleUser({ ...profile, name: 'A'.repeat(150) });
      expect(User.create.mock.calls.at(-1)[0].name).toHaveLength(100);
    });
  });

  describe('loginWithGoogleIdToken()', () => {
    const savedEnv = { ...process.env };
    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = WEB_CLIENT_ID;
      verifyIdToken.mockResolvedValue(ticket(googlePayload()));
    });
    afterEach(() => {
      process.env = { ...savedEnv };
    });

    it('tài khoản bị vô hiệu hoá → 403, không cấp phiên', async () => {
      User.findOne.mockResolvedValueOnce({ isVerified: true, isActive: false, save: jest.fn() });

      const error = await loginWithGoogleIdToken({ idToken: 'token', deviceType: 'android' }).catch((e) => e);

      expect(error.statusCode).toBe(403);
      expect(generateTokensForUser).not.toHaveBeenCalled();
    });

    it('thành công → cấp phiên theo thiết bị qua đúng đường của /login', async () => {
      const user = { _id: 'u1', isVerified: true, isActive: true, save: jest.fn() };
      User.findOne.mockResolvedValueOnce(user);
      generateTokensForUser.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', tokenInBody: true });

      await expect(loginWithGoogleIdToken({
        idToken: 'token',
        deviceType: 'android',
        deviceName: 'Pixel 9a',
      })).resolves.toMatchObject({ accessToken: 'a', refreshToken: 'r' });

      expect(generateTokensForUser).toHaveBeenCalledWith(user, { deviceType: 'android', deviceName: 'Pixel 9a' });
    });
  });
});
