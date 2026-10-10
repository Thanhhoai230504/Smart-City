import { softFieldSx } from '../../components/filterStyles';

/** Ô nhập của bảng "Chỉ đường": nền xám nhạt như trang Sự cố, cỡ chữ vừa bảng hẹp. */
export const panelFieldSx = {
  ...softFieldSx,
  '& .MuiOutlinedInput-root': { ...softFieldSx['& .MuiOutlinedInput-root'], fontSize: 14 },
} as const;
