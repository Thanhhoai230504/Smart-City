import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Grid, IconButton, Link, Stack, Typography } from '@mui/material';
import {
  ArrowUpwardRounded, Email, Facebook, Language, LocationOn, Phone, YouTube,
} from '@mui/icons-material';
import {
  C, FONT_DISPLAY, FONT_MONO, NO_MOTION, prefersReducedMotion, pulseDot,
} from '../pages/Home/homeStyle';
import { CHROME, FOCUS_ON_DARK } from './chrome';
import BrandMark from './BrandMark';

const discoveryLinks = [
  { label: 'Bản đồ đô thị', path: '/map' },
  { label: 'Danh sách sự cố', path: '/issues' },
  { label: 'Thống kê', path: '/statistics' },
  { label: 'Camera công cộng', path: '/cameras' },
];

const citizenLinks = [
  { label: 'Báo cáo sự cố', path: '/report' },
  { label: 'Sự cố của tôi', path: '/my-issues' },
];

const contacts = [
  { label: 'Điện thoại', value: '0236 1022', icon: <Phone /> },
  { label: 'Email', value: 'support@smartcity.danang.vn', icon: <Email /> },
  { label: 'Địa chỉ', value: <>Trung tâm điều hành đô thị thông minh<br />Thành phố Đà Nẵng</>, icon: <LocationOn /> },
];

const socials = [
  { label: 'Facebook', href: 'https://www.facebook.com/', icon: <Facebook fontSize="small" /> },
  { label: 'YouTube', href: 'https://www.youtube.com/', icon: <YouTube fontSize="small" /> },
  { label: 'Cổng thông tin Đà Nẵng', href: 'https://danang.gov.vn', icon: <Language fontSize="small" /> },
];

/** Cỡ chữ "ĐÀ NẴNG" ở đáy footer; phần đệm dưới của nội dung tính theo nó. */
const WORD_SIZE = { xs: '27vw', md: 'min(24vw, 340px)' };

const headingSx = {
  mb: 2.25, color: CHROME.cyan, fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 500,
  letterSpacing: '.14em', textTransform: 'uppercase',
} as const;

/** Liên kết chữ, rê chuột thì sáng lên và hiện gạch chân xanh nước → xanh ngọc chạy từ trái. */
const FooterLink: React.FC<{ label: string; path: string }> = ({ label, path }) => (
  <Link component={RouterLink} to={path} underline="none" sx={{
    width: 'fit-content', color: CHROME.soft, fontSize: 14.5, fontWeight: 500, lineHeight: 1.6,
    backgroundImage: `linear-gradient(90deg, ${CHROME.cyan}, ${CHROME.mint})`,
    backgroundRepeat: 'no-repeat', backgroundPosition: '0 100%', backgroundSize: '0% 1px',
    transition: 'color 180ms ease, background-size 260ms ease',
    '&:hover': { color: CHROME.text, backgroundSize: '100% 1px' },
  }}>
    {label}
  </Link>
);

/**
 * Footer cùng nền xanh biển với video trang chủ: logo + giới thiệu, hai cột liên kết, thông
 * tin liên hệ, dòng bản quyền; dưới cùng là chữ "ĐÀ NẴNG" cỡ lớn mờ dần — nhắc lại chữ
 * lớn ở đầu trang chủ để mở và khép trang cùng một hình ảnh.
 */
