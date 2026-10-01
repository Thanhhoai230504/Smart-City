/**
 * Chính sách mật khẩu và khoá tài khoản — NGUỒN DUY NHẤT.
 *
 * Vấn đề trước đây: mật khẩu tối thiểu 6 ký tự, không kiểm tra gì thêm, và
 * KHÔNG khoá tài khoản sau N lần sai. `authStrictLimiter` dùng
 * `skipSuccessfulRequests: true` nên chỉ đếm request thất bại — 20 lần/15 phút
 * cho mỗi IP, và đổi IP là đếm lại từ đầu. Nghĩa là kẻ tấn công có ngân sách dò
 * mật khẩu KHÔNG giới hạn theo thời gian, nhắm vào mật khẩu 6 ký tự.
 *
 * Hướng xử lý theo NIST SP 800-63B: ưu tiên ĐỘ DÀI và chặn mật khẩu phổ biến,
 * KHÔNG ép quy tắc thành phần kiểu "phải có hoa + ký tự đặc biệt". Quy tắc thành
 * phần làm người dùng chọn `Passw0rd!` rồi ghi ra giấy — yếu hơn một cụm từ dài.
 */

/** Dài hơn mức cũ (6) nhưng vẫn gõ được trên bàn phím ảo. */
const MIN_PASSWORD_LENGTH = 8;

/** Chặn trần trên để không ai gửi chuỗi khổng lồ bắt bcrypt băm. */
const MAX_PASSWORD_LENGTH = 128;

/**
 * Chặn mật khẩu phổ biến nhất. Danh sách ngắn có chủ đích: nó bắt đúng phần đuôi
 * dài của các lần dò thực tế mà không cần tải tập dữ liệu hàng triệu dòng vào bộ nhớ.
 * So khớp sau khi hạ chữ thường và bỏ khoảng trắng.
 */
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'password123',
  'qwertyui', 'qwerty123', 'abc12345', '11111111', '00000000', 'iloveyou',
  'admin123', 'administrator', 'welcome1', 'letmein1', 'matkhau', 'matkhau123',
  'vietnam1', 'vietnam123', 'danang123', 'smartcity', 'smartcity123',
]);

/** Số lần sai liên tiếp trước khi khoá. */
const MAX_FAILED_ATTEMPTS = 5;

/**
 * Thời gian khoá tăng dần theo số lần vượt ngưỡng: 5 phút, 15, 60, rồi 24 giờ.
 * Tăng dần thay vì khoá cứng để người dùng thật gõ nhầm vài lần không bị chặn
 * cả ngày, trong khi kẻ dò tự động thì nhanh chóng mất hiệu quả.
 */
const LOCK_DURATIONS_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];

/**
 * Kiểm tra mật khẩu mới có đạt chính sách không.
 * @returns {{ ok: boolean, code?: string, message?: string }}
 */
const checkPasswordStrength = (password) => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      code: 'PASSWORD_TOO_SHORT',
      message: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`,
    };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      ok: false,
      code: 'PASSWORD_TOO_LONG',
      message: `Mật khẩu không quá ${MAX_PASSWORD_LENGTH} ký tự`,
    };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase().replace(/\s+/g, ''))) {
    return {
      ok: false,
      code: 'PASSWORD_TOO_COMMON',
      message: 'Mật khẩu này quá phổ biến và dễ bị dò. Hãy chọn mật khẩu khác.',
    };
  }
  // Một ký tự lặp lại suốt ('aaaaaaaa') vượt được kiểm tra độ dài nhưng không có
  // entropy nào.
  if (/^(.)\1+$/.test(password)) {
    return {
      ok: false,
      code: 'PASSWORD_TOO_SIMPLE',
      message: 'Mật khẩu không được chỉ gồm một ký tự lặp lại',
    };
  }
  return { ok: true };
};

/**
 * Thời điểm hết khoá sau lần sai thứ `failedAttempts`.
 * @returns {Date|null} null nếu chưa đủ ngưỡng khoá
 */
const getLockUntil = (failedAttempts, now = new Date()) => {
  if (failedAttempts < MAX_FAILED_ATTEMPTS) return null;
  // Lần vượt ngưỡng thứ mấy — dùng để chọn mức khoá trong thang tăng dần.
  const tier = Math.floor(failedAttempts / MAX_FAILED_ATTEMPTS) - 1;
  const duration = LOCK_DURATIONS_MS[Math.min(tier, LOCK_DURATIONS_MS.length - 1)];
  return new Date(now.getTime() + duration);
};

/** Tài khoản có đang bị khoá không. */
const isLocked = (user, now = new Date()) => (
  Boolean(user?.lockUntil && new Date(user.lockUntil).getTime() > now.getTime())
);

/** Số phút còn lại của lần khoá, làm tròn lên — để hiển thị cho người dùng. */
const minutesUntilUnlock = (user, now = new Date()) => {
  if (!isLocked(user, now)) return 0;
  return Math.ceil((new Date(user.lockUntil).getTime() - now.getTime()) / 60000);
};

module.exports = {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_FAILED_ATTEMPTS,
  LOCK_DURATIONS_MS,
  COMMON_PASSWORDS,
  checkPasswordStrength,
  getLockUntil,
  isLocked,
  minutesUntilUnlock,
};
