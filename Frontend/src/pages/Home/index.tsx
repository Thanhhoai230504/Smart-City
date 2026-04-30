import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Button, Grid, Card, CardContent, Stack, Chip, Avatar, keyframes,
} from '@mui/material';
import {
  Map, ReportProblem, Speed, Thermostat, Security, Notifications,
  TrendingUp, Groups, LocationCity, ArrowForward, PlayArrow,
} from '@mui/icons-material';

/* ─── Data ─── */
const features = [
  { icon: <Map sx={{ fontSize: 28 }} />, title: 'Bản đồ tương tác', desc: 'Xem bản đồ Đà Nẵng với dữ liệu realtime: địa điểm, sự cố, giao thông và thời tiết.', color: '#0EA5E9', gradient: 'linear-gradient(135deg, #0EA5E9, #3B82F6)' },
  { icon: <ReportProblem sx={{ fontSize: 28 }} />, title: 'Báo cáo sự cố', desc: 'Chụp ảnh, ghim vị trí — AI tự động phân loại và chuyển đến cơ quan chức năng.', color: '#F43F5E', gradient: 'linear-gradient(135deg, #F43F5E, #E11D48)' },
  { icon: <Speed sx={{ fontSize: 28 }} />, title: 'Giao thông real-time', desc: 'Tích hợp TomTom Traffic — hiển thị tốc độ, ùn tắc trên từng tuyến đường.', color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)' },
  { icon: <Thermostat sx={{ fontSize: 28 }} />, title: 'Giám sát môi trường', desc: 'Nhiệt độ, độ ẩm theo 7 quận huyện từ OpenWeatherMap — biểu đồ xu hướng.', color: '#10B981', gradient: 'linear-gradient(135deg, #10B981, #059669)' },
  { icon: <Security sx={{ fontSize: 28 }} />, title: 'Bảo mật nâng cao', desc: 'JWT + Google OAuth, phân quyền User/Admin, bcrypt — an toàn tuyệt đối.', color: '#0EA5E9', gradient: 'linear-gradient(135deg, #38BDF8, #0EA5E9)' },
  { icon: <Notifications sx={{ fontSize: 28 }} />, title: 'Thông báo tức thì', desc: 'Socket.IO push thông báo sự cố mới, cập nhật trạng thái theo thời gian thực.', color: '#A855F7', gradient: 'linear-gradient(135deg, #A855F7, #7C3AED)' },
];

const stats = [
  { icon: <LocationCity />, value: 8, suffix: '', label: 'Quận huyện', color: '#0EA5E9' },
  { icon: <TrendingUp />, value: 100, suffix: '%', label: 'Thời gian thực', color: '#10B981' },
  { icon: <Groups />, value: 24, suffix: '/7', label: 'Giám sát liên tục', color: '#F59E0B' },
];

/* ─── Keyframes ─── */
const float = keyframes`0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}`;
const pulse = keyframes`0%{box-shadow:0 0 0 0 rgba(14,165,233,0.4)}70%{box-shadow:0 0 0 18px rgba(14,165,233,0)}100%{box-shadow:0 0 0 0 rgba(14,165,233,0)}`;
const shimmer = keyframes`0%{background-position:-200% center}100%{background-position:200% center}`;
const slideRight = keyframes`0%,100%{transform:translateX(-120%);opacity:0}50%{transform:translateX(120%);opacity:1}`;
const slideLeft = keyframes`0%,100%{transform:translateX(120%);opacity:0}50%{transform:translateX(-120%);opacity:1}`;
const fadeInUp = keyframes`from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}`;

/* ─── Hooks ─── */
const useCountUp = (end: number, duration = 2000, start = false) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let t0: number;
    const step = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      setCount(Math.floor(p * end));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration, start]);
  return count;
};

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

