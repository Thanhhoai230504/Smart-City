import { C } from '../pages/Home/homeStyle';

/** Ô nhập: nền xám rất nhạt, bo 12 px, khi focus nền trắng + vòng sáng màu thương hiệu. */
export const authFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px', bgcolor: '#F6F9FB',
    transition: 'background-color 160ms ease, box-shadow 160ms ease',
    '& fieldset': { borderColor: '#DCE6EB' },
    '&:hover fieldset': { borderColor: '#A8BCC7' },
    '&.Mui-focused': { bgcolor: '#FFFFFF', boxShadow: '0 0 0 4px rgba(11,94,142,.12)' },
  },
  '& .MuiInputAdornment-positionStart .MuiSvgIcon-root': { color: '#6E8592' },
} as const;

/** Liên kết trong biểu mẫu (Đăng ký ngay, Quên mật khẩu…). */
export const authLinkSx = {
  color: C.blue, fontWeight: 700, textDecorationColor: 'rgba(11,94,142,.35)',
  '&:hover': { textDecorationColor: C.blue },
} as const;
