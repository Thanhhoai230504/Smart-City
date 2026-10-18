const crypto = require('crypto');

/**
 * Tham số `state` của luồng đăng nhập Google trên web (chống login CSRF).
 *
 * Không có `state` thì kẻ xấu tự bắt đầu luồng bằng tài khoản Google của mình, dừng ở
 * bước Google trả về (URL callback có `code` của họ) rồi lừa nạn nhân mở URL đó. Trình
 * duyệt nạn nhân nhận cookie phiên của tài khoản kẻ xấu: mọi phản ánh nạn nhân gửi sau
 * đó (vị trí, ảnh, số điện thoại) nằm trong tài khoản kẻ xấu đọc được.
 *
 * Cách làm: lúc bắt đầu (/api/auth/google) sinh chuỗi ngẫu nhiên, ghi vào cookie httpOnly
 * và gửi kèm sang Google; lúc quay về (/callback) Google trả lại đúng chuỗi đó — chỉ
 * trình duyệt đã bắt đầu luồng mới có cookie khớp. Khớp thì cookie bị xoá (dùng một lần).
 *
 * Không dùng `state: true` của Passport vì nó cần express-session, mà hệ thống không có
 * session phía máy chủ (JWT + refresh token).
 */

/** Đủ để chọn tài khoản và đồng ý quyền ở trang Google. */
const OAUTH_STATE_MAX_AGE = 10 * 60 * 1000;

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Production dùng tiền tố `__Host-`: trình duyệt chỉ nhận cookie này khi có `Secure`,
 * `Path=/` và KHÔNG có `Domain`, nên một tên miền "anh em" (vd. site khác cùng đuôi
 * `.io.vn`) không thể ghi sẵn một giá trị `state` do kẻ xấu chọn. Đuôi `io.vn` hiện đã
 * nằm trong Public Suffix List, tiền tố này để không phụ thuộc vào danh sách đó. Máy
 * phát triển chạy http nên không dùng được `Secure` — giữ tên thường.
 */
const oauthStateCookieName = () => (isProduction() ? '__Host-oauthState' : 'oauthState');

/**
 * Thuộc tính cookie — dùng chung cho lúc ghi và lúc xoá (xoá phải khớp thì trình duyệt
 * mới xoá). Google quay về bằng một lượt điều hướng GET cấp cao nhất từ site khác:
 * `SameSite=Lax` vẫn gửi cookie trong trường hợp đó.
 */
const oauthStateCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: 'lax',
  path: '/',
});

const createOAuthState = () => crypto.randomBytes(32).toString('base64url');

/** So khớp hằng thời gian; thiếu một trong hai phía là không khớp. */
const isMatchingOAuthState = (provided, expected) => {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = {
  OAUTH_STATE_MAX_AGE,
  oauthStateCookieName,
  oauthStateCookieOptions,
  createOAuthState,
  isMatchingOAuthState,
};
