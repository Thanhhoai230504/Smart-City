/** Số giây chờ giữa hai lần gửi lại thư xác thực — khớp `RESEND_COOLDOWN_MS` của backend và màn hình của app. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** `location.state` mà trang Đăng ký truyền sang trang "Xác thực email". */
export interface VerifyEmailNavState {
  justRegistered?: boolean;
  /** `verificationEmailSent` máy chủ trả về khi đăng ký; `false` = gửi lỗi, gửi lại được ngay. */
  emailSent?: boolean;
}

/**
 * Đếm ngược ban đầu của nút "Gửi lại email xác thực".
 *
 * Máy chủ bỏ qua yêu cầu gửi lại trong 60 giây kể từ thư trước nhưng vẫn trả lời
 * "đã gửi" (để không lộ email nào đã đăng ký). Trước đây trang mở ra với nút bấm
 * được ngay sau khi đăng ký: bấm là thấy "đã gửi" mà không có thư nào. Vừa đăng ký
 * và thư đầu đã gửi được thì đếm ngược ngay từ đầu, như màn hình của app. Vào từ
 * trang đăng nhập (tài khoản cũ chưa xác thực) thì không biết thư trước gửi lúc nào,
 * nên để máy chủ quyết định.
 */
export const initialResendCooldown = (state: unknown): number => {
  const nav = (state ?? {}) as VerifyEmailNavState;
  return nav.justRegistered === true && nav.emailSent !== false ? RESEND_COOLDOWN_SECONDS : 0;
};
