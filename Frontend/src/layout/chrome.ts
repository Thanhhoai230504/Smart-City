import { C } from '../pages/Home/homeStyle';

/** Chiều cao thanh trên cùng ở mọi cỡ màn (MainLayout chừa đúng khoảng này). */
export const HEADER_HEIGHT = 64;

/**
 * Màu khung trang (header, ngăn kéo menu, footer): cùng tông xanh biển với lớp phủ video
 * trang chủ, điểm xanh nước → xanh ngọc như dòng tiêu đề ở đó. Chữ đo trên nền #08283C:
 * text 15:1, body 12:1, soft 10:1, muted 6,2:1, cyan 9,5:1.
 */
export const CHROME = {
  navy: C.seaDark, // #08283C — màu lớp phủ video
  navyDeep: '#061D2C',
  glass: 'rgba(8,40,60,.9)',
  text: '#FFFFFF',
  body: '#DCE9EE',
  soft: '#C4D6DE',
  muted: '#8FA9B6',
  cyan: '#8ED8E8',
  mint: '#A3E8C8',
  line: 'rgba(255,255,255,.1)',
  hover: 'rgba(255,255,255,.08)',
  accent: C.accent,
  accentHover: C.accentHover,
} as const;

/** Viền focus xanh dương mặc định của theme gần như không thấy trên nền tối. */
export const FOCUS_ON_DARK = {
  '& :focus-visible': { outline: `2px solid ${CHROME.cyan}`, outlineOffset: 2 },
} as const;
