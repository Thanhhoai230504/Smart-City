import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
  keyframes,
} from '@mui/material';
import {
  AccountTreeRounded,
  AdminPanelSettingsRounded,
  ApartmentRounded,
  ArrowForwardRounded,
  CampaignRounded,
  CheckCircleRounded,
  EngineeringRounded,
  HubRounded,
  InsightsRounded,
  KeyboardArrowDownRounded,
  LocationOnRounded,
  MapRounded,
  MyLocationRounded,
  PersonRounded,
  PsychologyRounded,
  RouteRounded,
  ScheduleRounded,
  SensorsRounded,
} from '@mui/icons-material';
import { statisticsApi } from '../../api/statisticsApi';

const float = keyframes`
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -10px, 0); }
`;
const pulseRing = keyframes`
  0% { transform: scale(.75); opacity: .8; }
  75%, 100% { transform: scale(2.2); opacity: 0; }
`;
const routeFlow = keyframes`
  to { stroke-dashoffset: -80; }
`;
const scan = keyframes`
  0% { transform: translateY(-30px); opacity: 0; }
  12%, 82% { opacity: .7; }
  100% { transform: translateY(360px); opacity: 0; }
`;
const breathe = keyframes`
  0%, 100% { opacity: .42; }
  50% { opacity: .78; }
`;

interface OverviewStats {
  totalIssues: number;
  resolvedCount: number;
  resolutionRate: number;
  avgResolutionHours: number;
}

const capabilities = [
  {
    icon: <CampaignRounded />,
    title: 'Tiếp nhận phản ánh trực quan',
    description: 'Người dân gửi vị trí và nhiều ảnh ngay trên bản đồ; tiến độ luôn được theo dõi rõ ràng.',
    color: '#38BDF8',
  },
  {
    icon: <PsychologyRounded />,
    title: 'Phát hiện báo cáo trùng',
    description: 'Embedding gợi ý sự cố tương đồng theo nội dung, khoảng cách và thời gian — người dùng vẫn quyết định.',
    color: '#22D3EE',
  },
  {
    icon: <InsightsRounded />,
    title: 'Ưu tiên có thể giải thích',
    description: 'Điểm ưu tiên kết hợp mức độ, thời gian tồn đọng, lượt ủng hộ, mật độ và vị trí nhạy cảm.',
    color: '#FBBF24',
  },
  {
    icon: <AccountTreeRounded />,
    title: 'Phân công đúng đơn vị',
    description: 'Điều phối sự cố tới đúng phòng ban, đúng cán bộ và giữ toàn bộ lịch sử thao tác.',
    color: '#34D399',
  },
  {
    icon: <ScheduleRounded />,
    title: 'SLA và cảnh báo quá hạn',
    description: 'Theo dõi hạn xử lý theo từng loại sự cố, nhắc việc và leo cấp khi cần can thiệp.',
    color: '#FB923C',
  },
  {
    icon: <SensorsRounded />,
    title: 'Dữ liệu đô thị thời gian thực',
    description: 'Một bản đồ thống nhất cho sự cố, giao thông, môi trường và các địa điểm công cộng.',
    color: '#60A5FA',
  },
];

const workflow = [
  { number: '01', title: 'Ghi nhận', text: 'Người dân mô tả, chụp ảnh và ghim đúng vị trí.', icon: <MyLocationRounded /> },
  { number: '02', title: 'Phân tích', text: 'Hệ thống kiểm tra trùng và tính mức ưu tiên minh bạch.', icon: <PsychologyRounded /> },
  { number: '03', title: 'Điều phối', text: 'Admin chuyển việc tới đúng đơn vị và cán bộ phụ trách.', icon: <HubRounded /> },
  { number: '04', title: 'Phản hồi', text: 'Cán bộ cập nhật tiến độ, ảnh kết quả và người dân đánh giá.', icon: <CheckCircleRounded /> },
];

