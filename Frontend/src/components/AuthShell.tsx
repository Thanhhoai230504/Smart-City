import React from 'react';
import { Box, Button, ButtonProps, Divider, Stack, Typography } from '@mui/material';
import { PhoneAndroidRounded } from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';
import { CHROME, FOCUS_ON_DARK, HEADER_HEIGHT } from '../layout/chrome';
import { C, FONT_MONO, NO_MOTION, pulseDot } from '../pages/Home/homeStyle';

/** Ảnh tĩnh của video nền trang chủ — cột giới thiệu dùng lại (thường đã có sẵn trong bộ đệm). */
const POSTER = '/videos/danang-hero.jpg';

export interface AuthPoint {
  icon: SvgIconComponent;
  title: string;
  text: string;
}

interface AuthShellProps {
  /** Câu giới thiệu lớn ở cột trái (có thể chứa `GradientText dark`). */
  pitch: React.ReactNode;
  pitchText: string;
  points: AuthPoint[];
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

/**
 * Khung chung của trang Đăng nhập / Đăng ký: hai cột từ 900 px — trái là cột giới thiệu
 * trên nền xanh biển của trang chủ (ảnh Đà Nẵng phủ lớp tối, câu giới thiệu, ba lợi ích),
 * phải là biểu mẫu trên nền trắng. Màn hẹp: cột giới thiệu thu thành một dải gọn ở trên,
 * biểu mẫu ngay bên dưới.
 */
const AuthShell: React.FC<AuthShellProps> = ({ pitch, pitchText, points, title, subtitle, children }) => (
  <Box sx={{
    minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
    display: 'grid',
    gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)', lg: 'minmax(0, 1.1fr) minmax(0, 1fr)' },
    bgcolor: C.white,
  }}>
    <Box component="aside" sx={{
      position: 'relative', overflow: 'hidden', color: CHROME.text, bgcolor: CHROME.navy,
      backgroundImage: { md: `url(${POSTER})` }, backgroundSize: 'cover', backgroundPosition: 'center',
      ...FOCUS_ON_DARK,
    }}>
      {/* lớp phủ: đủ tối để chữ trắng ≥ 6:1 trên mọi vùng ảnh */}
      <Box aria-hidden="true" sx={{
        position: 'absolute', inset: 0,
        background: [
          'radial-gradient(70% 55% at 0% 0%, rgba(63,184,201,.18) 0%, rgba(63,184,201,0) 70%)',
          'linear-gradient(165deg, rgba(8,40,60,.9) 0%, rgba(8,40,60,.82) 50%, rgba(6,29,44,.95) 100%)',
        ].join(', '),
      }} />
      {/* vòng tròn đồng tâm làm hoạ tiết */}
      <Box aria-hidden="true" sx={{
        position: 'absolute', right: { xs: -120, md: -160 }, top: { xs: -150, md: -120 },
        width: { xs: 320, md: 460 }, height: { xs: 320, md: 460 }, borderRadius: '50%',
        background: 'repeating-radial-gradient(circle, rgba(255,255,255,.09) 0 1px, rgba(255,255,255,0) 1px 26px)',
      }} />

