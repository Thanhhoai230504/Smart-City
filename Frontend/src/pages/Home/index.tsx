import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Button, Grid, Card, CardContent, Stack, Chip,
} from '@mui/material';
import {
  Map, ReportProblem, Speed, Thermostat, Security, Notifications,
  TrendingUp, Groups, LocationCity, ArrowForward,
} from '@mui/icons-material';

const features = [
  { icon: <Map sx={{ fontSize: 36 }} />, title: 'Bản đồ tương tác', desc: 'Xem bản đồ thành phố Đà Nẵng với các lớp dữ liệu: địa điểm, sự cố, giao thông, môi trường.', color: '#3B82F6' },
  { icon: <ReportProblem sx={{ fontSize: 36 }} />, title: 'Báo cáo sự cố', desc: 'Người dân có thể báo cáo ổ gà, rác thải, đèn hỏng, ngập nước trực tiếp trên bản đồ.', color: '#EF4444' },
  { icon: <Speed sx={{ fontSize: 36 }} />, title: 'Giao thông real-time', desc: 'Theo dõi tình trạng kẹt xe theo thời gian thực từ TomTom Traffic API.', color: '#F59E0B' },
  { icon: <Thermostat sx={{ fontSize: 36 }} />, title: 'Giám sát môi trường', desc: 'Nhiệt độ, độ ẩm từ OpenWeatherMap hiển thị theo khu vực trên bản đồ.', color: '#10B981' },
  { icon: <Security sx={{ fontSize: 36 }} />, title: 'An toàn & bảo mật', desc: 'Xác thực JWT, phân quyền User/Admin, mã hóa bcrypt an toàn.', color: '#0EA5E9' },
  { icon: <Notifications sx={{ fontSize: 36 }} />, title: 'Thông báo tức thì', desc: 'Socket.io push notification khi có sự cố mới hoặc cập nhật trạng thái.', color: '#EC4899' },
];

const stats = [
  { icon: <LocationCity />, value: 8, suffix: '', label: 'Quận huyện', color: '#3B82F6' },
  { icon: <TrendingUp />, value: 100, suffix: '%', label: 'Thời gian thực', color: '#10B981' },
  { icon: <Groups />, value: 24, suffix: '/7', label: 'Giám sát liên tục', color: '#F59E0B' },
];

// Animated counter hook
const useCountUp = (end: number, duration = 2000, start = false) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration, start]);
  return count;
};

// Intersection observer hook
const useInView = (threshold = 0.3) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
};

