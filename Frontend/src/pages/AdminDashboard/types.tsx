import React from 'react';
import {
  Box, Paper, Typography, Stack, Avatar,
} from '@mui/material';
import { Department, UserRole } from '../../types';

// ─── Interfaces ───
export interface DashboardStats {
  overview: {
    totalIssues: number; issuesToday: number; issuesThisWeek: number;
    issuesThisMonth: number; totalUsers: number; totalPlaces: number;
  };
  issuesByStatus: Record<string, number>;
  issuesByCategory: { category: string; label: string; count: number }[];
  issuesTrend: { date: string; count: number }[];
  // Backend gom nhóm sẵn theo field district đã chuẩn hoá
  issuesByDistrict?: { name: string; count: number }[];
  topVotedIssues?: TopVotedIssue[];
}

export interface TopVotedIssue {
  _id: string; title: string; status: string; location: string; voteCount: number;
}

export interface TrafficRoad {
  name: string; currentSpeed: number; freeFlowSpeed: number; level: string;
  lat?: number; lon?: number;
}

export interface TrafficStats {
  totalRoads: number; averageSpeed: number; averageFreeFlowSpeed?: number; congestionIndex: number;
  summary: Record<string, number>;
  worstRoads: TrafficRoad[];
  bestRoads?: TrafficRoad[];
  roads?: TrafficRoad[];
}

export interface EnvData {
  location: string; temperature: number; humidity: number;
  weatherCondition: string; weatherDescription?: string;
}

export interface IssueItem {
    _id: string; title: string; category: string; status: string;
    description: string; location: string; createdAt: string;
    latitude: number; longitude: number; imageUrl?: string | null;
  /** `email` chỉ có khi người gọi là admin/cán bộ */
  userId?: { _id: string; name: string; email?: string } | string;
  voteCount?: number;
  duplicateCount?: number;
}

export interface UserItem {
  _id: string; name: string; email: string; role: UserRole;
  isActive: boolean; createdAt: string;
  departmentId?: Department | string | null;
  issueCount?: number;
  topBadge?: { id: string; label: string; icon: string; threshold: number } | null;
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
export const BAR_COLORS = ['#0B5E8E', '#2F7D64', '#B26A00', '#C62828', '#397DA5', '#6B7F8C'];
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

export const cellSx = { borderColor: 'divider' };
export const headCellSx = { color: 'text.secondary', fontWeight: 700, borderColor: 'divider', whiteSpace: 'nowrap' as const };

// ─── Glass Card ───
export const GlassCard: React.FC<{ children: React.ReactNode; sx?: object }> = ({ children, sx }) => (
  <Paper elevation={0} sx={{
    p: 2.5,
    borderRadius: 1.5,
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: 'none',
    ...sx,
  }}>
    {children}
  </Paper>
);

// ─── Stat Card ───
export const StatCard: React.FC<{
  icon: React.ReactElement; label: string; value: number | string;
  accent: string; sub?: string;
}> = ({ icon, label, value, accent, sub }) => (
  <GlassCard sx={{ borderTop: `3px solid ${accent}`, minHeight: 116 }}>
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Avatar sx={{ width: 42, height: 42, bgcolor: `${accent}14`, color: accent }}>{icon}</Avatar>
      <Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
        <Typography variant="h5" fontWeight={750} sx={{ lineHeight: 1.25 }}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </Box>
    </Stack>
  </GlassCard>
);

// ─── Chart Tooltip ───
export const ChartTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: 'background.paper', p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider', boxShadow: '0 8px 22px rgba(23,43,58,0.12)' }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      {payload.map((p: any, i: number) => (
        <Typography key={i} variant="body2" fontWeight={600} sx={{ color: p.color }}>{p.name}: {p.value}</Typography>
      ))}
    </Box>
  );
};
