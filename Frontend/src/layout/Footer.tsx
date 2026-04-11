import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Stack, IconButton, Link, Container, Grid, Divider } from '@mui/material';
import {
  Map, BugReport, BarChart, Phone, Email, Language,
  LocationOn, Facebook, YouTube, AccessTime,
} from '@mui/icons-material';

const quickLinks = [
  { label: 'Bản đồ', path: '/map', icon: <Map sx={{ fontSize: 15 }} /> },
  { label: 'Sự cố', path: '/issues', icon: <BugReport sx={{ fontSize: 15 }} /> },
  { label: 'Thống kê', path: '/statistics', icon: <BarChart sx={{ fontSize: 15 }} /> },
];

const Footer: React.FC = () => {
  return (
    <Box component="footer" sx={{
      pt: 6, pb: 3, mt: 'auto',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(180deg, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.98) 100%)',
      backdropFilter: 'blur(16px)',
    }}>
      <Container maxWidth="lg">
        <Grid container spacing={4} mb={4}>
          {/* Brand */}
          <Grid item xs={12} md={4}>
            <Typography fontWeight={800} fontSize="1.15rem" mb={1.5} sx={{
              background: 'linear-gradient(135deg, #F1F5F9, #94A3B8)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              🏙️ Smart City Đà Nẵng
            </Typography>
            <Typography variant="body2" color="text.secondary" lineHeight={1.8} mb={2} maxWidth={340}>
              Hệ thống giám sát đô thị thông minh — tiếp nhận và xử lý phản ánh của người dân
              về hạ tầng, môi trường và các vấn đề đô thị tại thành phố Đà Nẵng.
            </Typography>
            <Stack direction="row" spacing={0.5}>
              <IconButton size="small" href="https://www.facebook.com/ubabornd.danang" target="_blank"
                sx={{ color: '#64748B', '&:hover': { color: '#3B82F6', bgcolor: 'rgba(59,130,246,0.08)' } }}>
                <Facebook fontSize="small" />
              </IconButton>
              <IconButton size="small" href="https://www.youtube.com/@thaborandha" target="_blank"
                sx={{ color: '#64748B', '&:hover': { color: '#EF4444', bgcolor: 'rgba(239,68,68,0.08)' } }}>
                <YouTube fontSize="small" />
              </IconButton>
              <IconButton size="small" href="https://danang.gov.vn" target="_blank"
                sx={{ color: '#64748B', '&:hover': { color: '#10B981', bgcolor: 'rgba(16,185,129,0.08)' } }}>
                <Language fontSize="small" />
              </IconButton>
            </Stack>
          </Grid>

          {/* Quick links */}
          <Grid item xs={6} sm={3} md={2}>
            <Typography variant="overline" sx={{
              color: '#94A3B8', fontWeight: 700, letterSpacing: 2,
              mb: 1.5, display: 'block', fontSize: '0.7rem',
            }}>
              Truy cập nhanh
            </Typography>
            <Stack spacing={1}>
              {quickLinks.map((link) => (
                <Link key={link.path} component={RouterLink} to={link.path} underline="none"
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.8,
                    color: '#64748B', fontSize: '0.85rem', fontWeight: 500,
                    transition: 'all 0.2s ease',
                    '&:hover': { color: '#3B82F6', transform: 'translateX(4px)' },
                  }}>
                  {link.icon} {link.label}
                </Link>
              ))}
            </Stack>
          </Grid>

          {/* Contact info */}
          <Grid item xs={6} sm={4} md={3}>
            <Typography variant="overline" sx={{
              color: '#94A3B8', fontWeight: 700, letterSpacing: 2,
              mb: 1.5, display: 'block', fontSize: '0.7rem',
            }}>
              Liên hệ
            </Typography>
            <Stack spacing={1.2}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Phone sx={{ fontSize: 15, color: '#3B82F6' }} />
                <Typography variant="body2" color="text.secondary">0394 727 005</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Email sx={{ fontSize: 15, color: '#3B82F6' }} />
                <Typography variant="body2" color="text.secondary">nguyenthanhhoai230504@gmail.com</Typography>
              </Stack>
              <Stack direction="row" alignItems="flex-start" spacing={1}>
                <LocationOn sx={{ fontSize: 15, color: '#3B82F6', mt: 0.3 }} />
                <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
                  38 Bùi Vịnh, Cẩm Lệ,<br />TP. Đà Nẵng
                </Typography>
              </Stack>
            </Stack>
          </Grid>

          {/* Operating hours */}
          <Grid item xs={12} sm={5} md={3}>
            <Typography variant="overline" sx={{
              color: '#94A3B8', fontWeight: 700, letterSpacing: 2,
              mb: 1.5, display: 'block', fontSize: '0.7rem',
            }}>
              Thời gian hoạt động
            </Typography>
            <Stack spacing={1.2}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AccessTime sx={{ fontSize: 15, color: '#10B981' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">Thứ 2 – Chủ nhật</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.7 }}>
                    Tiếp nhận trực tuyến 24/7
                  </Typography>
                </Box>
              </Stack>

            </Stack>
          </Grid>
        </Grid>

        {/* Bottom bar */}
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', mb: 2.5 }} />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems="center"
          spacing={1}
        >
          <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.6 }}>
            © {new Date().getFullYear()} UBND TP. Đà Nẵng — Cổng phản ánh đô thị thông minh
          </Typography>
          <Stack direction="row" spacing={2}>
            <Typography variant="caption" color="text.secondary" sx={{
              opacity: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 },
            }}>
              Điều khoản sử dụng
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{
              opacity: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 },
            }}>
              Chính sách bảo mật
            </Typography>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

export default Footer;