/* ─── Sub-components ─── */
const StatItem: React.FC<{ stat: typeof stats[number]; index: number; inView: boolean }> = ({ stat, index, inView }) => {
  const count = useCountUp(stat.value, 1500, inView);
  return (
    <Box sx={{
      textAlign: 'center', p: { xs: 2.5, md: 3 }, borderRadius: '20px',
      bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(20px)',
      transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.15}s`,
      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', borderColor: `${stat.color}30`, transform: 'translateY(-4px)' },
    }}>
      <Avatar sx={{ width: 44, height: 44, mx: 'auto', mb: 1.5, bgcolor: `${stat.color}15`, color: stat.color }}>
        {stat.icon}
      </Avatar>
      <Typography variant="h3" fontWeight={800} sx={{ color: '#E2E8F0', fontSize: { xs: '1.8rem', md: '2.5rem' }, lineHeight: 1.2 }}>
        {count}{stat.suffix}
      </Typography>
      <Typography variant="body2" color="text.secondary" fontWeight={500} mt={0.5}>{stat.label}</Typography>
    </Box>
  );
};

/* ─── Particle dots for hero ─── */
const ParticleDots: React.FC = () => (
  <>
    {Array.from({ length: 20 }).map((_, i) => (
      <Box key={i} sx={{
        position: 'absolute', width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
        borderRadius: '50%', bgcolor: i % 2 === 0 ? 'rgba(14,165,233,0.3)' : 'rgba(16,185,129,0.25)',
        top: `${10 + (i * 4.2) % 80}%`, left: `${5 + (i * 7.3) % 90}%`,
        animation: `${float} ${5 + (i % 4) * 2}s ease-in-out infinite`,
        animationDelay: `${(i * 0.4) % 3}s`,
      }} />
    ))}
  </>
);

/* ═══════════════════════════════════════════════ */
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [heroVisible, setHeroVisible] = useState(false);
  const statsView = useInView(0.3);
  const featuresView = useInView(0.15);
  const ctaView = useInView(0.3);

  useEffect(() => { setTimeout(() => setHeroVisible(true), 100); }, []);

  return (
    <Box>
      {/* ═══ HERO ═══ */}
      <Box sx={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #0C1222 0%, #0F172A 40%, #141B2D 100%)',
        py: { xs: 10, md: 16 }, textAlign: 'center',
        minHeight: { md: '88vh' }, display: 'flex', alignItems: 'center',
      }}>
        {/* Grid pattern */}
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.025,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />

        {/* Floating orbs */}
        <Box sx={{
          position: 'absolute', top: '-8%', right: '8%', width: 450, height: 450,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.1), transparent 65%)',
          filter: 'blur(80px)', animation: `${float} 8s ease-in-out infinite`,
        }} />
        <Box sx={{
          position: 'absolute', bottom: '0%', left: '3%', width: 350, height: 350,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.07), transparent 65%)',
          filter: 'blur(80px)', animation: `${float} 10s ease-in-out infinite reverse`,
        }} />

        {/* Particles */}
        <ParticleDots />

        {/* Accent lines */}
        <Box sx={{
          position: 'absolute', top: '18%', left: 0, width: 160, height: 2,
          background: 'linear-gradient(90deg, transparent, #0EA5E9, transparent)',
          animation: `${slideRight} 5s ease-in-out infinite`,
        }} />
        <Box sx={{
          position: 'absolute', bottom: '25%', right: 0, width: 100, height: 2,
          background: 'linear-gradient(90deg, transparent, #10B981, transparent)',
          animation: `${slideLeft} 6s ease-in-out infinite`,
        }} />

        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          {/* Badge */}
          <Chip
            icon={<PlayArrow sx={{ fontSize: 14, color: '#0EA5E9 !important' }} />}
            label="Hệ thống giám sát đô thị thông minh"
            sx={{
              mb: 3, height: 34,
              bgcolor: 'rgba(14,165,233,0.08)', color: '#7DD3FC',
              fontWeight: 600, fontSize: '0.8rem',
              border: '1px solid rgba(14,165,233,0.2)',
              backdropFilter: 'blur(8px)',
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />

          {/* Heading */}
          <Typography variant="h2" sx={{
            fontWeight: 800, mb: 2.5,
            fontSize: { xs: '2.2rem', sm: '3rem', md: '3.8rem' },
            lineHeight: 1.1, letterSpacing: '-0.03em',
            color: '#E2E8F0',
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s',
          }}>
            Giám sát đô thị{' '}
            <Box component="span" sx={{
              background: 'linear-gradient(135deg, #0EA5E9 0%, #10B981 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>thông minh</Box>
            <br />
            Thành phố Đà Nẵng
          </Typography>

          {/* Subtitle */}
          <Typography sx={{
            mb: 5, fontWeight: 400, maxWidth: 540, mx: 'auto', lineHeight: 1.8,
            color: '#94A3B8', fontSize: { xs: '0.95rem', md: '1.05rem' },
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s',
          }}>
            Giám sát giao thông, môi trường và sự cố đô thị theo thời gian thực.
            Hỗ trợ người dân tham gia xây dựng thành phố thông minh hơn.
          </Typography>

          {/* CTAs */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.45s',
          }}>
            <Button variant="contained" size="large" endIcon={<ArrowForward />}
              onClick={() => navigate('/map')}
              sx={{
                px: 4, py: 1.5, fontSize: '1rem', fontWeight: 600,
                background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
                boxShadow: '0 4px 25px rgba(14,165,233,0.35)',
                borderRadius: '14px', position: 'relative',
                animation: `${pulse} 2.5s infinite`,
                '&:hover': { boxShadow: '0 8px 35px rgba(14,165,233,0.55)', transform: 'translateY(-3px)' },
                transition: 'all 0.3s ease',
              }}>
              Khám phá bản đồ
            </Button>
            <Button variant="outlined" size="large" startIcon={<ReportProblem />}
              onClick={() => navigate('/report')}
              sx={{
                px: 4, py: 1.5, fontSize: '1rem', fontWeight: 600,
                borderColor: 'rgba(14,165,233,0.25)', color: '#E2E8F0', borderRadius: '14px',
                '&:hover': { borderColor: '#0EA5E9', bgcolor: 'rgba(14,165,233,0.06)' },
              }}>
              Báo cáo sự cố
            </Button>
          </Stack>

          {/* Tech bar */}
          <Stack direction="row" spacing={3} justifyContent="center" alignItems="center" sx={{
            mt: 6, opacity: heroVisible ? 0.45 : 0,
            transition: 'opacity 1.2s ease 1s',
          }}>
            {['Google Maps', 'TomTom API', 'OpenWeather', 'Socket.IO'].map((t) => (
              <Typography key={t} variant="caption" sx={{
                color: '#475569', fontWeight: 600, fontSize: '0.65rem', letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}>
                {t}
              </Typography>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ═══ STATS ═══ */}
      <Box ref={statsView.ref} sx={{
        py: { xs: 5, md: 7 },
        background: 'linear-gradient(180deg, #141B2D 0%, #0F172A 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <Container maxWidth="md">
          <Grid container spacing={3} justifyContent="center">
            {stats.map((s, i) => (
              <Grid item xs={4} key={i}>
                <StatItem stat={s} index={i} inView={statsView.inView} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ FEATURES ═══ */}
      <Box ref={featuresView.ref} sx={{
        py: { xs: 8, md: 12 },
        background: 'linear-gradient(180deg, transparent 0%, rgba(14,165,233,0.015) 50%, transparent 100%)',
      }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
            <Typography variant="overline" sx={{ color: '#0EA5E9', fontWeight: 700, letterSpacing: 3, mb: 1.5, display: 'block' }}>
              TÍNH NĂNG
            </Typography>
            <Typography variant="h3" fontWeight={800} sx={{
              fontSize: { xs: '1.8rem', md: '2.5rem' }, mb: 1.5, color: '#E2E8F0',
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
                    borderColor: `${f.color}35`,
                    boxShadow: `0 20px 60px ${f.color}12`,
                    '& .ficon': { transform: 'scale(1.1)', boxShadow: `0 8px 30px ${f.color}30` },
                  },
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box className="ficon" sx={{
                      width: 52, height: 52, borderRadius: '14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: f.gradient, color: '#fff', mb: 2.5,
                      transition: 'all 0.35s ease',
                      boxShadow: `0 4px 15px ${f.color}20`,
                    }}>
                      {f.icon}
                    </Box>
                    <Typography variant="h6" fontWeight={700} mb={0.8} fontSize="1rem">{f.title}</Typography>
                    <Typography variant="body2" color="text.secondary" lineHeight={1.75} fontSize="0.85rem">{f.desc}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ CTA ═══ */}
      <Box ref={ctaView.ref} sx={{ py: { xs: 8, md: 10 }, position: 'relative', overflow: 'hidden' }}>
        {/* Background glow */}
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%', width: 500, height: 500,
          transform: 'translate(-50%, -50%)', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(14,165,233,0.06), transparent 60%)',
          filter: 'blur(80px)',
        }} />

        <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{
            p: { xs: 4, md: 5 }, borderRadius: '24px', textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(14,165,233,0.06) 0%, rgba(16,185,129,0.04) 100%)',
            border: '1px solid rgba(14,165,233,0.1)',
            backdropFilter: 'blur(12px)',
            opacity: ctaView.inView ? 1 : 0,
            transform: ctaView.inView ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <Typography sx={{ fontSize: '2.8rem', mb: 2 }}>🚨</Typography>
            <Typography variant="h4" fontWeight={800} mb={1.5} sx={{ fontSize: { xs: '1.4rem', md: '1.8rem' } }}>
              Phát hiện sự cố?
            </Typography>
            <Typography color="text.secondary" mb={4} lineHeight={1.7} maxWidth={380} mx="auto" fontSize="0.95rem">
              Mỗi báo cáo của bạn giúp thành phố phản ứng nhanh hơn.
              Cùng xây dựng Đà Nẵng tốt đẹp hơn.
            </Typography>
            <Button variant="contained" size="large" endIcon={<ArrowForward />}
              onClick={() => navigate('/report')}
              sx={{
                px: 5, py: 1.5, fontSize: '1rem', fontWeight: 600,
                background: 'linear-gradient(135deg, #10B981, #059669)',
                boxShadow: '0 4px 25px rgba(16,185,129,0.3)',
                borderRadius: '14px',
                '&:hover': { boxShadow: '0 8px 35px rgba(16,185,129,0.5)', transform: 'translateY(-3px)' },
                transition: 'all 0.3s ease',
              }}>
              Báo cáo ngay
            </Button>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default HomePage;
