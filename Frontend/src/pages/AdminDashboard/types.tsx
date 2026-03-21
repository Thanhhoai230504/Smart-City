import React from 'react';
import {
  Box, Paper, Typography, Stack, Avatar,
} from '@mui/material';

// ─── Interfaces ───
export interface DashboardStats {
  overview: {
    totalIssues: number; issuesToday: number; issuesThisWeek: number;
    issuesThisMonth: number; totalUsers: number; totalPlaces: number;
  };
  issuesByStatus: Record<string, number>;
  issuesByCategory: { category: string; label: string; count: number }[];
  issuesTrend: { date: string; count: number }[];
}

export interface TrafficStats {
  totalRoads: number; averageSpeed: number; congestionIndex: number;
  summary: Record<string, number>;
  worstRoads: { name: string; currentSpeed: number; freeFlowSpeed: number; level: string }[];
}

export interface EnvData {
  location: string; temperature: number; humidity: number;
  weatherCondition: string; weatherDescription?: string;
}

export interface IssueItem {
  _id: string; title: string; category: string; status: string;
  location: string; createdAt: string;
  userId?: { _id: string; name: string; email: string };
}

export interface UserItem {
  _id: string; name: string; email: string; role: string;
  isActive: boolean; createdAt: string;
}

export interface PlaceItem {
  _id: string; name: string; type: string; address?: string;
  latitude: number; longitude: number; description?: string;
  phone?: string; isActive: boolean;
}

// ─── Constants ───
export const STATUS_COLORS: Record<string, string> = {
  reported: '#F59E0B', processing: '#3B82F6', resolved: '#10B981', rejected: '#EF4444',
};
export const STATUS_LABELS: Record<string, string> = {
  reported: 'Mới báo cáo', processing: 'Đang xử lý', resolved: 'Đã xử lý', rejected: 'Từ chối',
};
export const CATEGORY_LABELS: Record<string, string> = {
  pothole: 'Ổ gà', garbage: 'Rác thải', streetlight: 'Đèn đường', flooding: 'Ngập nước', tree: 'Cây đổ', other: 'Khác',
};
export const BAR_COLORS = ['#6C63FF', '#00D9A6', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899'];
export const TRAFFIC_LEVEL_COLORS: Record<string, string> = {
  normal: '#10B981', slow: '#F59E0B', congested: '#F97316', heavy: '#EF4444',
};
export const TRAFFIC_LEVEL_LABELS: Record<string, string> = {
  normal: 'Thông thoáng', slow: 'Chậm', congested: 'Đông đúc', heavy: 'Kẹt cứng',
};
export const PLACE_TYPE_LABELS: Record<string, string> = {
  hospital: '🏥 Bệnh viện', school: '🏫 Trường học', bus_stop: '🚏 Trạm xe buýt',
  park: '🌳 Công viên', police: '👮 Công an',
};
export const PLACE_TYPES = ['hospital', 'school', 'bus_stop', 'park', 'police'];

export const cellSx = { borderColor: 'rgba(255,255,255,0.04)' };
export const headCellSx = { color: 'text.secondary', fontWeight: 600, borderColor: 'rgba(255,255,255,0.06)', whiteSpace: 'nowrap' as const };

// ─── Glass Card ───
export const GlassCard: React.FC<{ children: React.ReactNode; sx?: object }> = ({ children, sx }) => (
  <Paper elevation={0} sx={{
    p: 2.5, borderRadius: '16px',
    bgcolor: 'rgba(17,24,39,0.7)', backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.06)',
    transition: 'border-color 0.3s, box-shadow 0.3s',
    '&:hover': { borderColor: 'rgba(108,99,255,0.3)', boxShadow: '0 0 20px rgba(108,99,255,0.08)' },
    ...sx,
  }}>
    {children}
  </Paper>
);

// ─── Stat Card ───
export const StatCard: React.FC<{
  icon: React.ReactElement; label: string; value: number | string;
  gradient: string; sub?: string;
}> = ({ icon, label, value, gradient, sub }) => (
  <GlassCard sx={{ position: 'relative', overflow: 'hidden' }}>
    <Box sx={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: gradient, opacity: 0.12 }} />
    <Stack direction="row" alignItems="center" spacing={2}>
      <Avatar sx={{ width: 48, height: 48, background: gradient }}>{icon}</Avatar>
      <Box>
        <Typography variant="caption" color="text.secondary" fontWeight={500}>{label}</Typography>
        <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </Box>
    </Stack>
  </GlassCard>
);

// ─── Chart Tooltip ───
export const ChartTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: 'rgba(17,24,39,0.95)', p: 1.5, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      {payload.map((p: any, i: number) => (
        <Typography key={i} variant="body2" fontWeight={600} sx={{ color: p.color }}>{p.name}: {p.value}</Typography>
      ))}
    </Box>
  );
};
