import React from 'react';
import { Box, Breakpoint, Typography } from '@mui/material';
import logoTile from '../assets/brand/logo-tile.png';
import { FONT_MONO } from '../pages/Home/homeStyle';
import { CHROME } from './chrome';

interface BrandMarkProps {
  /** Cạnh ô logo (px). */
  size?: number;
  /** Ẩn/hiện phần chữ theo cỡ màn, ví dụ `{ xs: 'none', lg: 'block' }`. */
  textDisplay?: string | Partial<Record<Breakpoint, string>>;
}

/**
 * Logo + tên hệ thống trên nền tối. Logo cùng hình với icon app và PWA (skyline xanh ngọc
 * trên nền navy) thay cho emoji 🏙️ vốn hiện khác nhau trên mỗi hệ điều hành. Ảnh chỉ để
 * trang trí: chỗ đặt BrandMark tự mang tên cho trình đọc màn hình.
 */
const BrandMark: React.FC<BrandMarkProps> = ({ size = 38, textDisplay = 'block' }) => (
  <>
    <Box
      component="img"
      src={logoTile}
      alt=""
      width={size}
      height={size}
      sx={{
        display: 'block', flexShrink: 0,
        borderRadius: `${Math.round(size * 0.28)}px`,
        boxShadow: '0 0 0 1px rgba(255,255,255,.18), 0 8px 18px -8px rgba(0,0,0,.6)',
      }}
    />
    <Box sx={{ display: textDisplay, minWidth: 0 }}>
      <Typography component="span" sx={{
        display: 'block', color: CHROME.text, fontWeight: 800,
        fontSize: size >= 42 ? 18 : 16.5, lineHeight: 1.15, letterSpacing: '-0.01em', whiteSpace: 'nowrap',
      }}>
        Smart City Đà Nẵng
      </Typography>
      <Typography component="span" sx={{
        display: 'block', mt: '3px', color: CHROME.cyan, fontFamily: FONT_MONO, fontWeight: 500,
        fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>
        Cổng phản ánh đô thị
      </Typography>
    </Box>
  </>
);

export default BrandMark;
