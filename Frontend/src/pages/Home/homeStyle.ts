import { keyframes } from '@mui/material';

/**
 * Bảng màu trang chủ — cùng họ với theme web (xanh civic #0B5E8E) và app di động:
 * xanh biển → xanh đầm phá cho thương hiệu, cam "lửa Cầu Rồng" chỉ cho hành động
 * chính (Báo cáo sự cố), còn lại là trung tính. Mỗi cặp chữ/nền đã đo ≥ 4.5:1.
 */
export const C = {
  ink: '#0F2233', // 15.1:1 trên #F5F7F9
  body: '#3F5563', // 7.3:1
  muted: '#566A77', // 5.3:1
  line: '#DCE7EB',
  bg: '#F5F7F9',
  white: '#FFFFFF',
  blue: '#0B5E8E',
  blueDeep: '#073B5C',
  sea: '#0A3D5C',
  seaDark: '#08283C',
  teal: '#0C6E74',
  aqua: '#3FB8C9',
  mint: '#34C38F',
  accent: '#C2410C', // chữ trắng 5.2:1
  accentHover: '#9A3412',
  accentSoft: '#FDECE4',
  accentOnDark: '#FDBA8C', // 6.9:1 trên nền biển tối #0A3D5C
  onDark: '#F4F8FA', // 10.7:1
  onDarkMuted: '#B9CDD6', // 7.0:1
} as const;

export const FONT_DISPLAY = "'Archivo', 'Inter', system-ui, sans-serif";
export const FONT_MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';
export const EASE = 'cubic-bezier(.16,1,.3,1)';

export const NO_MOTION = '@media (prefers-reduced-motion: reduce)';
/** Laptop màn thấp (1366×768, 1536×864 ở 125%) — trừ thanh trình duyệt còn ~650–730 px. */
export const SHORT_DESKTOP = '@media (min-width: 900px) and (max-height: 820px)';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Trộn hai màu hex (t = 0 → a, t = 1 → b). */
export const mix = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
};

export const fadeUp = keyframes`
  from { opacity: 0; transform: translate3d(0, 22px, 0); }
  to { opacity: 1; transform: none; }
`;
export const letterRise = keyframes`
  from { opacity: 0; transform: translate3d(0, 105%, 0) rotate(4deg); }
  to { opacity: 1; transform: none; }
`;
/** Vệt sáng lướt qua chữ — mỗi chữ trễ một nhịp nên trông như sóng chạy ngang. */
export const sheen = keyframes`
  0% { background-position: 100% 0; }
  45%, 100% { background-position: 0% 0; }
`;
export const drift = keyframes`
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(6%, -4%, 0) scale(1.12); }
`;
export const floatY = keyframes`
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -8px, 0); }
`;
export const pulseDot = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(52, 195, 143, .55); }
  70% { box-shadow: 0 0 0 9px rgba(52, 195, 143, 0); }
  100% { box-shadow: 0 0 0 0 rgba(52, 195, 143, 0); }
`;
export const drawX = keyframes`
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
`;
export const popIn = keyframes`
  0% { opacity: 0; transform: scale(.6); }
  70% { opacity: 1; transform: scale(1.08); }
  100% { opacity: 1; transform: scale(1); }
`;
export const slideInRight = keyframes`
  from { opacity: 0; transform: translate3d(18px, 0, 0); }
  to { opacity: 1; transform: none; }
`;
/** Vệt sáng rộng 18% chạy hết chiều dài một đường ray (18% × 560% ≈ 100%). */
export const flowAlong = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(560%); }
`;
export const gradientPan = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

/** Xuất hiện khi cuộn tới: dùng với `useInView` — `shown` false thì ẩn, true thì chạy fadeUp. */
export const revealSx = (shown: boolean, delayMs = 0) => ({
  opacity: shown ? undefined : 0,
  animation: shown ? `${fadeUp} 800ms ${EASE} ${delayMs}ms both` : 'none',
  [NO_MOTION]: { opacity: 1, animation: 'none' },
});