// Stat item component — isolates useCountUp at component top level
const StatItem: React.FC<{ stat: typeof stats[number]; index: number; inView: boolean }> = ({ stat, index, inView }) => {
  const count = useCountUp(stat.value, 1500, inView);
  return (
    <Stack alignItems="center" spacing={0.5} sx={{
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(20px)',
      transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.15}s`,
    }}>
      <Box sx={{ color: stat.color, mb: 0.5 }}>{stat.icon}</Box>
      <Typography variant="h3" fontWeight={800} sx={{ color: '#F1F5F9', fontSize: { xs: '1.8rem', md: '2.5rem' } }}>
        {count}{stat.suffix}
      </Typography>
      <Typography variant="body2" color="text.secondary" fontWeight={500}>{stat.label}</Typography>
    </Stack>
  );
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [heroVisible, setHeroVisible] = useState(false);
  const statsView = useInView(0.4);
  const featuresView = useInView(0.15);

  useEffect(() => { setTimeout(() => setHeroVisible(true), 100); }, []);

  return (
    <Box>
      {/* ═══ HERO SECTION ═══ */}
      <Box sx={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #0A0E1A 0%, #0F172A 40%, #111827 100%)',
        py: { xs: 10, md: 16 }, textAlign: 'center',
        minHeight: { md: '85vh' }, display: 'flex', alignItems: 'center',
      }}>
        {/* Geometric grid background */}
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />

        {/* Animated accent lines */}
        <Box sx={{
          position: 'absolute', top: '20%', left: 0, width: '120px', height: '2px',
          background: 'linear-gradient(90deg, transparent, #3B82F6, transparent)',
          animation: 'slideRight 4s ease-in-out infinite',
          willChange: 'transform',
        }} />
        <Box sx={{
          position: 'absolute', bottom: '30%', right: 0, width: '80px', height: '2px',
          background: 'linear-gradient(90deg, transparent, #10B981, transparent)',
          animation: 'slideLeft 5s ease-in-out infinite',
          willChange: 'transform',
        }} />

        {/* Soft glow — single, subtle */}
        <Box sx={{
          position: 'absolute', top: '10%', right: '15%', width: 300, height: 300,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.08), transparent 70%)',
          filter: 'blur(60px)',
        }} />

        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Chip label="🏙️ Smart City Dashboard" sx={{
            mb: 3,
            bgcolor: 'rgba(59,130,246,0.1)', color: '#60A5FA',
            fontWeight: 600, fontSize: '0.85rem',
            border: '1px solid rgba(59,130,246,0.25)',
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }} />

          <Typography variant="h2" sx={{
            fontWeight: 800, mb: 2.5,
            fontSize: { xs: '2.2rem', sm: '3rem', md: '3.8rem' },
            lineHeight: 1.15, letterSpacing: '-0.02em',
            color: '#F1F5F9',
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s',
          }}>
            Giám sát đô thị{' '}
            <Box component="span" sx={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #10B981 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>thông minh</Box>
            <br />
            Thành phố Đà Nẵng
          </Typography>

          <Typography variant="h6" sx={{
            mb: 5, fontWeight: 400, maxWidth: 560, mx: 'auto', lineHeight: 1.75,
            color: '#94A3B8', fontSize: { xs: '1rem', md: '1.1rem' },
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s',
          }}>
            Quản lý, giám sát và phân tích dữ liệu đô thị theo thời gian thực.
            Hỗ trợ người dân báo cáo sự cố và theo dõi tình trạng thành phố.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.45s',
          }}>
            <Button variant="contained" size="large" endIcon={<ArrowForward />}
              onClick={() => navigate('/map')}
              sx={{
                px: 4, py: 1.5, fontSize: '1rem', fontWeight: 600,
                background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
                borderRadius: '12px',
                '&:hover': { boxShadow: '0 6px 30px rgba(59,130,246,0.5)', transform: 'translateY(-2px)' },
                transition: 'all 0.3s ease',
              }}>
              Khám phá bản đồ
            </Button>
            <Button variant="outlined" size="large" startIcon={<ReportProblem />}
              onClick={() => navigate('/report')}
              sx={{
                px: 4, py: 1.5, fontSize: '1rem', fontWeight: 600,
                borderColor: 'rgba(255,255,255,0.15)', color: '#E2E8F0', borderRadius: '12px',
                '&:hover': { borderColor: '#3B82F6', bgcolor: 'rgba(59,130,246,0.06)' },
              }}>
              Báo cáo sự cố
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* ═══ STATS SECTION ═══ */}
      <Box ref={statsView.ref} sx={{
        py: { xs: 5, md: 6 },
        background: 'linear-gradient(180deg, #111827 0%, #0F172A 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <Container maxWidth="md">
          <Grid container spacing={4} justifyContent="center">
            {stats.map((s, i) => (
              <Grid item xs={4} key={i}>
                <StatItem stat={s} index={i} inView={statsView.inView} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ FEATURES SECTION ═══ */}
      <Box ref={featuresView.ref} sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
            <Typography variant="overline" sx={{ color: '#3B82F6', fontWeight: 700, letterSpacing: 3, mb: 1.5, display: 'block' }}>
              TÍNH NĂNG
            </Typography>
            <Typography variant="h3" fontWeight={800} sx={{
              fontSize: { xs: '1.8rem', md: '2.5rem' }, mb: 1.5, color: '#F1F5F9',
            }}>
              Công nghệ hiện đại cho đô thị
            </Typography>
            <Typography color="text.secondary" maxWidth={500} mx="auto" lineHeight={1.7}>
              Tích hợp nhiều nguồn dữ liệu và API để phục vụ giám sát đô thị toàn diện
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {features.map((f, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Card sx={{
                  height: '100%', p: 0.5,
                  transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  opacity: featuresView.inView ? 1 : 0,
                  transform: featuresView.inView ? 'translateY(0)' : 'translateY(40px)',
                  transitionDelay: `${i * 0.1}s`,
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    borderColor: `${f.color}40`,
                    boxShadow: `0 20px 50px ${f.color}12`,
                    '& .feature-icon': { transform: 'scale(1.1) rotate(5deg)' },
                  },
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box className="feature-icon" sx={{
                      width: 56, height: 56, borderRadius: '14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: `${f.color}12`, color: f.color, mb: 2.5,
                      transition: 'transform 0.3s ease',
                    }}>
                      {f.icon}
                    </Box>
                    <Typography variant="h6" fontWeight={700} mb={1} fontSize="1.05rem">{f.title}</Typography>
                    <Typography variant="body2" color="text.secondary" lineHeight={1.75}>{f.desc}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ CTA SECTION ═══ */}
      <Box sx={{
        py: { xs: 8, md: 10 }, textAlign: 'center', position: 'relative',
        background: 'linear-gradient(160deg, rgba(59,130,246,0.06) 0%, rgba(16,185,129,0.04) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        <Container maxWidth="sm">
          <Typography variant="overline" sx={{ color: '#10B981', fontWeight: 700, letterSpacing: 3, mb: 1.5, display: 'block' }}>
            ĐÓNG GÓP
          </Typography>
          <Typography variant="h4" fontWeight={800} mb={2} sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>
            Phát hiện sự cố?
          </Typography>
          <Typography color="text.secondary" mb={4} lineHeight={1.7}>
            Mỗi báo cáo của bạn giúp thành phố phản ứng nhanh hơn và xây dựng Đà Nẵng tốt đẹp hơn.
          </Typography>
          <Button variant="contained" size="large" endIcon={<ArrowForward />}
            onClick={() => navigate('/report')}
            sx={{
              px: 5, py: 1.5, fontSize: '1rem', fontWeight: 600,
              background: 'linear-gradient(135deg, #10B981, #059669)',
              boxShadow: '0 4px 20px rgba(16,185,129,0.3)',
              borderRadius: '12px',
              '&:hover': { boxShadow: '0 6px 30px rgba(16,185,129,0.45)', transform: 'translateY(-2px)' },
              transition: 'all 0.3s ease',
            }}>
            Báo cáo ngay
          </Button>
        </Container>
      </Box>

      <style>{`
        @keyframes slideRight { 0%,100% { transform: translateX(-100%); opacity: 0; } 50% { transform: translateX(100%); opacity: 1; } }
        @keyframes slideLeft { 0%,100% { transform: translateX(100%); opacity: 0; } 50% { transform: translateX(-100%); opacity: 1; } }
      `}</style>
    </Box>
  );
};

export default HomePage;
