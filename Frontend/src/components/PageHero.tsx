import React from 'react';
import { Box, Button, ButtonProps, Container, Stack, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import { CHROME, FOCUS_ON_DARK } from '../layout/chrome';
import { C, FONT_MONO, NO_MOTION, pulseDot } from '../pages/Home/homeStyle';

interface PageHeroProps {
  /** Nhãn viết hoa trong viên thuốc có chấm nhấp nháy, ví dụ "DỮ LIỆU CÔNG KHAI". */
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  actions?: React.ReactNode;
  /** Cột phải (thường là `HeroGlassCard`); không có thì phần đầu chỉ một cột. */
  aside?: React.ReactNode;
}

/**
 * Phần đầu các trang dữ liệu công khai (Sự cố, Thống kê): nền xanh biển liền với thanh đầu
 * trang, lưới ô phố mờ, nhãn viên thuốc, tiêu đề, mô tả, nút; cột phải là thẻ kính số liệu.
 * Phần đệm dưới dày để khối nội dung kế tiếp đặt lề âm, nổi đè lên mép dưới.
 */
const PageHero: React.FC<PageHeroProps> = ({ eyebrow, title, description, actions, aside }) => (
  <Box component="section" sx={{
    position: 'relative', overflow: 'hidden', color: CHROME.text,
    background: [
      'radial-gradient(55% 90% at 88% 0%, rgba(63,184,201,.2) 0%, rgba(63,184,201,0) 62%)',
      `linear-gradient(160deg, ${C.seaDark} 0%, ${C.sea} 100%)`,
    ].join(', '),
    pt: { xs: 4, md: 6 }, pb: { xs: 10, md: 12 },
    ...FOCUS_ON_DARK,
  }}>
    {/* lưới ô phố mờ */}
    <Box aria-hidden="true" sx={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      backgroundImage: 'linear-gradient(rgba(184,216,210,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(184,216,210,.07) 1px, transparent 1px)',
      backgroundSize: '56px 56px',
      maskImage: 'linear-gradient(100deg, transparent 0%, #000 40%, #000 60%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(100deg, transparent 0%, #000 40%, #000 60%, transparent 100%)',
    }} />

    <Container maxWidth="lg" sx={{ position: 'relative' }}>
      <Box sx={{
        display: 'grid', alignItems: 'center', gap: { xs: 3.5, md: 6 },
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: aside ? 'minmax(0, 1fr) 440px' : 'minmax(0, 1fr)' },
      }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: 1, mb: 2, px: 1.5, py: 0.6, borderRadius: 999,
            bgcolor: 'rgba(255,255,255,.08)', border: `1px solid ${CHROME.line}`,
          }}>
            <Box sx={{
              width: 7, height: 7, borderRadius: '50%', bgcolor: C.mint,
              animation: `${pulseDot} 2.4s ease-out infinite`, [NO_MOTION]: { animation: 'none' },
            }} />
            <Typography component="span" sx={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 600, letterSpacing: '.12em', color: CHROME.soft }}>
              {eyebrow}
            </Typography>
          </Box>
          <Typography component="h1" sx={{
            fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.08,
            fontSize: { xs: '2.2rem', md: '3.1rem' },
          }}>
            {title}
          </Typography>
          <Typography sx={{ mt: 1.5, maxWidth: 560, color: CHROME.body, fontSize: { xs: 15.5, md: 17 }, lineHeight: 1.65 }}>
            {description}
          </Typography>
          {actions && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 3 }}>
              {actions}
            </Stack>
          )}
        </Box>
        {aside}
      </Box>
    </Container>
  </Box>
);

export default PageHero;

/** Nút trong phần đầu: `primary` cam như nút Báo cáo, `ghost` viền trắng trên nền tối. */
export const HeroButton: React.FC<Omit<ButtonProps, 'variant' | 'sx'> & {
  tone?: 'primary' | 'ghost';
  /** Khi có `href` (liên kết ngoài). */
  target?: string;
  rel?: string;
}> = ({
  tone = 'ghost', ...props
}) => (
  <Button
    {...props}
    sx={{
      height: 46, px: 2.5, borderRadius: '12px', fontSize: 15, fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap',
      ...(tone === 'primary'
        ? {
          bgcolor: C.accent, boxShadow: '0 14px 28px -16px rgba(194,65,12,.9)',
          '&:hover': { bgcolor: C.accentHover },
        }
        : {
          bgcolor: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.35)',
          '&:hover': { bgcolor: 'rgba(255,255,255,.16)', borderColor: '#FFFFFF' },
        }),
      '&.Mui-disabled': { color: 'rgba(255,255,255,.7)' },
    }}
  />
);

/** Thẻ kính ở cột phải của phần đầu. */
export const HeroGlassCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{
    p: { xs: 2.25, md: 2.75 }, borderRadius: '22px',
    bgcolor: 'rgba(6,30,46,.5)', border: `1px solid ${CHROME.line}`,
    backdropFilter: 'blur(14px)', boxShadow: '0 30px 60px -40px rgba(0,0,0,.8)',
  }}>
    {children}
  </Box>
);

/** Một ô số liệu trong thẻ kính: icon, nhãn, giá trị lớn, ghi chú. */
export const HeroStatTile: React.FC<{
  icon: SvgIconComponent;
  label: string;
  value: React.ReactNode;
  note: string;
  /** Tô giá trị màu xanh ngọc (chỉ số chính). */
  highlight?: boolean;
  /** Ô chiếm trọn hàng trong lưới hai cột. */
  wide?: boolean;
}> = ({ icon: Icon, label, value, note, highlight, wide }) => (
  <Box sx={{
    minWidth: 0, p: { xs: 1.5, sm: 1.75 }, borderRadius: '16px',
    gridColumn: wide ? '1 / -1' : undefined,
    bgcolor: 'rgba(255,255,255,.05)', border: `1px solid ${CHROME.line}`,
  }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
      <Box sx={{
        width: 30, height: 30, flexShrink: 0, borderRadius: '9px', display: 'grid', placeItems: 'center',
        color: CHROME.cyan, bgcolor: 'rgba(142,216,232,.14)',
      }}>
        <Icon sx={{ fontSize: 17 }} />
      </Box>
      <Typography sx={{ fontSize: 12.5, color: CHROME.soft, lineHeight: 1.3 }}>{label}</Typography>
    </Stack>
    <Typography sx={{
      fontSize: { xs: 24, sm: 28 }, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', whiteSpace: 'nowrap',
      color: highlight ? CHROME.mint : CHROME.text,
    }}>
      {value}
    </Typography>
    <Typography sx={{ mt: 0.5, fontSize: 12, color: CHROME.muted, lineHeight: 1.4 }}>{note}</Typography>
  </Box>
);
