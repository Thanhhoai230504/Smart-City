/**
 * Chuyển trang thì có kéo về đầu trang không.
 *
 * BrowserRouter không tự cuộn: trang mới mở ra ở đúng độ cuộn của trang cũ, nên
 * đang ở cuối trang chủ mà bấm sang "Sự cố" là rơi thẳng xuống cuối danh sách.
 * (`<ScrollRestoration>` của React Router chỉ chạy với data router, app này dùng
 * BrowserRouter.)
 *
 * - Back/Forward (`POP`) thì không kéo về đầu: giữ cách cũ, trình duyệt tự khôi
 *   phục vị trí trước đó (cùng tinh thần trang Bản đồ khôi phục khung nhìn khi
 *   quay lại).
 * - Chỉ xét pathname: đổi bộ lọc hay số trang (`?page=2`) trên cùng một trang
 *   không kéo người dùng lên đầu.
 *
 * `navigationType` là giá trị của `useNavigationType()`: 'POP' | 'PUSH' | 'REPLACE'.
 */
export const shouldResetScroll = (
  previousPathname: string,
  pathname: string,
  navigationType: string,
): boolean => navigationType !== 'POP' && previousPathname !== pathname;
