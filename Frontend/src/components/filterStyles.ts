import { C } from '../pages/Home/homeStyle';

/* Kiểu dùng chung cho thanh lọc của các trang dữ liệu công khai (Sự cố, Camera). */

/** Ô nhập nền xám nhạt bo 12 px, cùng kiểu với biểu mẫu đăng nhập. */
export const softFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px', bgcolor: '#F6F9FB',
    transition: 'background-color 160ms ease, box-shadow 160ms ease',
    '& fieldset': { borderColor: '#DCE6EB' },
    '&:hover fieldset': { borderColor: '#A8BCC7' },
    '&.Mui-focused': { bgcolor: '#FFFFFF', boxShadow: '0 0 0 4px rgba(11,94,142,.12)' },
  },
} as const;

/** Nút dạng viên thuốc cho bộ lọc trạng thái / loại; đang chọn thì nền xanh biển đậm. */
export const pillSx = (active: boolean) => ({
  flexShrink: 0, height: 38, px: 1.75, gap: 0.85, borderRadius: 999,
  fontSize: 14, fontWeight: 650, whiteSpace: 'nowrap',
  border: '1px solid', borderColor: active ? C.seaDark : '#D5E1E7',
  bgcolor: active ? C.seaDark : C.white, color: active ? '#FFFFFF' : C.body,
  boxShadow: active ? '0 10px 20px -14px rgba(8,40,60,.9)' : 'none',
  transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease',
  '&:hover': { bgcolor: active ? C.sea : '#EEF4F7' },
  '&:focus-visible': { outline: `2px solid ${C.blue}`, outlineOffset: 2 },
});

/** Hàng nút cuộn ngang trên màn hẹp, xuống dòng trên màn rộng. */
export const pillRowSx = {
  display: 'flex', gap: 1, minWidth: 0,
  flexWrap: { xs: 'nowrap', md: 'wrap' }, overflowX: { xs: 'auto', md: 'visible' },
  pb: { xs: 0.5, md: 0 }, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
  // mép phải mờ dần báo còn nút để cuộn
  maskImage: { xs: 'linear-gradient(90deg, #000 85%, transparent)', md: 'none' },
  WebkitMaskImage: { xs: 'linear-gradient(90deg, #000 85%, transparent)', md: 'none' },
} as const;
