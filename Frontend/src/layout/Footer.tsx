import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Stack, IconButton, Link, Container, Grid, Divider, Chip } from '@mui/material';
import {
  Map, BugReport, BarChart, Phone, Email, Language,
  LocationOn, Facebook, YouTube, AccessTime, Videocam, AddLocationAlt,
} from '@mui/icons-material';

const discoveryLinks = [
  { label: 'Bản đồ đô thị', path: '/map', icon: <Map sx={{ fontSize: 16 }} /> },
  { label: 'Danh sách sự cố', path: '/issues', icon: <BugReport sx={{ fontSize: 16 }} /> },
  { label: 'Thống kê', path: '/statistics', icon: <BarChart sx={{ fontSize: 16 }} /> },
  { label: 'Camera công cộng', path: '/cameras', icon: <Videocam sx={{ fontSize: 16 }} /> },
];

const citizenLinks = [
  { label: 'Báo cáo sự cố', path: '/report', icon: <AddLocationAlt sx={{ fontSize: 16 }} /> },
  { label: 'Sự cố của tôi', path: '/my-issues', icon: <BugReport sx={{ fontSize: 16 }} /> },
];

const FooterLink: React.FC<{ label: string; path: string; icon: React.ReactNode }> = ({ label, path, icon }) => (
  <Link component={RouterLink} to={path} underline="none" sx={{
    display: 'flex', alignItems: 'center', gap: 1,
    color: 'rgba(238,247,248,.72)', fontSize: 13, fontWeight: 550,
    transition: 'color .18s ease, transform .18s ease',
    '&:hover': { color: '#FFFFFF', transform: 'translateX(3px)' },
  }}>
    <Box sx={{ color: '#79C5C0', display: 'flex' }}>{icon}</Box>
    {label}
  </Link>
);

const Footer: React.FC = () => (
  <Box component="footer" sx={{ mt: 'auto', color: '#EEF7F8', background: '#173B51', borderTop: '4px solid #79C5C0' }}>
    <Container maxWidth="lg" sx={{ py: { xs: 5, md: 6 } }}>
      <Grid container spacing={{ xs: 4, md: 5 }}>
        <Grid item xs={12} md={4}>
          <Stack spacing={1.8}>
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 1.5, bgcolor: '#79C5C0', color: '#173B51', fontSize: 21 }}>🏙️</Box>
              <Box>
                <Typography fontWeight={800} fontSize={17}>Smart City Đà Nẵng</Typography>
                <Typography sx={{ color: 'rgba(238,247,248,.62)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>Cổng phản ánh đô thị</Typography>
              </Box>
            </Stack>
            <Typography variant="body2" sx={{ color: 'rgba(238,247,248,.72)', lineHeight: 1.75, maxWidth: 360 }}>
              Kết nối người dân, cán bộ và cơ quan quản lý để những vấn đề trên đường phố được ghi nhận và xử lý minh bạch.
            </Typography>
            <Stack direction="row" spacing={.5}>
              <IconButton size="small" href="https://www.facebook.com/" target="_blank" aria-label="Facebook" sx={{ color: 'rgba(238,247,248,.62)', '&:hover': { color: '#FFFFFF', bgcolor: 'rgba(255,255,255,.1)' } }}><Facebook fontSize="small" /></IconButton>
              <IconButton size="small" href="https://www.youtube.com/" target="_blank" aria-label="YouTube" sx={{ color: 'rgba(238,247,248,.62)', '&:hover': { color: '#FFFFFF', bgcolor: 'rgba(255,255,255,.1)' } }}><YouTube fontSize="small" /></IconButton>
              <IconButton size="small" href="https://danang.gov.vn" target="_blank" aria-label="Cổng thông tin Đà Nẵng" sx={{ color: 'rgba(238,247,248,.62)', '&:hover': { color: '#FFFFFF', bgcolor: 'rgba(255,255,255,.1)' } }}><Language fontSize="small" /></IconButton>
            </Stack>
          </Stack>
        </Grid>

        <Grid item xs={6} sm={4} md={2.2}>
          <Typography sx={{ color: '#FFFFFF', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', mb: 2 }}>Khám phá</Typography>
          <Stack spacing={1.35}>{discoveryLinks.map((link) => <FooterLink key={link.path} {...link} />)}</Stack>
        </Grid>

        <Grid item xs={6} sm={4} md={2.2}>
          <Typography sx={{ color: '#FFFFFF', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', mb: 2 }}>Dành cho người dân</Typography>
          <Stack spacing={1.35}>{citizenLinks.map((link) => <FooterLink key={link.path} {...link} />)}</Stack>
        </Grid>

        <Grid item xs={12} sm={4} md={3.6}>
          <Typography sx={{ color: '#FFFFFF', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', mb: 2 }}>Thông tin liên hệ</Typography>
          <Stack spacing={1.25}>
            <Stack direction="row" alignItems="center" spacing={1}><Phone sx={{ fontSize: 17, color: '#79C5C0' }} /><Typography variant="body2" sx={{ color: 'rgba(238,247,248,.78)' }}>0236 1022</Typography></Stack>
            <Stack direction="row" alignItems="center" spacing={1}><Email sx={{ fontSize: 17, color: '#79C5C0' }} /><Typography variant="body2" sx={{ color: 'rgba(238,247,248,.78)', wordBreak: 'break-word' }}>support@smartcity.danang.vn</Typography></Stack>
            <Stack direction="row" alignItems="flex-start" spacing={1}><LocationOn sx={{ fontSize: 17, color: '#79C5C0', mt: .25 }} /><Typography variant="body2" sx={{ color: 'rgba(238,247,248,.78)', lineHeight: 1.6 }}>Trung tâm điều hành đô thị thông minh<br />Thành phố Đà Nẵng</Typography></Stack>
            <Chip icon={<AccessTime sx={{ color: '#79C5C0 !important' }} />} label="Tiếp nhận trực tuyến 24/7" size="small" sx={{ width: 'fit-content', color: '#D9F0EE', border: '1px solid rgba(121,197,192,.35)', bgcolor: 'rgba(121,197,192,.1)' }} />
          </Stack>
        </Grid>
      </Grid>

      <Divider sx={{ my: 4, borderColor: 'rgba(238,247,248,.14)' }} />
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
        <Typography variant="caption" sx={{ color: 'rgba(238,247,248,.55)' }}>© {new Date().getFullYear()} Smart City Đà Nẵng · Hệ thống quản lý đô thị thông minh</Typography>
        <Typography variant="caption" sx={{ color: 'rgba(238,247,248,.55)' }}>Dữ liệu được cập nhật theo thời gian thực</Typography>
      </Stack>
    </Container>
  </Box>
);

export default Footer;