const roles = [
  {
    icon: <PersonRounded />,
    eyebrow: 'NGƯỜI DÂN',
    title: 'Phản ánh và đồng hành',
    text: 'Gửi sự cố, ủng hộ báo cáo, theo dõi tiến độ và đánh giá chất lượng xử lý.',
    action: 'Gửi phản ánh',
    path: '/report',
    color: '#38BDF8',
  },
  {
    icon: <EngineeringRounded />,
    eyebrow: 'CÁN BỘ',
    title: 'Tiếp nhận và xử lý',
    text: 'Làm việc theo đơn vị, ưu tiên và SLA; cập nhật minh chứng trước/sau tại hiện trường.',
    action: 'Mở cổng cán bộ',
    path: '/staff',
    color: '#FBBF24',
  },
  {
    icon: <AdminPanelSettingsRounded />,
    eyebrow: 'QUẢN TRỊ',
    title: 'Điều phối toàn thành phố',
    text: 'Phân công, theo dõi hiệu suất, gộp báo cáo trùng và truy vết nhật ký hoạt động.',
    action: 'Mở trung tâm quản trị',
    path: '/admin',
    color: '#34D399',
  },
];

const useInView = (threshold = 0.16) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, { threshold });
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
};

const Reveal: React.FC<{
  visible: boolean;
  delay?: number;
  children: React.ReactNode;
}> = ({ visible, delay = 0, children }) => (
  <Box sx={{
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(24px)',
    transition: `opacity 700ms ease ${delay}ms, transform 700ms cubic-bezier(.16,1,.3,1) ${delay}ms`,
  }}>
    {children}
  </Box>
);

const AnimatedHeading: React.FC<{ lines: string[]; visible: boolean }> = ({ lines, visible }) => {
  let offset = 0;
  return (
    <Typography
      component="h1"
      aria-label={lines.join(' ')}
      sx={{
        fontSize: { xs: '2.55rem', sm: '3.45rem', md: '4rem', lg: '4.7rem' },
        lineHeight: { xs: 1.04, md: 1.01 },
        letterSpacing: '-0.055em',
        fontWeight: 650,
        color: '#F8FAFC',
        maxWidth: 850,
      }}
    >
      {lines.map((line) => {
        const lineOffset = offset;
        offset += line.length;
        let wordOffset = 0;
        return (
          <Box component="span" display="block" maxWidth="100%" aria-hidden="true" key={line}>
            {line.split(' ').map((word, wordIndex, words) => {
              const currentWordOffset = wordOffset;
              wordOffset += word.length + 1;
              return (
                <React.Fragment key={`${word}-${wordIndex}`}>
                  <Box component="span" display="inline-block" sx={{ whiteSpace: 'nowrap' }}>
                    {Array.from(word).map((character, characterIndex) => (
                      <Box
                        component="span"
                        display="inline-block"
                        key={`${character}-${characterIndex}`}
                        sx={{
                          opacity: visible ? 1 : 0,
                          transform: visible ? 'translateX(0)' : 'translateX(-16px)',
                          transition: 'opacity 500ms ease, transform 500ms cubic-bezier(.16,1,.3,1)',
                          transitionDelay: `${180 + (lineOffset + currentWordOffset + characterIndex) * 22}ms`,
                        }}
                      >
                        {character}
                      </Box>
                    ))}
                  </Box>
                  {wordIndex < words.length - 1 ? ' ' : null}
                </React.Fragment>
              );
            })}
          </Box>
        );
      })}
    </Typography>
  );
};

