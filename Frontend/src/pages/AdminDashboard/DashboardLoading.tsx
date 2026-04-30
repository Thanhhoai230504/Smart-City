import React from 'react';
import { Box, Grid, Stack, keyframes } from '@mui/material';

// ─── Shimmer animation ───
const shimmer = keyframes`
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

// ─── Base shimmer block ───
const ShimmerBlock: React.FC<{
  width?: string | number; height: number | string;
  borderRadius?: string; mb?: number; delay?: number;
}> = ({ width = '100%', height, borderRadius = '12px', mb = 0, delay = 0 }) => (
  <Box sx={{
    width, height, borderRadius, mb,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0.03) 80%)',
    backgroundSize: '800px 100%',
    animation: `${shimmer} 1.8s ease-in-out infinite`,
    animationDelay: `${delay}s`,
  }} />
);

// ─── Stat card skeleton ───
const StatCardSkeleton: React.FC<{ delay: number }> = ({ delay }) => (
  <Box sx={{
    p: 2.5, borderRadius: '16px',
    bgcolor: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.06)',
    position: 'relative', overflow: 'hidden',
    animation: `${fadeIn} 0.5s ease-out ${delay}s both`,
  }}>
    <Box sx={{
      position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%',
      background: 'rgba(255,255,255,0.02)', animation: `${pulse} 2s ease-in-out infinite`,
    }} />
    <Stack direction="row" alignItems="center" spacing={2}>
      <Box sx={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
        animation: `${pulse} 2s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }} />
      <Box sx={{ flex: 1 }}>
        <ShimmerBlock height={12} width="60%" borderRadius="6px" mb={1} delay={delay} />
        <ShimmerBlock height={28} width="40%" borderRadius="8px" delay={delay + 0.1} />
      </Box>
    </Stack>
  </Box>
);

// ─── Chart skeleton ───
const ChartSkeleton: React.FC<{ height?: number; delay: number; title: string }> = ({ height = 320, delay, title }) => (
  <Box sx={{
    p: 2.5, borderRadius: '16px',
    bgcolor: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.06)',
    animation: `${fadeIn} 0.6s ease-out ${delay}s both`,
    height: '100%',
  }}>
    {/* Title shimmer */}
    <ShimmerBlock height={18} width={title.length * 10} borderRadius="8px" mb={2} delay={delay} />
    {/* Chart area */}
    <Box sx={{ position: 'relative', height: height - 80, overflow: 'hidden', borderRadius: '10px' }}>
      {/* Animated bars / lines */}
      <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ height: '100%', px: 2, pt: 2 }}>
        {[65, 40, 80, 55, 70, 45, 90, 60, 75, 50].map((h, i) => (
          <Box key={i} sx={{
            flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0',
            background: 'rgba(255,255,255,0.04)',
            animation: `${pulse} 2s ease-in-out infinite`,
            animationDelay: `${(i * 0.1) + delay}s`,
          }} />
        ))}
      </Stack>
      {/* X-axis line */}
      <Box sx={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px',
        background: 'rgba(255,255,255,0.06)',
      }} />
    </Box>
  </Box>
);

