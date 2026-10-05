/**
 * Quy tắc mật khẩu phía web — khớp Backend/src/utils/passwordPolicy.js.
 *
 * Trước đây Đăng ký, Đặt lại mật khẩu và Đổi mật khẩu đều ghi "tối thiểu 6 ký tự"
 * trong khi backend đã nâng lên 8 (theo NIST SP 800-63B). Người dùng làm đúng
 * hướng dẫn trên màn hình vẫn bị từ chối. Mọi màn hình đọc chung hằng số ở đây.
 *
 * Client chỉ kiểm tra độ dài để báo lỗi sớm; danh sách mật khẩu phổ biến và luật
 * "một ký tự lặp lại" vẫn do backend phán quyết (thông báo đọc qua getApiErrorMessage).
 */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** Câu hướng dẫn hiển thị dưới ô mật khẩu. */
export const PASSWORD_HINT = `Tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`;

/** Câu lỗi tiếng Việt nếu mật khẩu chưa đạt độ dài, `null` nếu đạt. */
export const getPasswordLengthError = (password: string): string | null => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Mật khẩu không quá ${MAX_PASSWORD_LENGTH} ký tự`;
  }
  return null;
};