const Footer: React.FC = () => (
  <Box component="footer" sx={{
    position: 'relative', overflow: 'hidden', mt: 'auto', color: CHROME.body,
    bgcolor: CHROME.navyDeep,
    backgroundImage: [
      'radial-gradient(55% 70% at 0% 0%, rgba(63,184,201,.16) 0%, rgba(63,184,201,0) 70%)',
      'radial-gradient(45% 60% at 100% 100%, rgba(52,195,143,.1) 0%, rgba(52,195,143,0) 70%)',
      `linear-gradient(180deg, ${CHROME.navy} 0%, ${CHROME.navyDeep} 100%)`,
    ].join(', '),
    ...FOCUS_ON_DARK,
  }}>
    {/* Đường sáng mảnh ở mép trên thay cho viền xanh 4 px cũ. */}
    <Box aria-hidden="true" sx={{
      position: 'absolute', top: 0, left: 0, right: 0, height: '1px', opacity: 0.6,
      background: `linear-gradient(90deg, rgba(142,216,232,0) 0%, ${CHROME.cyan} 35%, ${CHROME.mint} 65%, rgba(163,232,200,0) 100%)`,
    }} />

    <Container maxWidth="lg" sx={{
      position: 'relative', zIndex: 1, pt: { xs: 6, md: 8 },
      // Chừa chỗ cho nửa trên của chữ "ĐÀ NẴNG" (thân chữ bắt đầu ở 0,36 lần cỡ chữ).
      pb: { xs: `calc(${WORD_SIZE.xs} * .36)`, md: `calc(${WORD_SIZE.md} * .36)` },
    }}>
      <Grid container spacing={{ xs: 4, md: 5 }}>
        <Grid item xs={12} md={4.2}>
          <Stack spacing={2.25} alignItems="flex-start">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <BrandMark size={44} />
            </Box>
            <Typography sx={{ color: CHROME.soft, fontSize: 14.5, lineHeight: 1.75, maxWidth: 380 }}>
              Kết nối người dân, cán bộ và cơ quan quản lý để những vấn đề trên đường phố được ghi nhận và xử lý minh bạch.
            </Typography>
            <Stack direction="row" spacing={1}>
              {socials.map((s) => (
                <IconButton
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  sx={{
                    width: 38, height: 38, color: CHROME.soft,
                    bgcolor: 'rgba(255,255,255,.04)', border: `1px solid ${CHROME.line}`,
                    transition: 'color 180ms ease, background-color 180ms ease, border-color 180ms ease',
                    '&:hover': { color: CHROME.text, bgcolor: CHROME.hover, borderColor: 'rgba(142,216,232,.5)' },
                  }}
                >
                  {s.icon}
                </IconButton>
              ))}
            </Stack>
          </Stack>
        </Grid>

        <Grid item xs={6} sm={4} md={1.8}>
          <Typography component="h2" sx={headingSx}>Khám phá</Typography>
          <Stack spacing={1.25}>{discoveryLinks.map((link) => <FooterLink key={link.path} {...link} />)}</Stack>
        </Grid>

        <Grid item xs={6} sm={4} md={2.2}>
          <Typography component="h2" sx={headingSx}>Dành cho người dân</Typography>
          <Stack spacing={1.25}>{citizenLinks.map((link) => <FooterLink key={link.path} {...link} />)}</Stack>
        </Grid>

        <Grid item xs={12} sm={4} md={3.8}>
          <Typography component="h2" sx={headingSx}>Thông tin liên hệ</Typography>
          <Stack spacing={1.75}>
            {contacts.map((c) => (
              <Stack key={c.label} direction="row" spacing={1.5} alignItems="flex-start">
                <Box sx={{
                  width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '10px',
                  color: CHROME.cyan, bgcolor: 'rgba(255,255,255,.05)', border: `1px solid ${CHROME.line}`,
                  '& svg': { fontSize: 18 },
                }}>
                  {c.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ color: CHROME.muted, fontSize: 12, lineHeight: 1.45 }}>{c.label}</Typography>
                  <Typography sx={{ color: CHROME.body, fontSize: 14, lineHeight: 1.55, wordBreak: 'break-word' }}>{c.value}</Typography>
                </Box>
              </Stack>
            ))}
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1, width: 'fit-content',
              px: 1.5, py: 0.75, borderRadius: 999,
              bgcolor: 'rgba(52,195,143,.1)', border: '1px solid rgba(52,195,143,.32)',
            }}>
              <Box sx={{
                width: 8, height: 8, borderRadius: '50%', bgcolor: C.mint,
                animation: `${pulseDot} 2.4s ease-out infinite`, [NO_MOTION]: { animation: 'none' },
              }} />
              <Typography sx={{ color: '#CFF3E3', fontSize: 13, fontWeight: 600 }}>Tiếp nhận trực tuyến 24/7</Typography>
            </Box>
          </Stack>
        </Grid>
      </Grid>

      <Box sx={{
        mt: { xs: 5, md: 6 }, py: 2.5, borderTop: `1px solid ${CHROME.line}`,
        display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5,
        alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between',
      }}>
        <Typography sx={{ color: CHROME.muted, fontSize: 13 }}>
          © {new Date().getFullYear()} Smart City Đà Nẵng · Hệ thống quản lý đô thị thông minh
        </Typography>
        <Stack direction="row" alignItems="center" spacing={2} useFlexGap flexWrap="wrap" sx={{ rowGap: 1 }}>
          <Typography sx={{ color: CHROME.muted, fontSize: 13 }}>Dữ liệu được cập nhật theo thời gian thực</Typography>
          <Button
            size="small"
            endIcon={<ArrowUpwardRounded />}
            onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })}
            sx={{
              minHeight: 32, px: 1.5, py: 0.5, borderRadius: 999, fontSize: 13, fontWeight: 600,
              color: CHROME.soft, border: `1px solid ${CHROME.line}`,
              '&:hover': { color: CHROME.text, bgcolor: CHROME.hover },
            }}
          >
            Lên đầu trang
          </Button>
        </Stack>
      </Box>
    </Container>

    {/* Chữ lớn mờ dần ở đáy: nửa dưới chìm khỏi mép trang. Chỉ để trang trí. Phần đệm trên
        0,3em là chỗ cho dấu — chữ tô bằng background-clip nên dấu ngoài khung sẽ vô hình. */}
    <Box aria-hidden="true" sx={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 0,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none', userSelect: 'none',
      fontFamily: FONT_DISPLAY, fontWeight: 900, fontStretch: '62%', fontSize: WORD_SIZE,
      lineHeight: 0.84, letterSpacing: '-0.012em', transform: 'translateY(38%)',
    }}>
      <Box component="span" sx={{
        pt: '0.3em', whiteSpace: 'nowrap',
        // Dấu (0–29% chiều cao) chỉ thoáng hiện để không đè lên dòng bản quyền; thân chữ
        // đậm nhất ở đỉnh rồi tan dần trước mép trang.
        backgroundImage: 'linear-gradient(180deg, rgba(142,216,232,.045) 0%, rgba(142,216,232,.045) 28%, rgba(142,216,232,.17) 33%, rgba(142,216,232,.07) 50%, rgba(142,216,232,0) 62%)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
      }}>
        ĐÀ NẴNG
      </Box>
    </Box>
  </Box>
);

export default Footer;
