jest.mock('../../src/models/RefreshSession');

const RefreshSession = require('../../src/models/RefreshSession');
const sessionService = require('../../src/services/sessionService');

// Model bị auto-mock nên static hashToken không còn thân thật; dựng lại một hàm
// xác định để assert được "token nào đã được hash". Cố ý KHÔNG chứa chuỗi gốc,
// để test "không lưu token thô" kiểm tra được điều có nghĩa thay vì khớp nhầm
// vào chính cái fake.
const fakeHash = (t) => Buffer.from(`h:${t}`).toString('base64');

describe('sessionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    RefreshSession.hashToken = jest.fn(fakeHash);
    RefreshSession.create.mockResolvedValue({ _id: 's1' });
    RefreshSession.updateOne.mockResolvedValue({ modifiedCount: 1 });
    RefreshSession.updateMany.mockResolvedValue({ modifiedCount: 1 });
  });

  describe('normalizeDeviceType / wantsTokenInBody', () => {
    it.each(['web', 'android', 'ios'])('keeps the known device type %s', (t) => {
      expect(sessionService.normalizeDeviceType(t)).toBe(t);
    });

    // Giá trị lạ từ client không được làm hỏng request, chỉ rơi về mặc định an toàn.
    it.each([undefined, null, 'desktop', 'ANDROID', 42, {}])(
      'falls back to web for an unexpected value (%p)',
      (t) => {
        expect(sessionService.normalizeDeviceType(t)).toBe('web');
      }
    );

    // Web giữ httpOnly cookie (JavaScript không đọc được) — an toàn hơn, không đổi.
    it('only hands the token to the body for mobile clients', () => {
      expect(sessionService.wantsTokenInBody('web')).toBe(false);
      expect(sessionService.wantsTokenInBody(undefined)).toBe(false);
      expect(sessionService.wantsTokenInBody('android')).toBe(true);
      expect(sessionService.wantsTokenInBody('ios')).toBe(true);
    });
  });

  describe('createSession', () => {
    it('stores only the hash, never the raw token', async () => {
      await sessionService.createSession('u1', 'raw-token', { deviceType: 'ios' });

      const doc = RefreshSession.create.mock.calls[0][0];
      expect(doc.tokenHash).toBe(fakeHash('raw-token'));
      expect(JSON.stringify(doc)).not.toContain('raw-token');
    });

    it('sets an expiry that matches the 7-day refresh token lifetime', async () => {
      const before = Date.now();
      await sessionService.createSession('u1', 'tok', {});

      const doc = RefreshSession.create.mock.calls[0][0];
      const ttl = doc.expiresAt.getTime() - before;
      expect(ttl).toBeGreaterThan(sessionService.REFRESH_TTL_MS - 5000);
      expect(ttl).toBeLessThanOrEqual(sessionService.REFRESH_TTL_MS + 5000);
    });

    it('truncates an over-long device name instead of rejecting it', async () => {
      await sessionService.createSession('u1', 'tok', { deviceName: 'x'.repeat(500) });

      expect(RefreshSession.create.mock.calls[0][0].deviceName).toHaveLength(120);
    });

    it('accepts a missing device name', async () => {
      await sessionService.createSession('u1', 'tok', {});
      expect(RefreshSession.create.mock.calls[0][0].deviceName).toBeNull();
    });

    // Đây là lý do B1 tồn tại: mở phiên mới KHÔNG được đụng tới phiên nào khác.
    it('does not revoke any other session', async () => {
      await sessionService.createSession('u1', 'tok', {});

      expect(RefreshSession.updateMany).not.toHaveBeenCalled();
      expect(RefreshSession.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('findActiveSession', () => {
    it('looks up by hash and excludes revoked or expired sessions', async () => {
      RefreshSession.findOne.mockResolvedValue({ _id: 's1' });

      await sessionService.findActiveSession('tok');

      const filter = RefreshSession.findOne.mock.calls[0][0];
      expect(filter.tokenHash).toBe(fakeHash('tok'));
      expect(filter.revokedAt).toBeNull();
      expect(filter.expiresAt.$gt).toBeInstanceOf(Date);
    });

    it('returns null without touching the database for an empty token', async () => {
      await expect(sessionService.findActiveSession(null)).resolves.toBeNull();
      expect(RefreshSession.findOne).not.toHaveBeenCalled();
    });
  });

  describe('rotateSession', () => {
    // Trước đây refresh không rotate: token bị đánh cắp dùng được trọn 7 ngày.
    it('revokes the old session and opens a new one for the same device', async () => {
      const session = { _id: 's1', userId: 'u1', deviceType: 'android', deviceName: 'Pixel' };

      await sessionService.rotateSession(session, 'new-tok');

      expect(RefreshSession.updateOne).toHaveBeenCalledWith(
        { _id: 's1' },
        expect.objectContaining({ revokedAt: expect.any(Date) })
      );
      const doc = RefreshSession.create.mock.calls[0][0];
      expect(doc).toMatchObject({ userId: 'u1', deviceType: 'android', deviceName: 'Pixel' });
      expect(doc.tokenHash).toBe(fakeHash('new-tok'));
    });
  });

  describe('revokeSession', () => {
    it('revokes exactly the session holding that token', async () => {
      await sessionService.revokeSession('tok');

      const filter = RefreshSession.updateMany.mock.calls[0][0];
      expect(filter.tokenHash).toBe(fakeHash('tok'));
      expect(filter.revokedAt).toBeNull();
    });

    it('is a no-op without a token', async () => {
      await expect(sessionService.revokeSession(undefined)).resolves.toBe(0);
      expect(RefreshSession.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('revokeAllSessions', () => {
    // Đổi mật khẩu phải cắt được phiên của kẻ tấn công trên MỌI thiết bị.
    it('revokes every active session of the user', async () => {
      await sessionService.revokeAllSessions('u1');

      expect(RefreshSession.updateMany).toHaveBeenCalledWith(
        { userId: 'u1', revokedAt: null },
        expect.objectContaining({ revokedAt: expect.any(Date) })
      );
    });

    it('reports how many sessions were cut', async () => {
      RefreshSession.updateMany.mockResolvedValue({ modifiedCount: 3 });
      await expect(sessionService.revokeAllSessions('u1')).resolves.toBe(3);
    });
  });
});
