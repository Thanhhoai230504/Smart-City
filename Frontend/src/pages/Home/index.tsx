import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Button, Grid, Card, CardContent, Stack, Chip,
} from '@mui/material';
import { Map, ReportProblem, Speed, Thermostat, Security, Notifications } from '@mui/icons-material';

const features = [
  { icon: <Map sx={{ fontSize: 40 }} />, title: 'Bản đồ tương tác', desc: 'Xem bản đồ thành phố Đà Nẵng với các lớp dữ liệu: địa điểm, sự cố, giao thông, môi trường.', color: '#3B82F6' },
  { icon: <ReportProblem sx={{ fontSize: 40 }} />, title: 'Báo cáo sự cố', desc: 'Người dân có thể báo cáo ổ gà, rác thải, đèn hỏng, ngập nước trực tiếp trên bản đồ.', color: '#EF4444' },
  { icon: <Speed sx={{ fontSize: 40 }} />, title: 'Giao thông real-time', desc: 'Theo dõi tình trạng kẹt xe theo thời gian thực từ TomTom Traffic API.', color: '#F59E0B' },
  { icon: <Thermostat sx={{ fontSize: 40 }} />, title: 'Giám sát môi trường', desc: 'Nhiệt độ, độ ẩm từ OpenWeatherMap hiển thị theo khu vực trên bản đồ.', color: '#10B981' },
  { icon: <Security sx={{ fontSize: 40 }} />, title: 'An toàn & bảo mật', desc: 'Xác thực JWT, phân quyền User/Admin, mã hóa bcrypt.', color: '#8B5CF6' },
  { icon: <Notifications sx={{ fontSize: 40 }} />, title: 'Thông báo tức thì', desc: 'Socket.io push notification khi có sự cố mới hoặc cập nhật trạng thái.', color: '#EC4899' },
];

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box>
      {/* Hero Section */}
      <Box sx={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0A0E1A 0%, #111827 50%, #0A0E1A 100%)',
        py: { xs: 8, md: 14 }, textAlign: 'center',
      }}>
        {/* Animated gradient orbs */}
        <Box sx={{
          position: 'absolute', top: -200, left: -200, width: 500, height: 500,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.15), transparent 70%)',
          filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite',
        }} />
        <Box sx={{
          position: 'absolute', bottom: -200, right: -100, width: 400, height: 400,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,217,166,0.12), transparent 70%)',
          filter: 'blur(80px)', animation: 'float 10s ease-in-out infinite reverse',
        }} />

        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Chip label="🏙️ Smart City Dashboard" sx={{
            mb: 3, bgcolor: 'rgba(108,99,255,0.15)', color: 'primary.main',
            fontWeight: 600, fontSize: '0.85rem', border: '1px solid rgba(108,99,255,0.3)',
          }} />
          <Typography variant="h2" sx={{
            fontWeight: 800, mb: 2, fontSize: { xs: '2rem', md: '3.5rem' },
            background: 'linear-gradient(135deg, #F1F5F9 0%, #94A3B8 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            lineHeight: 1.2,
          }}>
            Giám sát đô thị thông minh<br />
            <Box component="span" sx={{
              background: 'linear-gradient(135deg, #6C63FF, #00D9A6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Thành phố Đà Nẵng</Box>
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 4, fontWeight: 400, maxWidth: 600, mx: 'auto', lineHeight: 1.7 }}>
            Hệ thống quản lý, giám sát và phân tích dữ liệu đô thị theo thời gian thực. 
            Hỗ trợ người dân báo cáo sự cố và theo dõi tình trạng thành phố.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button variant="contained" size="large" startIcon={<Map />} onClick={() => navigate('/map')}
              sx={{ px: 4, py: 1.5, fontSize: '1rem' }}>
              Xem bản đồ
            </Button>
            <Button variant="outlined" size="large" startIcon={<ReportProblem />} onClick={() => navigate('/report')}
              sx={{ px: 4, py: 1.5, fontSize: '1rem', borderColor: 'rgba(255,255,255,0.2)', color: 'text.primary', '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(108,99,255,0.08)' } }}>
              Báo cáo sự cố
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Typography variant="h4" textAlign="center" fontWeight={700} mb={1}>
          Tính năng nổi bật
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center" mb={6} maxWidth={600} mx="auto">
          Hệ thống tích hợp nhiều công nghệ hiện đại phục vụ quản lý đô thị
        </Typography>
        <Grid container spacing={3}>
          {features.map((f, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card sx={{
                height: '100%', p: 1, transition: 'all 0.3s ease',
                '&:hover': { transform: 'translateY(-6px)', borderColor: `${f.color}30`, boxShadow: `0 12px 40px ${f.color}15` },
              }}>
                <CardContent>
                  <Box sx={{ width: 64, height: 64, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${f.color}15`, color: f.color, mb: 2 }}>
                    {f.icon}
                  </Box>
                  <Typography variant="h6" fontWeight={600} mb={1}>{f.title}</Typography>
                  <Typography variant="body2" color="text.secondary" lineHeight={1.7}>{f.desc}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA Section */}
      <Box sx={{ py: 8, textAlign: 'center', background: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(0,217,166,0.05))' }}>
        <Container maxWidth="sm">
          <Typography variant="h4" fontWeight={700} mb={2}>Bạn phát hiện sự cố?</Typography>
          <Typography color="text.secondary" mb={4}>Hãy báo cáo để cùng nhau xây dựng thành phố tốt đẹp hơn</Typography>
          <Button variant="contained" size="large" onClick={() => navigate('/report')} sx={{ px: 5 }}>
            Báo cáo ngay
          </Button>
        </Container>
      </Box>

      <style>{`@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-30px); } }`}</style>
    </Box>
  );
};

export default HomePage;