// ─── Table skeleton ───
const TableSkeleton: React.FC<{ delay: number; title: string; rows?: number }> = ({ delay, title, rows = 5 }) => (
  <Box sx={{
    p: 2.5, borderRadius: '16px',
    bgcolor: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.06)',
    animation: `${fadeIn} 0.6s ease-out ${delay}s both`,
  }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
      <ShimmerBlock height={20} width={title.length * 10} borderRadius="8px" delay={delay} />
      <ShimmerBlock height={28} width={100} borderRadius="8px" delay={delay + 0.1} />
    </Stack>
    {/* Header row */}
    <Stack direction="row" spacing={2} mb={1.5} sx={{ pb: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {[80, 140, 70, 70, 60, 50].map((w, i) => (
        <ShimmerBlock key={i} height={12} width={w} borderRadius="4px" delay={delay + 0.05 * i} />
      ))}
    </Stack>
    {/* Data rows */}
    {Array.from({ length: rows }).map((_, row) => (
      <Stack key={row} direction="row" spacing={2} alignItems="center"
        sx={{ py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 80 }}>
          <Box sx={{
            width: 28, height: 28, borderRadius: '50%',
            animation: `${pulse} 2s ease-in-out infinite`,
            animationDelay: `${row * 0.1 + delay}s`,
            background: 'rgba(255,255,255,0.05)',
          }} />
          <ShimmerBlock height={12} width={45} borderRadius="4px" delay={delay + row * 0.08} />
        </Stack>
        <ShimmerBlock height={10} width={140} borderRadius="4px" delay={delay + row * 0.08 + 0.05} />
        <ShimmerBlock height={22} width={60} borderRadius="10px" delay={delay + row * 0.08 + 0.1} />
        <ShimmerBlock height={20} width={55} borderRadius="10px" delay={delay + row * 0.08 + 0.15} />
        <ShimmerBlock height={10} width={50} borderRadius="4px" delay={delay + row * 0.08 + 0.2} />
        <ShimmerBlock height={24} width={24} borderRadius="6px" delay={delay + row * 0.08 + 0.25} />
      </Stack>
    ))}
  </Box>
);

// ─── Circular / Donut chart skeleton ───
const DonutSkeleton: React.FC<{ delay: number }> = ({ delay }) => (
  <Box sx={{
    p: 2.5, borderRadius: '16px', height: '100%',
    bgcolor: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.06)',
    animation: `${fadeIn} 0.6s ease-out ${delay}s both`,
  }}>
    <ShimmerBlock height={18} width={140} borderRadius="8px" mb={2} delay={delay} />
    <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
      <Box sx={{
        width: 160, height: 160, borderRadius: '50%',
        border: '16px solid rgba(255,255,255,0.04)',
        borderTopColor: 'rgba(14,165,233,0.15)',
        borderRightColor: 'rgba(59,130,246,0.12)',
        animation: `${pulse} 2s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }} />
    </Box>
    {/* Legend items */}
    <Stack spacing={1} mt={1}>
      {[100, 85, 70, 55].map((w, i) => (
        <Stack key={i} direction="row" alignItems="center" spacing={1}>
          <Box sx={{
            width: 10, height: 10, borderRadius: '3px',
            animation: `${pulse} 2s ease-in-out infinite`,
            animationDelay: `${i * 0.15 + delay}s`,
            bgcolor: 'rgba(255,255,255,0.06)',
          }} />
          <ShimmerBlock height={10} width={w} borderRadius="4px" delay={delay + i * 0.1} />
        </Stack>
      ))}
    </Stack>
  </Box>
);

// ═══════════ MAIN LOADING COMPONENT ═══════════
const DashboardLoading: React.FC = () => (
  <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 3 } }}>
    {/* Header */}
    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
      <Box sx={{ animation: `${fadeIn} 0.3s ease-out both` }}>
        <ShimmerBlock height={28} width={220} borderRadius="8px" mb={1} />
        <ShimmerBlock height={14} width={320} borderRadius="6px" />
      </Box>
      <Stack direction="row" spacing={1}>
        <ShimmerBlock height={36} width={100} borderRadius="10px" delay={0.1} />
        <ShimmerBlock height={36} width={240} borderRadius="16px" delay={0.15} />
      </Stack>
    </Stack>

    <Grid container spacing={2.5}>
      {/* 6 Stat cards */}
      {[0, 0.05, 0.1, 0.15, 0.2, 0.25].map((d, i) => (
        <Grid item xs={6} md={4} lg={2} key={i}>
          <StatCardSkeleton delay={d} />
        </Grid>
      ))}

      {/* Line chart + Donut */}
      <Grid item xs={12} md={8}>
        <ChartSkeleton height={360} delay={0.3} title="Xu hướng sự cố (30 ngày)" />
      </Grid>
      <Grid item xs={12} md={4}>
        <DonutSkeleton delay={0.35} />
      </Grid>

      {/* Bar chart */}
      <Grid item xs={12}>
        <ChartSkeleton height={320} delay={0.4} title="Phân loại sự cố" />
      </Grid>

      {/* Traffic section */}
      <Grid item xs={12}>
        <ChartSkeleton height={280} delay={0.45} title="Giao thông" />
      </Grid>

      {/* Issue management table */}
      <Grid item xs={12}>
        <TableSkeleton delay={0.5} title="Quản lý sự cố" rows={4} />
      </Grid>

      {/* User management table */}
      <Grid item xs={12}>
        <TableSkeleton delay={0.55} title="Quản lý người dùng" rows={3} />
      </Grid>
    </Grid>
  </Box>
);

export default DashboardLoading;
