import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import {
  Box, Stack, Typography, Button, Chip, Container,
  keyframes,
} from '@mui/material';
import {
  ArrowForwardRounded,
  MapRounded,
  InsightsRounded,
  SensorsRounded,
  ReportProblemRounded,
  VideocamRounded,
  AddRounded,
  KeyboardArrowDownRounded,
  NorthEastRounded,
} from '@mui/icons-material';
import { statisticsApi } from '../../api/statisticsApi';

// ─── keyframes ───────────────────────────────────────────────────────────────
const float = keyframes`
  0%,100%{transform:translate3d(0,0,0)}
  50%{transform:translate3d(0,-8px,0)}
`;
const pulseRing = keyframes`
  0%{transform:scale(.8);opacity:.9}
  75%,100%{transform:scale(2.4);opacity:0}
`;
const routeFlow = keyframes`
  to{stroke-dashoffset:-80}
`;
const scan = keyframes`
  0%{transform:translateY(-20px);opacity:0}
  12%,82%{opacity:.55}
  100%{transform:translateY(340px);opacity:0}
`;
const breathe = keyframes`
  0%,100%{opacity:.45}50%{opacity:.85}
`;
const sectionLift = keyframes`
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
`;
const accentDraw = keyframes`
  from { transform: scaleX(0); transform-origin: left; }
  to { transform: scaleX(1); transform-origin: left; }
`;
const rowReveal = keyframes`
  from { opacity: 0; transform: translateX(18px); }
  to { opacity: 1; transform: translateX(0); }
`;
const signalPulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(111,182,154,.26); }
  50% { box-shadow: 0 0 0 5px rgba(111,182,154,0); }
