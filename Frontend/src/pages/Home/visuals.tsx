import React from 'react';
import { Box, keyframes } from '@mui/material';

// Hình minh hoạ năm lớp dữ liệu công khai + hiệu ứng chuyển cảnh "tan cát" — giữ
// nguyên từ bản trang chủ trước, chỉ tách ra file riêng.

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

const CIVIC_CYAN = '#8CC8D1';
const CIVIC_GOLD = '#D2AE6D';

export const IncidentVisual = () => (
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

export const MapVisual = () => (
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

export const TrafficVisual = () => (
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

export const EnvVisual = () => {
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
      {/* vùng biểu đồ môi trường */}
      <path d={area} fill="url(#aqi-grad)" />
      <path d={path} fill="none" stroke="#10B981" strokeWidth="2" />
      {/* data points */}
      {[[55,42],[130,45],[200,55],[280,65]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#10B981" style={{ filter: 'drop-shadow(0 0 5px #10B981)' }} />
      ))}
      {/* labels */}
      {[['NHIỆT ĐỘ', 20, 35], ['ĐỘ ẨM', 20, 65], ['THỜI TIẾT', 20, 95]].map(([l, x, y]) => (
        <text key={String(l)} x={Number(x)} y={Number(y)} fontSize="8.5" fontFamily="JetBrains Mono, monospace" fill="rgba(52,211,153,.55)" letterSpacing=".5">{l}</text>
      ))}
      <text x="340" y="290" fontSize="9" fontFamily="JetBrains Mono, monospace" fill="rgba(52,211,153,.45)" textAnchor="end" letterSpacing="1">TỐT</text>
    </svg>
  );
};

export const CameraVisual = () => (
  <svg viewBox="0 0 360 300" width="100%" height="100%" aria-hidden="true">
    {/* viewport frame */}
    <rect x="20" y="20" width="320" height="260" rx="4" fill="rgba(140,200,209,.05)" stroke="rgba(140,200,209,.34)" strokeWidth="1" />
    {/* corner brackets */}
    {[[20,20],[320,20],[20,260],[320,260]].map(([x,y],i) => {
      const sx = i % 2 === 0 ? 1 : -1; const sy = i < 2 ? 1 : -1;
      return (
        <path key={i} d={`M${x+sx*2},${y+sy*18} L${x+sx*2},${y+sy*2} L${x+sx*18},${y+sy*2}`}
          fill="none" stroke={CIVIC_CYAN} strokeWidth="2" />
      );
    })}
    {/* scan line */}
    <line x1="20" y1="20" x2="340" y2="20" stroke={CIVIC_GOLD} strokeOpacity=".72" strokeWidth="1.5"
      style={{ animation: `${scan} 3.5s linear infinite` }} />
    {/* subject */}
    <rect x="130" y="90" width="100" height="90" rx="3" fill="rgba(111,182,154,.08)" stroke="rgba(111,182,154,.42)" strokeWidth="1" strokeDasharray="4 4" />
    <text x="180" y="141" fontSize="8" fontFamily="JetBrains Mono, monospace" fill="rgba(168,211,198,.82)" textAnchor="middle" letterSpacing=".5">PHÁT HIỆN</text>
    {/* REC indicator */}
    <circle cx="45" cy="42" r="5" fill="#E56B5D" style={{ animation: `${breathe} 1.5s ease infinite` }} />
    <text x="55" y="46" fontSize="9" fontFamily="JetBrains Mono, monospace" fill="rgba(239,164,154,.88)" letterSpacing="1">REC</text>
    {/* timestamp */}
    <text x="320" y="46" fontSize="9" fontFamily="JetBrains Mono, monospace" fill="rgba(184,216,210,.62)" textAnchor="end">
      {new Date().toLocaleTimeString('vi-VN', { hour12: false })}
    </text>
    {/* grid overlay */}
    <line x1="140" y1="20" x2="140" y2="280" stroke="rgba(184,216,210,.08)" strokeWidth=".8" />
    <line x1="220" y1="20" x2="220" y2="280" stroke="rgba(184,216,210,.08)" strokeWidth=".8" />
    <line x1="20" y1="120" x2="340" y2="120" stroke="rgba(184,216,210,.08)" strokeWidth=".8" />
    <line x1="20" y1="180" x2="340" y2="180" stroke="rgba(184,216,210,.08)" strokeWidth=".8" />
  </svg>
);


// ─── sand-dissolve transition ─────────────────────────────────────────────────
export const SandLayer: React.FC<{
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
