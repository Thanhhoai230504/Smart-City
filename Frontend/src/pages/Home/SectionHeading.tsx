import React from 'react';
import { Box, Typography } from '@mui/material';
import { C, FONT_MONO, revealSx } from './homeStyle';

/**
 * Phần chữ tô gradient trong tiêu đề mục, như dòng tiêu đề ở đầu trang chủ: nền sáng dùng
 * xanh biển → xanh đầm phá (cả hai ≥ 6:1 trên nền trắng), nền tối dùng xanh nước → xanh ngọc.
 */
export const GradientText: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark = false }) => (
  <Box component="span" sx={{
    backgroundImage: dark
      ? 'linear-gradient(90deg, #8ED8E8, #A3E8C8)'
      : `linear-gradient(90deg, ${C.blue}, ${C.teal})`,
    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
  }}>
    {children}
  </Box>
);

/** Đầu mỗi mục của trang chủ: nhãn dạng viên thuốc (như dòng giới thiệu ở đầu trang), tiêu đề, mô tả. */
export const SectionHeading: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  text?: string;
  shown: boolean;
  dark?: boolean;
  align?: 'left' | 'center';
}> = ({ eyebrow, title, text, shown, dark = false, align = 'left' }) => (
  <Box sx={{ maxWidth: 780, mx: align === 'center' ? 'auto' : 0, textAlign: align, mb: { xs: 5, md: 7 } }}>
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 1, mb: 2,
      px: 1.5, py: 0.625, borderRadius: 999,
      border: '1px solid', borderColor: dark ? 'rgba(255,255,255,.18)' : 'rgba(11,94,142,.16)',
      bgcolor: dark ? 'rgba(255,255,255,.06)' : 'rgba(11,94,142,.05)',
      ...revealSx(shown),
    }}>
      <Box sx={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: dark ? C.accentOnDark : `linear-gradient(135deg, ${C.blue}, ${C.aqua})`,
      }} />
      <Typography component="span" sx={{
        fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, letterSpacing: '.12em', lineHeight: 1.4,
        color: dark ? C.accentOnDark : C.blue,
      }}>
        {eyebrow}
      </Typography>
    </Box>
    <Typography component="h2" sx={{
      fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.12,
      fontSize: { xs: '1.9rem', md: '2.75rem' },
      color: dark ? C.onDark : C.ink, mb: text ? 2 : 0,
      ...revealSx(shown, 100),
    }}>
      {title}
    </Typography>
    {text && (
      <Typography sx={{
        fontSize: { xs: 15.5, md: 17.5 }, lineHeight: 1.65, maxWidth: 680,
        mx: align === 'center' ? 'auto' : 0,
        color: dark ? C.onDarkMuted : C.body,
        ...revealSx(shown, 200),
      }}>
        {text}
      </Typography>
    )}
  </Box>
);