`;

// ─── helpers ─────────────────────────────────────────────────────────────────
const MONO: React.CSSProperties = {
  fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
};

const CUBIC = 'cubic-bezier(.16,1,.3,1)';

const LIGHT_TEXT = {
  ink: '#101820',
  body: '#465B67',
  muted: '#657985',
} as const;

const LIGHT_SECTION_BACKGROUND = `
  radial-gradient(circle at 72% 28%, rgba(45,140,168,.13), transparent 28rem),
  radial-gradient(circle at 12% 78%, rgba(58,128,109,.09), transparent 22rem),
  linear-gradient(180deg, #FFFFFF 0%, #F4F8FA 100%)
`;

const DISCOVERY_SECTION_BACKGROUND = `
  radial-gradient(circle at 82% 18%, rgba(115,168,178,.11), transparent 30rem),
  radial-gradient(circle at 8% 82%, rgba(51,102,105,.15), transparent 24rem),
  linear-gradient(135deg, #0D2531 0%, #10313F 52%, #0B242F 100%)
`;

const LIGHT_GRID = 'linear-gradient(rgba(11,94,142,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(11,94,142,.10) 1px, transparent 1px)';
const NAVY_GRID = 'linear-gradient(rgba(184,216,210,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(184,216,210,.05) 1px, transparent 1px)';

interface Overview {
  totalIssues: number;
  resolvedCount: number;
  resolutionRate: number;
  avgResolutionHours: number;
}

// ─── chapter data ─────────────────────────────────────────────────────────────
const chapters = [
  { id: 0, label: '01', name: 'Phản ánh sự cố', sub: 'Incident reporting layer', path: '/report' },
  { id: 1, label: '02', name: 'Bản đồ đô thị',  sub: 'Urban map & zone layer',  path: '/map' },
  { id: 2, label: '03', name: 'Giao thông',      sub: 'Traffic & route layer',   path: '/map' },
  { id: 3, label: '04', name: 'Môi trường',       sub: 'Environment & AQI layer', path: '/map' },
  { id: 4, label: '05', name: 'Camera giám sát', sub: 'Surveillance layer',      path: '/cameras' },
];

// ─── SVG chapter visuals ─────────────────────────────────────────────────────
const IncidentVisual = () => (
  <svg viewBox="0 0 360 300" width="100%" height="100%" aria-hidden="true" style={{ overflow: 'visible' }}>
    <defs>
      <pattern id="grid-i" width="34" height="34" patternUnits="userSpaceOnUse">
        <path d="M34 0 L0 0 0 34" fill="none" stroke="rgba(56,189,248,.10)" strokeWidth="0.8" />
      </pattern>
    </defs>
    <rect width="360" height="300" fill="url(#grid-i)" />
    {/* route paths */}
    <path d="M30 260 C80 200 130 230 180 160 S280 100 340 60" fill="none" stroke="rgba(56,189,248,.35)" strokeWidth="4" />
    <path d="M30 260 C80 200 130 230 180 160 S280 100 340 60" fill="none" stroke="#7DD3FC" strokeWidth="1.2" strokeDasharray="6 10"
      style={{ animation: `${routeFlow} 4s linear infinite` }} />
    <path d="M20 100 C80 120 130 90 200 130 S300 200 350 220" fill="none" stroke="rgba(52,211,153,.22)" strokeWidth="2.5" />
    {/* incident markers */}
    {[
      { cx: 180, cy: 160, color: '#D6A24A' },
      { cx: 110, cy: 215, color: '#74B7D5', d: '.5s' },
      { cx: 270, cy: 110, color: '#63B38D', d: '1s' },
    ].map(({ cx, cy, color, d = '0s' }) => (
      <g key={cx} transform={`translate(${cx},${cy})`} style={{ animation: `${float} 4s ease-in-out infinite ${d}` }}>
        <circle r="12" fill={color} opacity=".15" style={{ animation: `${pulseRing} 2.4s infinite ${d}` }} />
        <circle r="4.5" fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      </g>
    ))}
    {/* district labels */}
    {[['HẢI CHÂU', 175, 185], ['SƠN TRÀ', 268, 95], ['THANH KHÊ', 100, 200]] .map(([label, x, y]) => (
      <text key={String(label)} x={Number(x)} y={Number(y)} fontSize="8" fontFamily="JetBrains Mono, monospace" fill="rgba(203,213,225,.42)" textAnchor="middle" letterSpacing="1">{label}</text>
    ))}
  </svg>
);

const MapVisual = () => (
  <svg viewBox="0 0 360 300" width="100%" height="100%" aria-hidden="true" style={{ overflow: 'visible' }}>
    <defs>
      <pattern id="grid-m" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M40 0 L0 0 0 40" fill="none" stroke="rgba(56,189,248,.09)" strokeWidth=".8" />
      </pattern>
      <radialGradient id="glow-m" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(14,165,233,.25)" />
        <stop offset="100%" stopColor="transparent" />
      </radialGradient>
    </defs>
    <rect width="360" height="300" fill="url(#grid-m)" />
    <ellipse cx="180" cy="150" rx="120" ry="90" fill="url(#glow-m)" />
    {/* blocks */}
    {[[40,60,70,50],[140,40,60,45],[230,55,55,50],[50,140,80,55],[200,130,65,60],[290,150,55,45],[80,220,70,50],[190,210,75,55]].map(([x,y,w,h],i) => (
      <rect key={i} x={x} y={y} width={w} height={h} rx="3" fill="rgba(14,165,233,.08)" stroke="rgba(56,189,248,.28)" strokeWidth=".8" />
    ))}
    {/* streets */}
    <line x1="0" y1="115" x2="360" y2="115" stroke="rgba(148,163,184,.15)" strokeWidth="6" />
    <line x1="0" y1="175" x2="360" y2="175" stroke="rgba(148,163,184,.15)" strokeWidth="6" />
    <line x1="130" y1="0" x2="130" y2="300" stroke="rgba(148,163,184,.15)" strokeWidth="6" />
    <line x1="250" y1="0" x2="250" y2="300" stroke="rgba(148,163,184,.12)" strokeWidth="4" />
    {/* scan */}
    <line x1="0" y1="0" x2="360" y2="0" stroke="rgba(56,189,248,.5)" strokeWidth="1"
      style={{ animation: `${scan} 4.5s linear infinite` }} />
    {/* center dot */}
    <circle cx="180" cy="148" r="5" fill="#38BDF8" style={{ animation: `${breathe} 2s ease infinite`, filter: 'drop-shadow(0 0 8px #38BDF8)' }} />
  </svg>
);

const TrafficVisual = () => (
  <svg viewBox="0 0 360 300" width="100%" height="100%" aria-hidden="true">
    <rect width="360" height="300" fill="transparent" />
    {/* lanes */}
    {[60, 120, 180, 240].map((y, i) => (
      <g key={y}>
        <rect x="0" y={y - 18} width="360" height="36" fill={i % 2 === 0 ? 'rgba(14,165,233,.04)' : 'rgba(52,211,153,.03)'} />
        <line x1="0" y1={y} x2="360" y2={y} stroke="rgba(148,163,184,.08)" strokeWidth="1" strokeDasharray="12 8" />
      </g>
    ))}
    {/* vehicles — density bars */}
    {[
      { y: 53, bars: [30, 60, 100, 145, 195, 240, 290, 330], color: '#74B7D5', h: 12 },
      { y: 113, bars: [20, 70, 115, 175, 225, 275, 320], color: '#63B38D', h: 11 },
      { y: 173, bars: [45, 95, 140, 185, 240, 285], color: '#74B7D5', h: 12 },
      { y: 233, bars: [35, 80, 130, 180, 230, 285, 325], color: '#D6A24A', h: 11 },
    ].map(({ y, bars, color, h }) =>
      bars.map((x, i) => (
        <rect key={i} x={x} y={y - h / 2} width="26" height={h} rx="3"
          fill={color} opacity={0.55 + (i % 3) * 0.1}
          style={{ animation: `${float} ${2.5 + i * 0.4}s ease-in-out infinite ${i * 0.15}s` }} />
      ))
    )}
    {/* density label */}
    <text x="320" y="290" fontSize="9" fontFamily="JetBrains Mono, monospace" fill="rgba(56,189,248,.5)" textAnchor="end" letterSpacing="1">MẬT ĐỘ CAO</text>
  </svg>
);

const EnvVisual = () => {
  const pts = [0,35,55,42,68,80,95,60,130,45,165,72,200,55,240,40,280,65,320,50,360,38];
  const path = pts.reduce((acc, v, i) => i % 2 === 0 ? `${acc} L${v}` : `${acc},${v}`, 'M0').slice(2);
  const area = `M0,300 ${path} L360,300 Z`;
  return (
    <svg viewBox="0 0 360 300" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id="aqi-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(16,185,129,.35)" />
          <stop offset="100%" stopColor="rgba(16,185,129,.02)" />
        </linearGradient>
      </defs>
      {/* grid lines */}
      {[50, 100, 150, 200, 250].map(y => (
        <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="rgba(148,163,184,.08)" strokeWidth=".8" strokeDasharray="4 6" />
      ))}
      {/* AQI area */}
      <path d={area} fill="url(#aqi-grad)" />
      <path d={path} fill="none" stroke="#10B981" strokeWidth="2" />
      {/* data points */}
      {[[55,42],[130,45],[200,55],[280,65]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#10B981" style={{ filter: 'drop-shadow(0 0 5px #10B981)' }} />
      ))}
      {/* labels */}
      {[['AQI', 20, 35], ['PM2.5', 20, 65], ['NO₂', 20, 95]].map(([l, x, y]) => (
        <text key={String(l)} x={Number(x)} y={Number(y)} fontSize="8.5" fontFamily="JetBrains Mono, monospace" fill="rgba(52,211,153,.55)" letterSpacing=".5">{l}</text>
      ))}
      <text x="340" y="290" fontSize="9" fontFamily="JetBrains Mono, monospace" fill="rgba(52,211,153,.45)" textAnchor="end" letterSpacing="1">TỐT</text>
    </svg>
  );
};

const CameraVisual = () => (
  <svg viewBox="0 0 360 300" width="100%" height="100%" aria-hidden="true">
    {/* viewport frame */}
    <rect x="20" y="20" width="320" height="260" rx="4" fill="rgba(14,165,233,.04)" stroke="rgba(56,189,248,.22)" strokeWidth="1" />
    {/* corner brackets */}
    {[[20,20],[320,20],[20,260],[320,260]].map(([x,y],i) => {
      const sx = i % 2 === 0 ? 1 : -1; const sy = i < 2 ? 1 : -1;
      return (
        <path key={i} d={`M${x+sx*2},${y+sy*18} L${x+sx*2},${y+sy*2} L${x+sx*18},${y+sy*2}`}
          fill="none" stroke="rgba(56,189,248,.7)" strokeWidth="2" />
      );
    })}
    {/* scan line */}
    <line x1="20" y1="20" x2="340" y2="20" stroke="rgba(56,189,248,.55)" strokeWidth="1.5"
      style={{ animation: `${scan} 3.5s linear infinite` }} />
    {/* subject */}
    <rect x="130" y="90" width="100" height="90" rx="3" fill="rgba(56,189,248,.06)" stroke="rgba(56,189,248,.3)" strokeWidth="1" strokeDasharray="4 4" />
    <text x="180" y="141" fontSize="8" fontFamily="JetBrains Mono, monospace" fill="rgba(56,189,248,.6)" textAnchor="middle" letterSpacing=".5">PHÁT HIỆN</text>
    {/* REC indicator */}
    <circle cx="45" cy="42" r="5" fill="#EF4444" style={{ animation: `${breathe} 1.5s ease infinite` }} />
    <text x="55" y="46" fontSize="9" fontFamily="JetBrains Mono, monospace" fill="rgba(239,68,68,.8)" letterSpacing="1">REC</text>
    {/* timestamp */}
    <text x="320" y="46" fontSize="9" fontFamily="JetBrains Mono, monospace" fill="rgba(148,163,184,.5)" textAnchor="end">
      {new Date().toLocaleTimeString('vi-VN', { hour12: false })}
    </text>
    {/* grid overlay */}
    <line x1="140" y1="20" x2="140" y2="280" stroke="rgba(56,189,248,.05)" strokeWidth=".8" />
    <line x1="220" y1="20" x2="220" y2="280" stroke="rgba(56,189,248,.05)" strokeWidth=".8" />
    <line x1="20" y1="120" x2="340" y2="120" stroke="rgba(56,189,248,.05)" strokeWidth=".8" />
    <line x1="20" y1="180" x2="340" y2="180" stroke="rgba(56,189,248,.05)" strokeWidth=".8" />
  </svg>
);

const CHAPTER_VISUALS = [IncidentVisual, MapVisual, TrafficVisual, EnvVisual, CameraVisual];

// ─── sand-dissolve transition ─────────────────────────────────────────────────
const SandLayer: React.FC<{
  filterId: string;
  mode: 'in' | 'out';
  progress: number;
  children: React.ReactNode;
}> = ({ filterId, mode, progress, children }) => {
  const ease = mode === 'in' ? 1 - Math.pow(1 - progress, 4) : Math.pow(progress, 3);
  const dissolve = mode === 'in' ? 1 - ease : ease;
  const scale = dissolve * 130;
  const dy = mode === 'in' ? -70 * dissolve : 110 * dissolve;
  const blur = dissolve * 5;
  const alpha = mode === 'in' ? ease : 1 - ease;

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" result="displaced" />
            <feOffset dy={dy} result="shifted" />
            <feGaussianBlur stdDeviation={blur} result="blurred" />
            <feColorMatrix type="matrix"
              values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${alpha} 0`} />
          </filter>
        </defs>
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, filter: `url(#${filterId})` }}>
        {children}
      </Box>
    </>
  );
};

