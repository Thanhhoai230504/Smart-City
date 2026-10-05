import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { AddAPhotoRounded, FactCheckRounded } from '@mui/icons-material';
import { C, EASE, NO_MOTION, floatY, gradientPan, revealSx } from './homeStyle';
import { useInView } from './hooks';
import { categoryIcon } from './categoryIcons';

// Các "ghim" sự cố trôi lơ lửng trang trí hai bên.
const PINS = [
  { key: 'pothole', left: '6%', top: '22%', size: 54, delay: 0 },
  { key: 'flooding', left: '14%', top: '64%', size: 44, delay: -2 },
  { key: 'streetlight', right: '8%', top: '18%', size: 48, delay: -1 },
  { key: 'garbage', right: '15%', top: '62%', size: 56, delay: -3 },
];

const FinalCta: React.FC<{ isAuthenticated: boolean }> = ({ isAuthenticated }) => {
  const navigate = useNavigate();
  const [ref, shown] = useInView<HTMLDivElement>({ threshold: 0.3 });

  // Thẻ bo góc trên nền sáng: ngay trước là khối dữ liệu công khai (navy) và ngay
  // sau là footer (tối) — một dải màu tràn viền ở giữa làm cuối trang nặng nề.
  return (
    <Box component="section" ref={ref} sx={{ bgcolor: C.bg, py: { xs: 6, md: 10 }, px: { xs: 2, md: 3 } }}>
      <Box sx={{
        position: 'relative', overflow: 'hidden', maxWidth: 1240, mx: 'auto',
        borderRadius: { xs: '28px', md: '40px' }, py: { xs: 8, md: 11 }, px: 2,
        background: `linear-gradient(120deg, ${C.blueDeep}, ${C.blue}, ${C.teal}, ${C.blue})`,
        backgroundSize: '300% 300%',
        boxShadow: '0 50px 90px -50px rgba(7,59,92,.7)',
        animation: `${gradientPan} 18s ease infinite`,
        [NO_MOTION]: { animation: 'none' },
      }}>
        {PINS.map((pin) => {
          const Icon = categoryIcon(pin.key);
          return (
            <Box key={pin.key} aria-hidden="true" sx={{
              display: { xs: 'none', md: 'grid' }, placeItems: 'center',
              position: 'absolute', left: pin.left, right: pin.right, top: pin.top,
              width: pin.size, height: pin.size, borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.22)',
              color: 'rgba(255,255,255,.85)',
              animation: `${floatY} 6s ease-in-out ${pin.delay}s infinite`,
              [NO_MOTION]: { animation: 'none' },
            }}>
              <Icon sx={{ fontSize: pin.size * 0.48 }} />
            </Box>
          );
        })}

        <Container maxWidth="md" sx={{ position: 'relative', textAlign: 'center' }}>
          <Typography component="h2" sx={{
            color: '#FFFFFF', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.08,
            fontSize: { xs: '2.2rem', md: '3.4rem' }, mb: 2,
            ...revealSx(shown),
          }}>
            Thấy sự cố? Báo ngay.
          </Typography>
          <Typography sx={{
            color: 'rgba(244,248,250,.88)', fontSize: { xs: 16, md: 18 }, lineHeight: 1.65, maxWidth: 620, mx: 'auto', mb: 4.5,
            ...revealSx(shown, 120),
          }}>
            Mỗi phản ánh giúp Đà Nẵng an toàn và sạch đẹp hơn — và bạn sẽ biết chính xác khi nào sự cố được xử lý xong.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{ ...revealSx(shown, 240) }}>
            <Button
              size="large"
              startIcon={<AddAPhotoRounded />}
              onClick={() => navigate('/report')}
              sx={{
                px: 3.5, py: 1.6, borderRadius: '14px', fontSize: 16, fontWeight: 700, textTransform: 'none',
                bgcolor: C.accent, color: '#FFFFFF', boxShadow: '0 18px 34px -16px rgba(0,0,0,.55)',
                transition: `transform 250ms ${EASE}, background-color 200ms ease`,
                '&:hover': { bgcolor: C.accentHover, transform: 'translateY(-2px)' },
              }}
            >
              {isAuthenticated ? 'Báo cáo sự cố' : 'Đăng nhập để báo cáo'}
            </Button>
            <Button
              size="large"
              variant="outlined"
              startIcon={<FactCheckRounded />}
              onClick={() => navigate('/issues')}
              sx={{
                px: 3.5, py: 1.6, borderRadius: '14px', fontSize: 16, fontWeight: 700, textTransform: 'none',
                color: '#FFFFFF', borderColor: 'rgba(255,255,255,.55)', borderWidth: 1.5,
                '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,.1)', borderWidth: 1.5 },
              }}
            >
              Xem các sự cố đã phản ánh
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
};

export default FinalCta;
