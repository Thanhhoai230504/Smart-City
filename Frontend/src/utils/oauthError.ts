/**
 * Câu báo cho mã lỗi mà máy chủ gắn vào `/login?error=...` khi luồng đăng nhập Google
 * trên web không thành (Backend/src/routes/auth.js, authController.googleCallback).
 *
 * - `account_locked`: tài khoản Google đó đã bị quản trị viên khoá.
 * - `oauth_unavailable`: máy chủ chưa cấu hình GOOGLE_CLIENT_ID/SECRET nên tắt đăng nhập
 *   Google (trước đây thiếu cấu hình thì cả máy chủ không khởi động).
 * - còn lại (`oauth_failed`): bấm Huỷ ở trang Google, `state` không khớp hoặc đã hết hạn
 *   (quá 10 phút), mã đổi token sai...
 */
export const oauthErrorMessage = (code: string | null | undefined): string | null => {
  if (!code) return null;
  if (code === 'account_locked') return 'Tài khoản của bạn đã bị khoá. Vui lòng liên hệ quản trị viên.';
  if (code === 'oauth_unavailable') {
    return 'Đăng nhập bằng Google hiện chưa được bật trên máy chủ. Vui lòng đăng nhập bằng email.';
  }
  return 'Đăng nhập bằng Google thất bại. Vui lòng thử lại.';
};
