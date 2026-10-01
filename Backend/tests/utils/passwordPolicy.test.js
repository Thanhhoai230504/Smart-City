const {
  MIN_PASSWORD_LENGTH,
  MAX_FAILED_ATTEMPTS,
  checkPasswordStrength,
  getLockUntil,
  isLocked,
  minutesUntilUnlock,
} = require('../../src/utils/passwordPolicy');

describe('passwordPolicy.checkPasswordStrength', () => {
  it('accepts a reasonable password', () => {
    expect(checkPasswordStrength('bongden-hong-2026')).toEqual({ ok: true });
  });

  it(`rejects anything shorter than ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(checkPasswordStrength('abc123')).toMatchObject({ ok: false, code: 'PASSWORD_TOO_SHORT' });
  });

  it('rejects a non-string', () => {
    expect(checkPasswordStrength(undefined)).toMatchObject({ ok: false });
    expect(checkPasswordStrength(12345678)).toMatchObject({ ok: false });
  });

  // Chặn trần để không ai gửi chuỗi khổng lồ bắt bcrypt băm.
  it('rejects an absurdly long password', () => {
    expect(checkPasswordStrength('a1'.repeat(200)))
      .toMatchObject({ ok: false, code: 'PASSWORD_TOO_LONG' });
  });

  it.each(['12345678', 'password123', 'matkhau123', 'smartcity123', 'QWERTY123'])(
    'rejects the common password %s',
    (pw) => {
      expect(checkPasswordStrength(pw)).toMatchObject({ ok: false, code: 'PASSWORD_TOO_COMMON' });
    }
  );

  // 'aaaaaaaa' qua được kiểm tra độ dài nhưng không có entropy nào.
  it('rejects a single repeated character', () => {
    expect(checkPasswordStrength('aaaaaaaa')).toMatchObject({ ok: false, code: 'PASSWORD_TOO_SIMPLE' });
  });

  // Theo NIST SP 800-63B: ưu tiên độ dài, KHÔNG ép quy tắc thành phần. Ép hoa +
  // ký tự đặc biệt khiến người dùng chọn 'Passw0rd!' rồi ghi ra giấy.
  it('does not force composition rules on a long passphrase', () => {
    expect(checkPasswordStrength('con duong nguyen van linh co o ga')).toEqual({ ok: true });
  });
});

describe('passwordPolicy — khoá tài khoản', () => {
  const now = new Date('2026-10-01T12:00:00Z');

  it('does not lock before the threshold', () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      expect(getLockUntil(i, now)).toBeNull();
    }
  });

  it(`locks once there are ${MAX_FAILED_ATTEMPTS} consecutive failures`, () => {
    expect(getLockUntil(MAX_FAILED_ATTEMPTS, now)).toBeInstanceOf(Date);
  });

  // Tăng dần để người gõ nhầm vài lần không bị chặn cả ngày, còn kẻ dò tự động
  // thì nhanh chóng mất hiệu quả.
  it('escalates the lock duration on repeated rounds', () => {
    const first = getLockUntil(MAX_FAILED_ATTEMPTS, now).getTime();
    const second = getLockUntil(MAX_FAILED_ATTEMPTS * 2, now).getTime();
    const third = getLockUntil(MAX_FAILED_ATTEMPTS * 3, now).getTime();

    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
  });

  it('caps the escalation instead of growing without bound', () => {
    const high = getLockUntil(MAX_FAILED_ATTEMPTS * 50, now).getTime();
    const max = getLockUntil(MAX_FAILED_ATTEMPTS * 4, now).getTime();
    expect(high).toBe(max);
  });

  it('starts the first lock at a few minutes, not hours', () => {
    const ms = getLockUntil(MAX_FAILED_ATTEMPTS, now).getTime() - now.getTime();
    expect(ms).toBeLessThanOrEqual(10 * 60 * 1000);
  });

  describe('isLocked', () => {
    it('is false when there is no lock', () => {
      expect(isLocked({ lockUntil: null }, now)).toBe(false);
      expect(isLocked({}, now)).toBe(false);
      expect(isLocked(null, now)).toBe(false);
    });

    it('is true while the lock is in the future', () => {
      expect(isLocked({ lockUntil: new Date(now.getTime() + 60000) }, now)).toBe(true);
    });

    // Khoá phải tự hết hạn, không cần job dọn.
    it('expires on its own once the time passes', () => {
      expect(isLocked({ lockUntil: new Date(now.getTime() - 1000) }, now)).toBe(false);
    });
  });

  describe('minutesUntilUnlock', () => {
    it('rounds up so the user is never told to retry too early', () => {
      expect(minutesUntilUnlock({ lockUntil: new Date(now.getTime() + 61000) }, now)).toBe(2);
    });

    it('is zero when not locked', () => {
      expect(minutesUntilUnlock({ lockUntil: null }, now)).toBe(0);
    });
  });
});