const IncidentMarker: React.FC<{
  top: string;
  left: string;
  color: string;
  label: string;
  delay?: string;
}> = ({ top, left, color, label, delay = '0s' }) => (
  <Box sx={{ position: 'absolute', top, left, zIndex: 3, animation: `${float} 4s ease-in-out infinite`, animationDelay: delay }}>
    <Box sx={{ position: 'relative', width: 18, height: 18 }}>
      <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', bgcolor: color, animation: `${pulseRing} 2.3s infinite`, animationDelay: delay }} />
      <Box sx={{ position: 'absolute', inset: 4, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 16px ${color}` }} />
    </Box>
    <Typography sx={{
      position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
      whiteSpace: 'nowrap', fontSize: '0.62rem', fontWeight: 650, color: '#DCEBFA',
      bgcolor: 'rgba(4,12,24,.78)', border: `1px solid ${color}45`, borderRadius: 1.5,
      px: 1, py: 0.35, backdropFilter: 'blur(8px)',
    }}>
      {label}
    </Typography>
  </Box>
);

const CommandCenter: React.FC<{ overview: OverviewStats | null }> = ({ overview }) => (
  <Box sx={{
    position: 'relative', width: '100%', maxWidth: 560, ml: 'auto',
    borderRadius: { xs: '24px', md: '30px' }, overflow: 'hidden',
    bgcolor: 'rgba(7,17,31,.72)', border: '1px solid rgba(125,211,252,.2)',
    boxShadow: '0 36px 100px rgba(2,8,23,.58), inset 0 1px rgba(255,255,255,.08)',
    backdropFilter: 'blur(20px) saturate(135%)',
  }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 2, md: 2.5 }, py: 1.7, borderBottom: '1px solid rgba(148,163,184,.12)' }}>
      <Stack direction="row" spacing={1.1} alignItems="center">
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#34D399', boxShadow: '0 0 14px #34D399', animation: `${breathe} 2s ease infinite` }} />
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '.13em', color: '#CBE9F8' }}>
          TRUNG TÂM ĐIỀU PHỐI
        </Typography>
      </Stack>
      <Chip label="LIVE" size="small" sx={{ height: 23, fontSize: '0.64rem', fontWeight: 800, color: '#6EE7B7', bgcolor: 'rgba(16,185,129,.1)', border: '1px solid rgba(52,211,153,.18)' }} />
    </Stack>

    <Box sx={{ position: 'relative', height: { xs: 325, sm: 390 }, overflow: 'hidden', background: 'radial-gradient(circle at 58% 46%, rgba(14,165,233,.14), transparent 38%), linear-gradient(160deg, #071321, #0A1B2E)' }}>
      <Box sx={{ position: 'absolute', inset: 0, opacity: .28, backgroundImage: 'linear-gradient(rgba(125,211,252,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,.1) 1px, transparent 1px)', backgroundSize: '34px 34px', transform: 'perspective(500px) rotateX(4deg) scale(1.08)' }} />
      <Box component="svg" viewBox="0 0 560 390" preserveAspectRatio="none" aria-hidden="true" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <path d="M-20 310 C90 250 145 290 235 215 S410 145 590 85" fill="none" stroke="rgba(56,189,248,.46)" strokeWidth="5" />
        <path d="M-20 310 C90 250 145 290 235 215 S410 145 590 85" fill="none" stroke="#7DD3FC" strokeWidth="1.4" strokeDasharray="7 11" style={{ animation: `${routeFlow} 5s linear infinite` }} />
        <path d="M90 -20 C125 70 115 115 170 175 S275 285 290 420" fill="none" stroke="rgba(52,211,153,.28)" strokeWidth="3" />
        <path d="M365 -20 C330 80 380 135 340 215 S305 310 380 420" fill="none" stroke="rgba(148,163,184,.22)" strokeWidth="2" strokeDasharray="5 8" />
        <path d="M-10 105 C80 135 150 105 225 135 S390 250 570 260" fill="none" stroke="rgba(148,163,184,.18)" strokeWidth="2" />
      </Box>
      <Box sx={{ position: 'absolute', left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(56,189,248,.65), transparent)', boxShadow: '0 0 18px rgba(56,189,248,.55)', animation: `${scan} 5.5s linear infinite` }} />

      <Typography sx={{ position: 'absolute', top: '17%', left: '15%', fontSize: '.63rem', color: 'rgba(203,213,225,.56)', letterSpacing: '.08em' }}>THANH KHÊ</Typography>
      <Typography sx={{ position: 'absolute', top: '47%', left: '42%', fontSize: '.63rem', color: 'rgba(203,213,225,.56)', letterSpacing: '.08em' }}>HẢI CHÂU</Typography>
      <Typography sx={{ position: 'absolute', top: '29%', right: '12%', fontSize: '.63rem', color: 'rgba(203,213,225,.56)', letterSpacing: '.08em' }}>SƠN TRÀ</Typography>

      <IncidentMarker top="26%" left="28%" color="#FBBF24" label="Đang xử lý" />
      <IncidentMarker top="52%" left="58%" color="#38BDF8" label="Mới tiếp nhận" delay=".6s" />
      <IncidentMarker top="33%" left="77%" color="#34D399" label="Đã hoàn thành" delay="1.1s" />

      <Box sx={{ position: 'absolute', left: { xs: 14, sm: 22 }, bottom: { xs: 16, sm: 22 }, p: 1.5, minWidth: 178, borderRadius: 2.5, bgcolor: 'rgba(5,14,27,.76)', border: '1px solid rgba(125,211,252,.16)', backdropFilter: 'blur(12px)', boxShadow: '0 14px 35px rgba(2,8,23,.35)' }}>
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(14,165,233,.13)', color: '#7DD3FC' }}><RouteRounded fontSize="small" /></Avatar>
          <Box>
            <Typography sx={{ fontSize: '.68rem', color: '#8FA6BE' }}>Điều phối thông minh</Typography>
            <Typography sx={{ fontSize: '.78rem', color: '#ECF7FF', fontWeight: 650 }}>Đúng việc · Đúng đơn vị</Typography>
          </Box>
        </Stack>
      </Box>
    </Box>

    <Grid container sx={{ borderTop: '1px solid rgba(148,163,184,.12)' }}>
      {[
        { value: overview ? overview.totalIssues.toLocaleString('vi-VN') : '—', label: 'Phản ánh' },
        { value: overview ? overview.resolvedCount.toLocaleString('vi-VN') : '—', label: 'Đã xử lý' },
        { value: overview ? `${overview.resolutionRate}%` : '24/7', label: 'Tỷ lệ xử lý' },
      ].map((item, index) => (
        <Grid item xs={4} key={item.label} sx={{ borderLeft: index ? '1px solid rgba(148,163,184,.1)' : 'none' }}>
          <Box sx={{ py: 1.7, textAlign: 'center' }}>
            <Typography sx={{ fontSize: { xs: '1rem', sm: '1.2rem' }, fontWeight: 750, color: '#F0F9FF' }}>{item.value}</Typography>
            <Typography sx={{ fontSize: '.66rem', color: '#7F96AE' }}>{item.label}</Typography>
          </Box>
        </Grid>
      ))}
    </Grid>
  </Box>
);

const SectionHeading: React.FC<{ eyebrow: string; title: string; description: string }> = ({ eyebrow, title, description }) => (
  <Box sx={{ maxWidth: 700, mb: { xs: 5, md: 7 } }}>
    <Typography sx={{ color: '#38BDF8', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.18em', mb: 1.5 }}>{eyebrow}</Typography>
    <Typography component="h2" sx={{ fontSize: { xs: '2rem', md: '3.15rem' }, lineHeight: 1.08, letterSpacing: '-.04em', fontWeight: 650, color: '#F4FAFF', mb: 2 }}>{title}</Typography>
    <Typography sx={{ color: '#91A5BC', fontSize: { xs: '.95rem', md: '1.05rem' }, lineHeight: 1.75 }}>{description}</Typography>
  </Box>
);

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [heroVisible, setHeroVisible] = useState(false);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const workflowView = useInView();
  const capabilityView = useInView();
  const roleView = useInView();
  const ctaView = useInView(0.3);

  useEffect(() => {
    const timer = window.setTimeout(() => setHeroVisible(true), 80);
    const controller = new AbortController();
    statisticsApi.getPublicStatistics(controller.signal)
      .then(({ data }) => setOverview(data.data?.overview || null))
      .catch(() => undefined);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return (
    <Box sx={{ bgcolor: '#07111F', color: '#F8FAFC' }}>
      <Box sx={{
        position: 'relative', overflow: 'hidden',
        minHeight: { xs: 'auto', md: 'calc(100svh - 64px)' },
        display: 'flex', alignItems: 'center',
        py: { xs: 7, sm: 9, md: 7 },
        background: 'radial-gradient(circle at 78% 30%, rgba(14,165,233,.15), transparent 31rem), radial-gradient(circle at 10% 85%, rgba(16,185,129,.08), transparent 25rem), #07111F',
      }}>
        <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, opacity: .2, backgroundImage: 'linear-gradient(rgba(148,163,184,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.07) 1px, transparent 1px)', backgroundSize: '72px 72px', maskImage: 'linear-gradient(to bottom, black, transparent 88%)' }} />
        <Box aria-hidden="true" sx={{ position: 'absolute', width: 500, height: 500, border: '1px solid rgba(56,189,248,.08)', borderRadius: '50%', right: '-180px', top: '-250px' }} />

        <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container spacing={{ xs: 7, md: 6, lg: 10 }} alignItems="center">
            <Grid item xs={12} md={7} sx={{ minWidth: 0 }}>
              <Reveal visible={heroVisible}>
                <Chip
                  icon={<SensorsRounded sx={{ color: '#6EE7B7 !important', fontSize: '17px !important' }} />}
                  label="Nền tảng quản lý đô thị · Đà Nẵng"
                  sx={{ mb: 3.5, height: 34, color: '#B7E9FC', bgcolor: 'rgba(8,26,43,.64)', border: '1px solid rgba(125,211,252,.18)', backdropFilter: 'blur(12px)', fontWeight: 650, fontSize: '.76rem' }}
                />
              </Reveal>

              <AnimatedHeading lines={['Mỗi phản ánh tạo nên', 'một thành phố tốt hơn.']} visible={heroVisible} />

              <Reveal visible={heroVisible} delay={720}>
                <Typography sx={{ mt: 3, maxWidth: 680, color: '#9DB0C5', fontSize: { xs: '1rem', md: '1.16rem' }, lineHeight: 1.75 }}>
                  Kết nối người dân, cán bộ và cơ quan quản lý trên một nền tảng duy nhất — từ ghi nhận hiện trường đến điều phối, xử lý và phản hồi minh bạch.
                </Typography>
              </Reveal>

              <Reveal visible={heroVisible} delay={900}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.6} sx={{ mt: 4.2, alignItems: { xs: 'stretch', sm: 'center' } }}>
                  <Button variant="contained" size="large" endIcon={<ArrowForwardRounded />} onClick={() => navigate('/report')} sx={{ px: 3.2, py: 1.45, borderRadius: 3, fontWeight: 700 }}>
                    Báo cáo sự cố
                  </Button>
                  <Button variant="outlined" size="large" startIcon={<MapRounded />} onClick={() => navigate('/map')} sx={{ px: 3.2, py: 1.45, borderRadius: 3, color: '#D9ECF8', bgcolor: 'rgba(8,24,40,.42)', backdropFilter: 'blur(8px)' }}>
                    Mở bản đồ đô thị
                  </Button>
                </Stack>
              </Reveal>

              <Reveal visible={heroVisible} delay={1080}>
                <Stack direction="row" useFlexGap flexWrap="wrap" spacing={2.2} sx={{ mt: 4.5 }}>
                  {['Minh bạch tiến độ', 'Phân công đúng đơn vị', 'Con người quyết định'].map((label) => (
                    <Stack direction="row" spacing={.75} alignItems="center" key={label}>
                      <CheckCircleRounded sx={{ fontSize: 16, color: '#34D399' }} />
                      <Typography sx={{ fontSize: '.78rem', color: '#8198B0', fontWeight: 550 }}>{label}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Reveal>
            </Grid>

            <Grid item xs={12} md={5} sx={{ minWidth: 0 }}>
              <Box sx={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'translate3d(0,0,0) rotate(0)' : 'translate3d(28px,20px,0) rotate(1deg)', transition: 'all 1000ms cubic-bezier(.16,1,.3,1) 420ms' }}>
                <CommandCenter overview={overview} />
              </Box>
            </Grid>
          </Grid>

          <Stack direction="row" alignItems="center" spacing={1} sx={{ display: { xs: 'none', md: 'flex' }, position: 'absolute', bottom: -42, left: 24, color: '#647B92' }}>
            <KeyboardArrowDownRounded sx={{ animation: `${float} 2s ease-in-out infinite` }} />
            <Typography sx={{ fontSize: '.7rem', letterSpacing: '.12em', fontWeight: 650 }}>KHÁM PHÁ HỆ THỐNG</Typography>
          </Stack>
        </Container>
      </Box>

      <Box id="workflow" ref={workflowView.ref} sx={{ py: { xs: 8, md: 13 }, borderTop: '1px solid rgba(148,163,184,.08)', background: 'linear-gradient(180deg, #081421 0%, #07111F 100%)', contentVisibility: 'auto' }}>
        <Container maxWidth="lg">
          <Reveal visible={workflowView.inView}>
            <SectionHeading eyebrow="MỘT QUY TRÌNH LIỀN MẠCH" title="Từ phản ánh đến kết quả, không có khoảng trống." description="Mọi bước đều có người phụ trách, thời hạn và lịch sử rõ ràng để người dân biết thành phố đang hành động như thế nào." />
          </Reveal>
          <Grid container spacing={2.2}>
            {workflow.map((step, index) => (
              <Grid item xs={12} sm={6} md={3} key={step.number}>
                <Box sx={{
                  position: 'relative', minHeight: 236, p: 3, borderRadius: 4,
                  bgcolor: 'rgba(12,29,47,.62)', border: '1px solid rgba(148,163,184,.11)',
                  opacity: workflowView.inView ? 1 : 0,
                  transform: workflowView.inView ? 'translateY(0)' : 'translateY(28px)',
                  transition: `all 700ms cubic-bezier(.16,1,.3,1) ${index * 100}ms`,
                  '&:hover': { transform: 'translateY(-6px)', borderColor: 'rgba(56,189,248,.32)', bgcolor: 'rgba(13,34,55,.82)' },
                }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Avatar sx={{ width: 46, height: 46, bgcolor: 'rgba(14,165,233,.11)', color: '#7DD3FC' }}>{step.icon}</Avatar>
                    <Typography sx={{ color: 'rgba(125,211,252,.24)', fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{step.number}</Typography>
                  </Stack>
                  <Typography sx={{ mt: 3, mb: 1.2, fontSize: '1.08rem', fontWeight: 700 }}>{step.title}</Typography>
                  <Typography sx={{ color: '#8CA1B8', fontSize: '.88rem', lineHeight: 1.7 }}>{step.text}</Typography>
                  {index < workflow.length - 1 && <ArrowForwardRounded sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', top: 45, right: -23, color: 'rgba(56,189,248,.32)', zIndex: 2 }} />}
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box id="capabilities" ref={capabilityView.ref} sx={{ py: { xs: 8, md: 13 }, position: 'relative', overflow: 'hidden', contentVisibility: 'auto' }}>
        <Box aria-hidden="true" sx={{ position: 'absolute', width: 650, height: 650, borderRadius: '50%', right: '-320px', top: '8%', background: 'radial-gradient(circle, rgba(14,165,233,.09), transparent 66%)' }} />
        <Container maxWidth="lg" sx={{ position: 'relative' }}>
          <Reveal visible={capabilityView.inView}>
            <SectionHeading eyebrow="NĂNG LỰC VẬN HÀNH" title="Không chỉ hiển thị dữ liệu. Hệ thống giúp thành phố hành động." description="Các chức năng được thiết kế xoay quanh hiệu quả xử lý thực tế, nhưng luôn giữ quyết định cuối cùng ở người dân và cán bộ có thẩm quyền." />
          </Reveal>
          <Grid container spacing={2.4}>
            {capabilities.map((feature, index) => (
              <Grid item xs={12} sm={6} md={4} key={feature.title}>
                <Card sx={{
                  height: '100%', minHeight: 240, background: 'linear-gradient(155deg, rgba(15,34,55,.86), rgba(8,22,37,.72))',
                  opacity: capabilityView.inView ? 1 : 0,
                  transform: capabilityView.inView ? 'translateY(0)' : 'translateY(32px)',
                  transition: `all 720ms cubic-bezier(.16,1,.3,1) ${(index % 3) * 90}ms`,
                  '&:hover': { transform: 'translateY(-7px)', borderColor: `${feature.color}55`, boxShadow: `0 24px 60px ${feature.color}12`, '& .capability-icon': { transform: 'rotate(-5deg) scale(1.08)' } },
                }}>
                  <CardContent sx={{ p: 3.2 }}>
                    <Box className="capability-icon" sx={{ width: 49, height: 49, display: 'grid', placeItems: 'center', borderRadius: 3, color: feature.color, bgcolor: `${feature.color}12`, border: `1px solid ${feature.color}25`, transition: 'transform 300ms ease' }}>{feature.icon}</Box>
                    <Typography sx={{ mt: 2.7, mb: 1.1, fontSize: '1.03rem', fontWeight: 700 }}>{feature.title}</Typography>
                    <Typography sx={{ color: '#8DA3BA', fontSize: '.87rem', lineHeight: 1.72 }}>{feature.description}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box id="roles" ref={roleView.ref} sx={{ py: { xs: 8, md: 13 }, bgcolor: '#081421', borderBlock: '1px solid rgba(148,163,184,.08)', contentVisibility: 'auto' }}>
        <Container maxWidth="lg">
          <Reveal visible={roleView.inView}>
            <SectionHeading eyebrow="BA VAI TRÒ · MỘT MỤC TIÊU" title="Mỗi người nhìn thấy đúng công việc của mình." description="Phân quyền rõ ràng giúp dữ liệu an toàn, thao tác đơn giản và trách nhiệm xử lý không bị chồng chéo." />
          </Reveal>
          <Grid container spacing={2.5}>
            {roles.map((role, index) => (
              <Grid item xs={12} md={4} key={role.eyebrow}>
                <Box sx={{
                  height: '100%', p: { xs: 3, md: 3.5 }, borderRadius: 4.5,
                  bgcolor: 'rgba(8,23,38,.72)', border: '1px solid rgba(148,163,184,.12)',
                  opacity: roleView.inView ? 1 : 0,
                  transform: roleView.inView ? 'translateY(0)' : 'translateY(30px)',
                  transition: `all 720ms cubic-bezier(.16,1,.3,1) ${index * 100}ms`,
                  '&:hover': { borderColor: `${role.color}45`, transform: 'translateY(-6px)' },
                }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Avatar sx={{ width: 50, height: 50, bgcolor: `${role.color}14`, color: role.color }}>{role.icon}</Avatar>
                    <Typography sx={{ fontSize: '.66rem', letterSpacing: '.16em', fontWeight: 800, color: role.color }}>{role.eyebrow}</Typography>
                  </Stack>
                  <Typography sx={{ mt: 3, fontSize: '1.25rem', fontWeight: 720 }}>{role.title}</Typography>
                  <Typography sx={{ mt: 1.3, minHeight: { md: 75 }, color: '#8CA2B9', fontSize: '.88rem', lineHeight: 1.72 }}>{role.text}</Typography>
                  <Button endIcon={<ArrowForwardRounded />} onClick={() => navigate(role.path)} sx={{ mt: 2.4, px: 0, color: role.color, '&:hover': { bgcolor: 'transparent', transform: 'translateX(4px)' } }}>{role.action}</Button>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box id="participate" ref={ctaView.ref} sx={{ py: { xs: 8, md: 12 }, contentVisibility: 'auto' }}>
        <Container maxWidth="lg">
          <Box sx={{
            position: 'relative', overflow: 'hidden', p: { xs: 3.5, sm: 5, md: 7 }, borderRadius: { xs: 5, md: 7 },
            background: 'radial-gradient(circle at 90% 20%, rgba(52,211,153,.17), transparent 25rem), linear-gradient(130deg, #0B2840, #0B1D30 58%, #0A2730)',
            border: '1px solid rgba(125,211,252,.18)',
            opacity: ctaView.inView ? 1 : 0, transform: ctaView.inView ? 'translateY(0)' : 'translateY(30px)', transition: 'all 800ms cubic-bezier(.16,1,.3,1)',
          }}>
            <Box aria-hidden="true" sx={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', border: '1px solid rgba(52,211,153,.12)', right: -80, top: -120 }} />
            <Grid container spacing={4} alignItems="center" sx={{ position: 'relative' }}>
              <Grid item xs={12} md={8}>
                <Stack direction="row" spacing={1.2} alignItems="center" mb={2}>
                  <LocationOnRounded sx={{ color: '#6EE7B7' }} />
                  <Typography sx={{ color: '#6EE7B7', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.14em' }}>THÀNH PHỐ BẮT ĐẦU TỪ KHU PHỐ CỦA BẠN</Typography>
                </Stack>
                <Typography component="h2" sx={{ maxWidth: 720, fontSize: { xs: '2rem', md: '3.35rem' }, lineHeight: 1.08, letterSpacing: '-.045em', fontWeight: 650 }}>Bạn thấy một vấn đề.<br />Thành phố nhận được một tín hiệu.</Typography>
                <Typography sx={{ mt: 2, maxWidth: 650, color: '#A6BCD0', lineHeight: 1.75 }}>Mỗi phản ánh chính xác giúp đơn vị chức năng phản ứng nhanh hơn và giúp dữ liệu đô thị trở nên hữu ích hơn.</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack spacing={1.5} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
                  <Button variant="contained" size="large" endIcon={<ArrowForwardRounded />} onClick={() => navigate('/report')} sx={{ px: 3.5, py: 1.5, bgcolor: '#F8FAFC', color: '#07111F', backgroundImage: 'none', '&:hover': { bgcolor: '#E0F2FE', backgroundImage: 'none' } }}>Báo cáo ngay</Button>
                  <Button startIcon={<ApartmentRounded />} onClick={() => navigate('/issues')} sx={{ color: '#B9D0E2' }}>Xem các sự cố đang xử lý</Button>
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default HomePage;
