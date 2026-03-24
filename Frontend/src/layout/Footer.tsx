import React from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Stack, IconButton, Link, Container, Grid } from '@mui/material';
import { GitHub, Email, Map, BugReport, Dashboard } from '@mui/icons-material';

const footerLinks = [
  { label: 'Bản đồ', path: '/map', icon: <Map sx={{ fontSize: 16 }} /> },
  { label: 'Sự cố', path: '/issues', icon: <BugReport sx={{ fontSize: 16 }} /> },
  { label: 'Báo cáo', path: '/report', icon: <BugReport sx={{ fontSize: 16 }} /> },
];

const Footer: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box component="footer" sx={{
      pt: 6, pb: 3, mt: 'auto',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(180deg, rgba(15,23,42,0.8) 0%, rgba(15,23,42,0.95) 100%)',
      backdropFilter: 'blur(12px)',
    }}>
      <Container maxWidth="lg">
        <Grid container spacing={4} mb={4}>
          {/* Brand */}
          <Grid item xs={12} sm={5}>
            <Typography fontWeight={800} fontSize="1.1rem" mb={1} sx={{
              background: 'linear-gradient(135deg, #F1F5F9, #94A3B8)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              🏙️ Smart City Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary" lineHeight={1.7} maxWidth={320}>
              Hệ thống giám sát đô thị thông minh thành phố Đà Nẵng — quản lý sự cố, giao thông và môi trường theo thời gian thực.
            </Typography>
          </Grid>

          {/* Quick links */}
          <Grid item xs={6} sm={3}>
            <Typography variant="overline" sx={{ color: '#94A3B8', fontWeight: 700, letterSpacing: 2, mb: 1.5, display: 'block', fontSize: '0.7rem' }}>
              Liên kết
            </Typography>
            <Stack spacing={1}>
              {footerLinks.map((link) => (
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

          {/* Contact */}
          <Grid item xs={6} sm={4}>
            <Typography variant="overline" sx={{ color: '#94A3B8', fontWeight: 700, letterSpacing: 2, mb: 1.5, display: 'block', fontSize: '0.7rem' }}>
              Thông tin
            </Typography>
            <Stack spacing={0.8}>
              <Typography variant="body2" color="text.secondary">📍 Đà Nẵng, Việt Nam</Typography>
              <Typography variant="body2" color="text.secondary">🎓 Đồ án tốt nghiệp</Typography>
              <Typography variant="body2" color="text.secondary">📚 Công nghệ thông tin</Typography>
            </Stack>
          </Grid>
        </Grid>

        {/* Bottom bar */}
        <Box sx={{
          pt: 2.5,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5,
        }}>
          <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.7 }}>
            © {new Date().getFullYear()} Smart City Dashboard — Đà Nẵng
          </Typography>
          <Stack direction="row" spacing={0.5}>
            <IconButton size="small" href="https://github.com" target="_blank"
              sx={{ color: '#64748B', '&:hover': { color: '#F1F5F9', bgcolor: 'rgba(255,255,255,0.06)' } }}>
              <GitHub fontSize="small" />
            </IconButton>
            <IconButton size="small" href="mailto:contact@smartcity.danang.vn"
              sx={{ color: '#64748B', '&:hover': { color: '#3B82F6', bgcolor: 'rgba(59,130,246,0.08)' } }}>
              <Email fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