      <Box sx={{
        position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
        px: { xs: 2.5, sm: 4, md: 6, lg: 8 }, py: { xs: 3.5, md: 6 },
      }}>
        {/* Logo và tên hệ thống đã có trên thanh đầu trang nên cột này không lặp lại. */}
        <Box sx={{ my: { md: 'auto' }, py: { md: 6 }, maxWidth: 520 }}>
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: 1, mb: { xs: 1.75, md: 2.5 },
            px: 1.75, py: 0.75, borderRadius: 999,
            bgcolor: 'rgba(255,255,255,.08)', border: `1px solid ${CHROME.line}`,
          }}>
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%', bgcolor: C.mint,
              animation: `${pulseDot} 2.4s ease-out infinite`, [NO_MOTION]: { animation: 'none' },
            }} />
            <Typography component="span" sx={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 600, letterSpacing: '.12em', color: CHROME.soft }}>
              TIẾP NHẬN TRỰC TUYẾN 24/7
            </Typography>
          </Box>
          <Typography component="p" sx={{
            fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.14,
            fontSize: { xs: 22, sm: 26, md: 36, lg: 42 },
          }}>
            {pitch}
          </Typography>
          <Typography sx={{ display: { xs: 'none', sm: 'block' }, mt: 2, color: CHROME.body, fontSize: { sm: 15, md: 16.5 }, lineHeight: 1.65 }}>
            {pitchText}
          </Typography>

          <Stack component="ul" spacing={2.25} sx={{ display: { xs: 'none', md: 'flex' }, listStyle: 'none', m: 0, p: 0, mt: 4.5 }}>
            {points.map(({ icon: Icon, title: pointTitle, text }) => (
              <Stack component="li" key={pointTitle} direction="row" spacing={1.75} alignItems="flex-start">
                <Box sx={{
                  width: 44, height: 44, flexShrink: 0, borderRadius: '14px', display: 'grid', placeItems: 'center',
                  color: CHROME.cyan, bgcolor: 'rgba(255,255,255,.07)', border: `1px solid ${CHROME.line}`,
                }}>
                  <Icon sx={{ fontSize: 22 }} />
                </Box>
                <Box sx={{ minWidth: 0, pt: 0.25 }}>
                  <Typography sx={{ fontSize: 15.5, fontWeight: 700, color: CHROME.text }}>{pointTitle}</Typography>
                  <Typography sx={{ fontSize: 14, lineHeight: 1.6, color: CHROME.soft }}>{text}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Box sx={{
          display: { xs: 'none', md: 'inline-flex' }, alignSelf: 'flex-start', alignItems: 'center', gap: 1.25,
          px: 1.75, py: 1, borderRadius: '14px',
          bgcolor: 'rgba(255,255,255,.06)', border: `1px solid ${CHROME.line}`, backdropFilter: 'blur(8px)',
        }}>
          <PhoneAndroidRounded sx={{ fontSize: 20, color: CHROME.mint }} />
          <Typography sx={{ fontSize: 13.5, color: CHROME.body }}>
            Một tài khoản dùng chung cho web và ứng dụng Android
          </Typography>
        </Box>
      </Box>
    </Box>

    <Box component="section" aria-labelledby="auth-title" sx={{
      position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
      px: { xs: 2, sm: 4 }, py: { xs: 4, md: 7 },
      background: 'radial-gradient(55% 40% at 100% 0%, rgba(63,184,201,.1) 0%, rgba(63,184,201,0) 70%), #FFFFFF',
    }}>
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        <Typography id="auth-title" component="h1" sx={{
          fontSize: { xs: 28, md: 32 }, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, color: C.ink,
        }}>
          {title}
        </Typography>
        <Typography sx={{ mt: 1, mb: { xs: 3, md: 4 }, fontSize: 15.5, lineHeight: 1.6, color: C.body }}>
          {subtitle}
        </Typography>
        {children}
      </Box>
    </Box>
  </Box>
);

export default AuthShell;

/** Nút chính của biểu mẫu: gradient xanh biển → xanh đầm phá (chữ trắng ≥ 6:1). */
export const AuthSubmitButton: React.FC<Omit<ButtonProps, 'sx'>> = (props) => (
  <Button
    type="submit"
    fullWidth
    {...props}
    sx={{
      height: 52, borderRadius: '12px', fontSize: 16, fontWeight: 700, color: '#FFFFFF',
      background: `linear-gradient(120deg, ${C.blue}, ${C.teal})`,
      boxShadow: '0 14px 28px -16px rgba(11,94,142,.85)',
      transition: 'box-shadow 200ms ease, filter 200ms ease',
      '&:hover': { filter: 'brightness(.92)', boxShadow: '0 18px 32px -16px rgba(11,94,142,.9)' },
      '&.Mui-disabled': { color: 'rgba(255,255,255,.85)', opacity: 0.75 },
    }}
  />
);

/** Nút "… với Google": viền mảnh trên nền trắng. */
export const GoogleButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <Button
    fullWidth
    onClick={onClick}
    startIcon={<Box component="img" alt="" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" sx={{ width: 20, height: 20 }} />}
    sx={{
      height: 50, borderRadius: '12px', fontSize: 15, fontWeight: 700, color: C.ink,
      bgcolor: '#FFFFFF', border: '1px solid #DCE6EB', boxShadow: '0 1px 2px rgba(15,34,51,.05)',
      '&:hover': { bgcolor: '#F6F9FB', borderColor: '#A8BCC7' },
    }}
  >
    {children}
  </Button>
);

export const AuthDivider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Divider sx={{ my: 3, '&::before, &::after': { borderColor: '#E3EBEF' } }}>
    <Typography component="span" sx={{ px: 1, fontSize: 13, color: C.muted }}>{children}</Typography>
  </Divider>
);