function useSandTransition(active: number, duration = 900) {
  const [phase, setPhase] = useState<{ current: number; prev: number | null; progress: number }>({
    current: active, prev: null, progress: 1,
  });
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const prefersReduced = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (phase.current === active) return;

    if (prefersReduced.current) {
      setPhase({ current: active, prev: null, progress: 1 });
      return;
    }

    const prevChapter = phase.current;
    startRef.current = null;

    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const t = Math.min((ts - startRef.current) / duration, 1);
      setPhase({ current: active, prev: prevChapter, progress: t });
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPhase({ current: active, prev: null, progress: 1 });
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return phase;
}

// ─── wordmark: "ĐÀ NẴNG" per-letter reveal ───────────────────────────────────
const Wordmark: React.FC<{ visible: boolean }> = ({ visible }) => {
  const text = 'ĐÀ NẴNG';
  let idx = 0;
  return (
    <Box aria-label="Đà Nẵng" sx={{
      display: 'flex', flexWrap: 'wrap', gap: 0,
      fontSize: { xs: '14.5vw', sm: '13vw', md: '15vw' },
      fontWeight: 700,
      lineHeight: 0.9,
      letterSpacing: '-0.03em',
      color: LIGHT_TEXT.ink,
    }}>
      {text.split('').map((ch) => {
        const delay = idx++ * 55;
        return (
          /* Chừa vùng an toàn cho dấu tiếng Việt và hạ wordmark nhẹ xuống. */
          <Box key={`${ch}-${delay}`} sx={{ overflow: 'hidden', pt: '0.32em', mt: '-0.2em', pb: '0.08em' }}>
            <Box sx={{
              display: 'inline-block',
              transform: visible ? 'translateY(0)' : 'translateY(115%)',
              opacity: visible ? 1 : 0,
              transition: `transform 1.2s ${CUBIC} ${delay}ms, opacity 0.6s ease ${delay}ms`,
            }}>
              {ch}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

// ─── shared Reveal wrapper ───────────────────────────────────────────────────
const Reveal: React.FC<{ visible: boolean; delay?: number; children: React.ReactNode }> = ({ visible, delay = 0, children }) => (
  <Box sx={{
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 700ms ease ${delay}ms, transform 700ms ${CUBIC} ${delay}ms`,
  }}>
    {children}
  </Box>
);

// ─── main component ───────────────────────────────────────────────────────────
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((s: RootState) => s.auth);
  const [heroVisible, setHeroVisible] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [activeChapter, setActiveChapter] = useState(2);
  const [exploreVisible, setExploreVisible] = useState(false);
  const exploreRef = useRef<HTMLDivElement>(null);
  const phase = useSandTransition(activeChapter);
  const prefersReduced = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const exploreMotion = exploreVisible && !prefersReduced.current;

  // hero reveal + video fade-in + fetch stats
  useEffect(() => {
    const t  = window.setTimeout(() => setHeroVisible(true), 60);
    const tv = window.setTimeout(() => setShowVideo(true), 2800);
    const ctrl = new AbortController();
    statisticsApi.getPublicStatistics(ctrl.signal)
      .then(({ data }) => setOverview(data.data?.overview || null))
      .catch(() => undefined);
    return () => { window.clearTimeout(t); window.clearTimeout(tv); ctrl.abort(); };
  }, []);

  useEffect(() => {
    const node = exploreRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setExploreVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setExploreVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.18 });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // auto-cycle chapters
  useEffect(() => {
    if (prefersReduced.current) return;
    const t = window.setTimeout(() => {
      setActiveChapter((p) => (p + 1) % 5);
    }, 3500);
    return () => window.clearTimeout(t);
  }, [activeChapter]);

  // ─── SECTION 1: HERO ────────────────────────────────────────────────────────
  return (
    <Box sx={{ bgcolor: '#F5F7F9', color: LIGHT_TEXT.ink, overflow: 'hidden' }}>
      <Box sx={{
        position: 'relative',
        minHeight: { xs: 'auto', md: 'calc(100svh - 64px)' },
        display: 'flex', flexDirection: 'column',
        py: { xs: 6, md: 8 },
        background: LIGHT_SECTION_BACKGROUND,
      }}>
        {/* video background — replace src with your file, e.g. '/assets/danang-aerial.mp4' */}
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden',
          opacity: showVideo ? 1 : 0,
          transition: 'opacity 1000ms ease',
        }}>
          <Box
            component="video"
            autoPlay
            loop
            muted
            playsInline
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          >
            <source src="/assets/danang-aerial.mp4" type="video/mp4" />
          </Box>
          {/* Light veil keeps the aerial footage subtle behind dark text. */}
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(247,250,252,0.88)' }} />
        </Box>

        {/* grid overlay */}
        <Box aria-hidden="true" sx={{
          position: 'absolute', inset: 0, zIndex: 1, opacity: 0.28,
          backgroundImage: LIGHT_GRID,
          backgroundSize: '68px 68px',
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 92%)',
        }} />

        <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {/* wordmark */}
          <Box sx={{ pt: { xs: 2, md: 3 }, mb: { xs: 4, md: 5 } }}>
            <Wordmark visible={heroVisible} />
          </Box>

          {/* sub-nav bar */}
          <Reveal visible={heroVisible} delay={600}>
            <Stack direction="row" spacing={{ xs: 2, md: 3 }} alignItems="flex-start" sx={{
              mb: { xs: 5, md: 7 },
              fontSize: { xs: '9px', md: '10px' },
              ...MONO, textTransform: 'uppercase', letterSpacing: '0.18em',
            }}>
              {/* left col */}
              <Stack spacing={0.4} sx={{ width: { xs: '22%', md: '14%' }, color: LIGHT_TEXT.muted }}>
                <Box>Nền tảng</Box>
                <Box>Quản lý</Box>
                <Box>Đô thị</Box>
              </Stack>
              {/* arrow */}
              <Box sx={{ display: { xs: 'none', sm: 'block' }, width: '4%', pt: 0.5, color: '#78909C' }}>
                <ArrowForwardRounded sx={{ fontSize: 13, strokeWidth: 1 }} />
              </Box>
              {/* center */}
              <Box sx={{ flex: 1, color: LIGHT_TEXT.body, lineHeight: 1.65, maxWidth: { xs: '100%', md: 340 } }}>
                Kết nối người dân, cán bộ và cơ quan quản lý trên một không gian dữ liệu thống nhất — từ phản ánh hiện trường đến xử lý minh bạch.
              </Box>
              {/* arrow */}
              <Box sx={{ display: { xs: 'none', md: 'block' }, width: '4%', pt: 0.5, color: '#78909C' }}>
                <ArrowForwardRounded sx={{ fontSize: 13, strokeWidth: 1 }} />
              </Box>
              {/* right - status */}
              <Stack spacing={0.5} sx={{ display: { xs: 'none', md: 'flex' }, width: '16%', color: LIGHT_TEXT.muted, alignItems: 'flex-end' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ w: 7, h: 7, borderRadius: '50%', bgcolor: '#63B38D', animation: `${breathe} 2s ease infinite` }} />
                  <Box sx={{ fontWeight: 700, color: '#0B5E8E' }}>ĐANG HOẠT ĐỘNG</Box>
                </Stack>
                <Box>24/7 · Realtime</Box>
              </Stack>
            </Stack>
          </Reveal>

          {/* main content: left text + right stats */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 6, md: 8 }} sx={{ flexGrow: 1 }}>
            {/* left sidebar */}
            <Box sx={{ width: { xs: '100%', md: '50%' } }}>
              <Reveal visible={heroVisible} delay={800}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                  <Typography sx={{ fontSize: '11px', ...MONO, color: '#0B5E8E', fontWeight: 700 }}>01</Typography>
                  <Box sx={{ w: 52, h: '1.5px', bgcolor: '#BCD0DA' }} />
                </Stack>
              </Reveal>

              <Reveal visible={heroVisible} delay={1000}>
                <Typography sx={{
                  fontSize: { xs: '2.7rem', md: '4rem', lg: '4.6rem' },
                  lineHeight: 1.02, letterSpacing: '-0.04em', fontWeight: 600, color: LIGHT_TEXT.ink, mb: 3,
                }}>
                  PHẢN ÁNH<br />HÀNH ĐỘNG
                </Typography>
              </Reveal>

              <Reveal visible={heroVisible} delay={1200}>
                <Typography sx={{ color: LIGHT_TEXT.body, fontSize: { xs: '13px', md: '14px' }, lineHeight: 1.7, maxWidth: 420, mb: 4 }}>
                  Ghi lại hiện trường, điều phối đúng đơn vị, phản hồi minh bạch cho từng báo cáo — không có khoảng trống giữa dữ liệu và kết quả.
                </Typography>
              </Reveal>

              <Reveal visible={heroVisible} delay={1400}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate(isAuthenticated ? '/report' : '/login')}
                  sx={{
                    position: 'relative', overflow: 'hidden',
                    px: 4, py: 1.8, borderRadius: 1, fontWeight: 700,
                    bgcolor: '#0B5E8E', color: '#FFFFFF',
                    border: '1px solid #397DA5',
                    '&:hover': {
                      bgcolor: '#0B5E8E',
                      transform: 'translateY(-1px)',
                      boxShadow: '4px 4px 0 rgba(116,183,213,.28)',
                    },
                    '&:active': { transform: 'translateY(0)', boxShadow: 'none' },
                    '&::before': {
                      content: '""', position: 'absolute', inset: 0,
                      bgcolor: '#FFFFFF',
                      transform: 'translateX(-101%)',
                      transition: `transform 700ms ${CUBIC}`,
                    },
                    '&:hover::before': { transform: 'translateX(0)' },
                    '& .MuiButton-endIcon': {
                      position: 'relative', zIndex: 1,
                      transition: `color 400ms ease, transform 300ms ${CUBIC}`,
                    },
                    '&:hover .MuiButton-endIcon': {
                      color: LIGHT_TEXT.ink, transform: 'scale(1.1) rotate(-12deg) translateY(-2px)',
                    },
                    '& .MuiButton-label': {
                      position: 'relative', zIndex: 1,
                      transition: 'color 400ms ease',
                    },
                    '&:hover .MuiButton-label': { color: LIGHT_TEXT.ink },
                  }}
                  endIcon={<AddRounded />}
                >
                  <Box component="span" className="MuiButton-label">
                    {isAuthenticated ? 'Báo cáo ngay' : 'Đăng nhập để báo cáo'}
                  </Box>
                </Button>
              </Reveal>
            </Box>

            {/* right sidebar — stats */}
            <Box sx={{ width: { xs: '100%', md: '50%' }, display: 'flex', alignItems: 'center' }}>
              <Reveal visible={heroVisible} delay={1100}>
                <Box sx={{
                  width: '100%', maxWidth: 480,
                  borderRadius: { xs: 5, md: 6 }, overflow: 'hidden',
                  bgcolor: 'rgba(11,41,66,.94)',
                  border: '1px solid rgba(148,163,184,.16)',
                  boxShadow: '0 20px 50px rgba(0,0,0,.18)',
                  backdropFilter: 'blur(12px)',
                }}>
                  {/* header */}
                  <Stack direction="row" justifyContent="space-between" alignItems="center"
                    sx={{ px: 2.5, py: 1.8, borderBottom: '1px solid rgba(148,163,184,.1)' }}>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <Box sx={{ w: 8, h: 8, borderRadius: '50%', bgcolor: '#34D399', boxShadow: '0 0 12px #34D399', animation: `${breathe} 2s ease infinite` }} />
                      <Typography sx={{ fontSize: '10px', ...MONO, fontWeight: 700, letterSpacing: '.14em', color: '#CBE9F8' }}>
                        SỰ CỐ ĐANG XỬ LÝ
                      </Typography>
                    </Stack>
                    <Chip label="REALTIME" size="small" sx={{
                      height: 22, fontSize: '9px', fontWeight: 800, color: '#6EE7B7',
                      bgcolor: 'rgba(16,185,129,.08)', border: '1px solid rgba(52,211,153,.16)',
                    }} />
                  </Stack>

                  {/* stats grid */}
                  <Stack direction="row" sx={{ borderBottom: '1px solid rgba(148,163,184,.1)' }}>
                    {[
                      { value: overview ? overview.totalIssues.toLocaleString('vi-VN') : '—', label: 'Tổng phản ánh' },
                      { value: overview ? overview.resolvedCount.toLocaleString('vi-VN') : '—', label: 'Đã xử lý' },
                      { value: overview ? `${overview.resolutionRate}%` : '—', label: 'Tỷ lệ' },
                    ].map((item, i) => (
                      <Box key={item.label} sx={{
                        flex: 1, py: 2.2, textAlign: 'center',
                        borderLeft: i ? '1px solid rgba(148,163,184,.08)' : 'none',
                      }}>
                        <Typography sx={{ fontSize: { xs: '1.1rem', sm: '1.35rem' }, fontWeight: 750, color: '#F0F9FF' }}>
                          {item.value}
                        </Typography>
                        <Typography sx={{ fontSize: '10px', color: '#7F96AE', ...MONO, letterSpacing: '.08em' }}>
                          {item.label}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>

                  {/* footer button */}
                  <Box sx={{ px: 2.5, py: 2, display: 'flex', justifyContent: 'center' }}>
                    <Button
                      size="small"
                      endIcon={<NorthEastRounded sx={{ fontSize: 14 }} />}
                      onClick={() => navigate('/statistics')}
                      sx={{
                        fontSize: '10px', ...MONO, textTransform: 'uppercase', letterSpacing: '.12em',
                        color: '#7DD3FC', fontWeight: 700,
                        '&:hover': { bgcolor: 'rgba(125,211,252,.08)' },
                      }}
                    >
                      Xem chi tiết
                    </Button>
                  </Box>
                </Box>
              </Reveal>
            </Box>
          </Stack>

          {/* scroll indicator */}
          <Reveal visible={heroVisible} delay={1600}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{
              display: { xs: 'none', md: 'flex' },
              mt: 'auto', pt: 4, color: LIGHT_TEXT.muted,
            }}>
              <KeyboardArrowDownRounded sx={{ animation: `${float} 2.2s ease-in-out infinite`, fontSize: 22 }} />
              <Typography sx={{ fontSize: '10px', ...MONO, letterSpacing: '.13em', fontWeight: 650 }}>
                CUỘN ĐỂ KHÁM PHÁ
              </Typography>
            </Stack>
          </Reveal>
        </Container>
      </Box>

      {/* ─── SECTION 2: KHÁM PHÁ HỆ THỐNG ───────────────────────────────────── */}
      <Box id="explore" ref={exploreRef} sx={{
        position: 'relative', py: { xs: 8, md: 12 },
        borderTop: '1px solid rgba(255,255,255,.08)',
        background: DISCOVERY_SECTION_BACKGROUND,
        '&::before': {
          content: '""', position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.22,
          backgroundImage: NAVY_GRID, backgroundSize: '68px 68px',
          maskImage: 'linear-gradient(110deg, black 20%, transparent 88%)',
        },
      }}>
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={0}
            sx={{
              borderTop: '1px solid rgba(230,240,242,.16)',
              borderBottom: '1px solid rgba(230,240,242,.16)',
            }}
          >
            <Box sx={{
              width: { xs: '100%', md: '43%' },
              pr: { md: 7 }, py: { xs: 5, md: 7 },
              borderRight: { md: '1px solid rgba(230,240,242,.16)' },
              borderBottom: { xs: '1px solid rgba(230,240,242,.16)', md: 'none' },
            }}>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 5 }}>
                <Box sx={{
                  width: 42, height: 2, bgcolor: '#D2AE6D',
                  transformOrigin: 'left',
                  animation: exploreMotion ? `${accentDraw} 1100ms ${CUBIC} both` : 'none',
                }} />
                <Typography sx={{
                  fontSize: '10px', ...MONO, letterSpacing: '.18em',
                  color: '#A9C7CD', fontWeight: 700,
                  animation: exploreMotion ? `${sectionLift} 900ms ${CUBIC} both` : 'none',
                }}>
                  02 / KHÁM PHÁ HỆ THỐNG
                </Typography>
              </Stack>

              <Typography sx={{
                maxWidth: 470,
                fontSize: { xs: '2.15rem', md: '3rem', lg: '3.45rem' },
                lineHeight: 1.08, fontWeight: 600, letterSpacing: '-0.035em',
                color: '#F4F7F8', mb: 3,
                animation: exploreMotion ? `${sectionLift} 950ms ${CUBIC} 140ms both` : 'none',
              }}>
                Một nền tảng, năm lớp dữ liệu đô thị.
              </Typography>

              <Typography sx={{
                maxWidth: 430, color: '#B5C7CC',
                fontSize: { xs: '13px', md: '14px' }, lineHeight: 1.75, mb: 6,
                animation: exploreMotion ? `${sectionLift} 950ms ${CUBIC} 260ms both` : 'none',
              }}>
                Chọn đúng phân hệ để theo dõi hiện trường, xem dữ liệu công khai hoặc gửi phản ánh đến cơ quan phụ trách.
              </Typography>

              <Stack direction="row" spacing={1.5} alignItems="center" sx={{
                color: '#90AAB1',
                animation: exploreMotion ? `${sectionLift} 950ms ${CUBIC} 380ms both` : 'none',
              }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#6FB69A', animation: `${signalPulse} 3.6s ease-in-out infinite` }} />
                <Typography sx={{ fontSize: '9px', ...MONO, letterSpacing: '.13em', fontWeight: 650 }}>
                  DỮ LIỆU CÔNG KHAI · CẬP NHẬT LIÊN TỤC
                </Typography>
              </Stack>
            </Box>

            <Box sx={{ width: { xs: '100%', md: '57%' } }}>
              {[
                { number: '01', icon: <ReportProblemRounded />, label: 'Sự cố đô thị', note: 'Theo dõi phản ánh và tiến độ xử lý', path: '/issues' },
                { number: '02', icon: <MapRounded />, label: 'Bản đồ thành phố', note: 'Quan sát sự cố và các lớp dữ liệu vị trí', path: '/map' },
                { number: '03', icon: <InsightsRounded />, label: 'Thống kê công khai', note: 'Xem số liệu, tỷ lệ và xu hướng xử lý', path: '/statistics' },
                { number: '04', icon: <SensorsRounded />, label: 'Môi trường', note: 'Theo dõi nhiệt độ, độ ẩm và chất lượng không khí', path: '/map' },
                { number: '05', icon: <VideocamRounded />, label: 'Camera công cộng', note: 'Truy cập các điểm quan sát đang hoạt động', path: '/cameras' },
              ].map((item, index) => (
                <Button
                  key={item.number}
                  onClick={() => navigate(item.path)}
                  sx={{
                    width: '100%', px: { xs: 2, sm: 3.5 }, py: { xs: 2.2, md: 2.5 },
                    borderRadius: 0, borderBottom: index < 4 ? '1px solid rgba(230,240,242,.13)' : 'none',
                    color: '#F4F7F8', textAlign: 'left', textTransform: 'none',
                    justifyContent: 'stretch', position: 'relative', overflow: 'hidden',
                    transition: 'background-color 280ms ease, padding-left 280ms ease',
                    '&::before': {
                      content: '""', position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: 3, bgcolor: '#D2AE6D', transform: 'scaleY(0)', transformOrigin: 'center',
                      transition: 'transform 280ms ease',
                    },
                    opacity: exploreVisible ? 1 : 0,
                    animation: exploreMotion ? `${rowReveal} 850ms ${CUBIC} ${240 + index * 110}ms both` : 'none',
                    '&:hover': { bgcolor: 'rgba(255,255,255,.065)', pl: { xs: 2.5, sm: 4 } },
                    '&:hover::before': { transform: 'scaleY(1)' },
                    '&:hover .discovery-number': { color: '#D2AE6D' },
                    '&:hover .discovery-icon': { transform: 'translateX(3px)', color: '#D2AE6D' },
                    '&:hover .discovery-label': { transform: 'translateX(3px)' },
                    '&:hover .discovery-arrow': { transform: 'translate(3px,-3px)', color: '#D2AE6D' },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={{ xs: 1.5, sm: 2.25 }} sx={{ width: '100%' }}>
                    <Typography sx={{
                      width: 24, flexShrink: 0, color: '#7998A1',
                      fontSize: '9px', ...MONO, letterSpacing: '.12em',
                    }} className="discovery-number">
                      {item.number}
                    </Typography>
                    <Box className="discovery-icon" sx={{ color: '#A9CDD3', display: 'flex', transition: 'transform 280ms ease, color 280ms ease', '& svg': { fontSize: 21 } }}>
                      {item.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography className="discovery-label" sx={{ fontSize: { xs: '1rem', md: '1.08rem' }, fontWeight: 650, lineHeight: 1.3, transition: 'transform 280ms ease' }}>
                        {item.label}
                      </Typography>
                      <Typography sx={{ mt: 0.35, color: '#98B0B6', fontSize: { xs: '11px', sm: '12px' }, lineHeight: 1.45 }}>
                        {item.note}
                      </Typography>
                    </Box>
                    <NorthEastRounded className="discovery-arrow" sx={{
                      flexShrink: 0, fontSize: 19, color: '#789AA3',
                      transition: 'transform 220ms ease, color 220ms ease',
                    }} />
                  </Stack>
                </Button>
              ))}
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* ─── SECTION 3: LIGHT CHAPTER SHOWCASE ───────────────────────────────── */}
      <Box id="operations" sx={{
        position: 'relative', background: LIGHT_SECTION_BACKGROUND, color: LIGHT_TEXT.ink,
        pt: { xs: 12, md: 18 }, pb: { xs: 10, md: 14 },
        '&::before': {
          content: '""', position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.28,
          backgroundImage: LIGHT_GRID, backgroundSize: '68px 68px',
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 92%)',
        },
      }}>
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          {/* heading */}
          <Box sx={{ mb: 12 }}>
            <Typography sx={{
              fontSize: { xs: '1.9rem', md: '3rem', lg: '3.6rem' },
              lineHeight: 1.14, fontWeight: 600, letterSpacing: '-0.038em',
              color: LIGHT_TEXT.ink, mb: 3,
            }}>
              Vận hành thành phố qua dữ liệu minh bạch & kết quả rõ ràng.
            </Typography>
            <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: { xs: '9px', md: '10px' }, ...MONO, textTransform: 'uppercase', letterSpacing: '.16em', color: LIGHT_TEXT.body }}>
                KHÔNG CHỈ HIỂN THỊ SỐ LIỆU / HỆ THỐNG TẠO RA KẾT QUẢ
              </Typography>
            </Stack>
            <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
              {['Minh bạch', 'Chính xác', 'Kịp thời'].map((label) => (
                <Chip key={label} label={label} size="small" sx={{
                  px: 2, py: 1.4, height: 'auto', borderRadius: 20,
                  border: '1px solid #C8D6DE',
                  bgcolor: '#FFFFFF', color: '#0B5E8E',
                  fontSize: '9px', ...MONO, textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 600,
                  '&:hover': { bgcolor: '#0B2942', color: '#FFFFFF', borderColor: '#0B2942' },
                }} />
              ))}
            </Stack>
          </Box>

          {/* chapter showcase */}
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0} sx={{ borderTop: '1px solid #D8E1E7' }}>
            {/* left panel — visual */}
            <Box sx={{
              width: { xs: '100%', lg: '38%' },
              minHeight: { xs: 360, md: 480 },
              borderRight: { xs: 'none', lg: '1px solid #D8E1E7' },
              borderBottom: { xs: '1px solid #D8E1E7', lg: 'none' },
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              p: 4,
            }}>
              {/* visual container */}
              <Box sx={{
                position: 'relative', width: '100%', maxWidth: 360, aspectRatio: '360/300',
                bgcolor: '#0B2942', border: '1px solid #C8D6DE', borderRadius: 2,
                boxShadow: '0 18px 40px rgba(23,43,58,.10)', overflow: 'hidden',
              }}>
                {/* prev layer (exiting) */}
                {phase.prev != null && (
                  <SandLayer filterId="sand-out" mode="out" progress={phase.progress}>
                    <Box sx={{ width: '100%', height: '100%' }}>
                      {React.createElement(CHAPTER_VISUALS[phase.prev])}
                    </Box>
                  </SandLayer>
                )}
                {/* current layer (entering or idle) */}
                <SandLayer filterId="sand-in" mode="in" progress={phase.progress}>
                  <Box sx={{ width: '100%', height: '100%' }}>
                    {React.createElement(CHAPTER_VISUALS[phase.current])}
                  </Box>
                </SandLayer>
              </Box>

              {/* chapter counter */}
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 4, fontSize: '10px', ...MONO, letterSpacing: '.15em', color: LIGHT_TEXT.muted }}>
                <Box sx={{ overflow: 'hidden', height: '1em', position: 'relative' }}>
                  <Box key={activeChapter} sx={{
                    color: '#0B5E8E',
                    animation: 'slideUp 0.4s ease-out',
                    '@keyframes slideUp': {
                      '0%': { transform: 'translateY(100%)', opacity: 0 },
                      '100%': { transform: 'translateY(0)', opacity: 1 },
                    },
                  }}>
                    {String(activeChapter + 1).padStart(2, '0')}
                  </Box>
                </Box>
                <Box sx={{ color: '#91A7B5' }}>/</Box>
                <Box>05</Box>
              </Stack>
            </Box>

            {/* right panel — chapter list */}
            <Box sx={{ width: { xs: '100%', lg: '62%' }, display: 'flex', flexDirection: 'column' }}>
              {/* top bar */}
              <Stack direction="row" justifyContent="space-between" alignItems="center"
                sx={{ px: 4, py: 2.5, borderBottom: '1px solid #D8E1E7', fontSize: '10px', ...MONO, color: LIGHT_TEXT.muted, letterSpacing: '.12em' }}>
                <Box>Báo cáo nhanh. Xử lý minh bạch. Dữ liệu công khai.</Box>
                <Box sx={{ overflow: 'hidden', height: '1em', position: 'relative' }}>
                  <Box key={activeChapter} sx={{
                    animation: 'slideUp 0.4s ease-out',
                    '@keyframes slideUp': {
                      '0%': { transform: 'translateY(100%)', opacity: 0 },
                      '100%': { transform: 'translateY(0)', opacity: 1 },
                    },
                  }}>
                    PHÂN HỆ {String(activeChapter + 1).padStart(2, '0')}
                  </Box>
                </Box>
              </Stack>

              {/* chapter rows */}
              {chapters.map((ch, i) => {
                const isActive = i === activeChapter;
                return (
                  <Box
                    key={ch.id}
                    onClick={() => setActiveChapter(i)}
                    sx={{
                      py: 4, px: 4, cursor: 'pointer',
                      borderBottom: '1px solid #D8E1E7',
                      color: isActive ? LIGHT_TEXT.ink : '#6F818C',
                      transition: 'all 300ms ease',
                      '&:hover': { color: LIGHT_TEXT.ink, bgcolor: '#EDF3F6' },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography sx={{
                          fontSize: { xs: '1.5rem', md: '1.85rem' },
                          fontWeight: 600, letterSpacing: '-0.02em', mb: 0.5,
                        }}>
                          {ch.name}
                        </Typography>
                        <Typography sx={{ fontSize: '11px', ...MONO, color: isActive ? '#0B5E8E' : '#768995', letterSpacing: '.08em' }}>
                          {ch.sub}
                        </Typography>
                      </Box>
                      {isActive && (
                        <NorthEastRounded sx={{ fontSize: 22, color: '#74B7D5', strokeWidth: 1 }} />
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          </Stack>

          {/* footer strip */}
          <Box sx={{ mt: 0, pt: 4, borderTop: '1px solid #D8E1E7', fontSize: '9px', ...MONO, letterSpacing: '.14em', color: LIGHT_TEXT.muted, textAlign: 'center' }}>
            DỮ LIỆU ĐÔ THỊ CHO MỌI CÔNG DÂN
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default HomePage;

