/**
 * Cột "Thao tác" dính mép phải của bảng.
 *
 * Ở 1440 px với thanh điều hướng 236 px, bảng công việc của cán bộ và hàng chờ
 * phân công rộng hơn vùng nội dung nên cột thao tác (Nhận việc / Phân công) bị
 * đẩy ra sau thanh cuộn ngang — người dùng thấy danh sách nhưng không thấy nút.
 * Bảng đã được thu gọn cho vừa 1440 px; cột dính này là lưới an toàn cho màn
 * hẹp hơn: kéo ngang thế nào nút vẫn nằm trong tầm mắt.
 *
 * Ô dính phải có nền đặc, nếu không nội dung cuộn bên dưới sẽ lộ qua. Ô thân bảng
 * kế thừa nền của hàng (hàng phải đặt nền đặc, kể cả khi hover); ô tiêu đề đặt
 * nền riêng vì hàng tiêu đề trong suốt.
 */
export const stickyActionCellSx = {
  position: 'sticky',
  right: 0,
  zIndex: 1,
  bgcolor: 'inherit',
  boxShadow: 'inset 1px 0 0 #E2E8EC',
} as const;

export const stickyActionHeadSx = {
  ...stickyActionCellSx,
  bgcolor: '#F2F5F7',
} as const;
