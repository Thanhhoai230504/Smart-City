/**
 * Số điện thoại liên hệ trên phiếu báo cáo.
 *
 * Luật khớp validator của backend (Backend/src/validators/issueValidator.js):
 * `^(0|\+84)[0-9]{9,10}$` sau khi trim. Trước đây form không kiểm tra gì, người
 * dân gõ "0901 234 567" (có dấu cách — cách viết phổ biến nhất) thì bấm Gửi mới
 * bị server từ chối, kèm thông báo tiếng Anh "Validation failed".
 *
 * Thay vì bắt gõ lại, ta bỏ dấu cách/chấm/gạch/ngoặc người dùng thêm cho dễ đọc
 * rồi mới kiểm tra và gửi đi — số gửi lên luôn là dạng chuẩn để gọi `tel:`.
 */
const VN_PHONE_PATTERN = /^(0|\+84)[0-9]{9,10}$/;

/** "0901 234 567" → "0901234567"; "(0236) 3822.000" → "02363822000". */
export const normalizePhone = (value: string): string => value.trim().replace(/[\s.()-]/g, '');

/** Hợp lệ theo luật backend sau khi chuẩn hoá. Chuỗi rỗng KHÔNG hợp lệ — trường này tuỳ chọn nên nơi gọi tự bỏ qua khi rỗng. */
export const isValidPhone = (value: string): boolean => VN_PHONE_PATTERN.test(normalizePhone(value));

export const PHONE_FORMAT_HINT = 'Số điện thoại không hợp lệ — VD: 0901234567 hoặc +84901234567';
