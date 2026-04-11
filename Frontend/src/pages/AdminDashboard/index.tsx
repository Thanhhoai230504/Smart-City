import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { Navigate } from 'react-router-dom';
import { dashboardApi } from '../../api/dashboardApi';
import { environmentApi } from '../../api/environmentApi';
import { issueApi } from '../../api/issueApi';
import {
  Box, Grid, Typography, Chip, Stack, Skeleton, Button, CircularProgress,
} from '@mui/material';
import {
  BugReport, Today, CalendarMonth, People, Place as PlaceIcon, Speed,
  Thermostat, WaterDrop, Email, ThumbUp,
} from '@mui/icons-material';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
} from 'recharts';
import {
  DashboardStats, TrafficStats, EnvData, GlassCard, StatCard, ChartTooltip,
  STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS, BAR_COLORS,
  TRAFFIC_LEVEL_COLORS, TRAFFIC_LEVEL_LABELS,
} from './types';
import IssueManagement from './IssueManagement';
import UserManagement from './UserManagement';
import PlaceManagement from './PlaceManagement';
import EnvironmentHistoryChart from './EnvironmentHistoryChart';
import TrafficDashboard from './TrafficDashboard';
import ExportButton from './ExportButton';
import DashboardLoading from './DashboardLoading';

// ═══════════════ MAIN COMPONENT ═══════════════
const AdminDashboard: React.FC = () => {
  const { user: currentUser, isAuthenticated } = useSelector((s: RootState) => s.auth);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [traffic, setTraffic] = useState<TrafficStats | null>(null);
  const [envData, setEnvData] = useState<EnvData[]>([]);
  const [allIssues, setAllIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReport, setSendingReport] = useState(false);


  const refreshStats = useCallback(async () => {
    try {
      const { data } = await dashboardApi.getStats();
      setStats(data.data);
    } catch { }
  }, []);

  // ── Load dashboard data ──
  useEffect(() => {
    if (!isAuthenticated || !currentUser || currentUser.role !== 'admin') return;
    (async () => {
      setLoading(true);
      try {
        const [s, t, e, i] = await Promise.allSettled([
          dashboardApi.getStats(), dashboardApi.getTrafficStats(), environmentApi.getEnvironmentData(),
          issueApi.getIssues({ limit: 500, sort: '-createdAt' }),
        ]);
        if (s.status === 'fulfilled') setStats(s.value.data.data);
        if (t.status === 'fulfilled') setTraffic(t.value.data.data);
        if (e.status === 'fulfilled') {
          const d = e.value.data.data;
          setEnvData(Array.isArray(d.environment) ? d.environment : []);
        }
        if (i.status === 'fulfilled') setAllIssues(i.value.data.data.issues || []);
      } finally { setLoading(false); }
    })();
  }, [isAuthenticated, currentUser]);

  // District classification from location string (goong.io address)
  const districtData = useMemo(() => {
    const DISTRICT_NAMES = ['Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn', 'Liên Chiểu', 'Cẩm Lệ', 'Hòa Vang'];
    const districts: Record<string, number> = {};
    DISTRICT_NAMES.forEach((d) => { districts[d] = 0; });
    districts['Khác'] = 0;

    allIssues.forEach((issue) => {
      const loc = issue.location || '';
      const matched = DISTRICT_NAMES.find((d) => loc.includes(d));
      districts[matched || 'Khác']++;
    });

    return Object.entries(districts)
      .filter(([, count]) => count > 0)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allIssues]);

  // Auth guards (AFTER all hooks)
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!currentUser) return <DashboardLoading />;
  if (currentUser.role !== 'admin') return <Navigate to="/" replace />;

  if (loading) return <DashboardLoading />;

  // Prepare chart data
  const pieData = stats ? Object.entries(stats.issuesByStatus).map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v, color: STATUS_COLORS[k] })) : [];
  const barData = stats?.issuesByCategory.map(c => ({ name: CATEGORY_LABELS[c.category] || c.label, count: c.count })) || [];
  const trendData = stats?.issuesTrend.map(t => ({ date: t.date.slice(5), 'Sự cố': t.count })) || [];
  const cColor = traffic ? (traffic.congestionIndex > 50 ? '#EF4444' : traffic.congestionIndex > 30 ? '#F59E0B' : '#10B981') : '#10B981';

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={700}>📊 Admin Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">Tổng quan hệ thống Smart City — Đà Nẵng</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <ExportButton />
          <Button size="small" variant="outlined" startIcon={sendingReport ? <CircularProgress size={14} /> : <Email />}
            disabled={sendingReport}
            onClick={async () => {
              setSendingReport(true);
              try {
                await dashboardApi.sendReport('weekly');
                alert('Đã gửi báo cáo tuần đến email admin!');
              } catch { alert('Gửi thất bại'); }
              setSendingReport(false);
            }}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}>
            {sendingReport ? 'Đang gửi...' : 'Gửi báo cáo'}
          </Button>
          <Chip label={new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            sx={{ bgcolor: 'rgba(108,99,255,0.1)', color: 'primary.light', fontWeight: 500 }} />
        </Stack>
      </Stack>

      <Grid container spacing={2.5}>
        {/* STAT CARDS */}
        <Grid item xs={6} md={4} lg={2}><StatCard icon={<BugReport />} label="Tổng sự cố" value={stats?.overview.totalIssues || 0} gradient="linear-gradient(135deg, #6C63FF, #5A52D5)" /></Grid>
        <Grid item xs={6} md={4} lg={2}><StatCard icon={<Today />} label="Hôm nay" value={stats?.overview.issuesToday || 0} gradient="linear-gradient(135deg, #F59E0B, #D97706)" /></Grid>
        <Grid item xs={6} md={4} lg={2}><StatCard icon={<CalendarMonth />} label="Tuần này" value={stats?.overview.issuesThisWeek || 0} gradient="linear-gradient(135deg, #3B82F6, #2563EB)" /></Grid>
        <Grid item xs={6} md={4} lg={2}><StatCard icon={<People />} label="Người dùng" value={stats?.overview.totalUsers || 0} gradient="linear-gradient(135deg, #10B981, #059669)" /></Grid>
        <Grid item xs={6} md={4} lg={2}><StatCard icon={<PlaceIcon />} label="Địa điểm" value={stats?.overview.totalPlaces || 0} gradient="linear-gradient(135deg, #EC4899, #DB2777)" /></Grid>
        <Grid item xs={6} md={4} lg={2}><StatCard icon={<Speed />} label="Tắc nghẽn" value={`${traffic?.congestionIndex || 0}%`} gradient={`linear-gradient(135deg, ${cColor}, ${cColor}CC)`} sub={`TB: ${traffic?.averageSpeed || 0} km/h`} /></Grid>

        {/* LINE CHART */}
        <Grid item xs={12} md={8}>
          <GlassCard sx={{ height: '100%' }}>
            <Typography fontWeight={600} mb={2}>📈 Xu hướng sự cố (30 ngày)</Typography>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                <RTooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="Sự cố" stroke="#6C63FF" strokeWidth={2.5} dot={{ r: 3, fill: '#6C63FF' }} activeDot={{ r: 6, fill: '#6C63FF', stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </GlassCard>
        </Grid>

        {/* PIE CHART */}
        <Grid item xs={12} md={4}>
          <GlassCard sx={{ height: '100%' }}>
            <Typography fontWeight={600} mb={2}>🍩 Trạng thái sự cố</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3} strokeWidth={0}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <RTooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <Stack spacing={0.5} mt={1}>
              {pieData.map((p, i) => (
                <Stack key={i} direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: p.color }} />
                    <Typography variant="caption">{p.name}</Typography>
                  </Stack>
                  <Typography variant="caption" fontWeight={600}>{p.value}</Typography>
                </Stack>
              ))}
            </Stack>
          </GlassCard>
        </Grid>

        {/* BAR CHART */}
        <Grid item xs={12} md={12}>
          <GlassCard>
            <Typography fontWeight={600} mb={2}>📊 Phân loại sự cố</Typography>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} width={80} />
                <RTooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Số lượng" radius={[0, 6, 6, 0]} barSize={20}>
                  {barData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </Grid>

        {/* TRAFFIC DASHBOARD */}
        <Grid item xs={12}>
          {traffic ? <TrafficDashboard traffic={traffic} /> : (
            <GlassCard><Typography color="text.secondary">Đang tải dữ liệu giao thông...</Typography></GlassCard>
          )}
        </Grid>

        {/* ═══ ISSUE MANAGEMENT ═══ */}
        <Grid item xs={12}>
          <IssueManagement onDataChange={refreshStats} />
        </Grid>

        {/* TOP VOTED ISSUES */}
        {allIssues.some(i => (i.voteCount || 0) > 0) && (
          <Grid item xs={12}>
            <GlassCard>
              <Typography fontWeight={600} mb={2}>🔥 Sự cố quan trọng nhất (theo vote)</Typography>
              <Stack spacing={1}>
                {allIssues
                  .filter(i => (i.voteCount || 0) > 0)
                  .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
                  .slice(0, 5)
                  .map((issue, i) => (
                    <Stack key={issue._id} direction="row" alignItems="center" spacing={2}
                      sx={{ p: 1.5, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <Typography fontWeight={700} color="primary.main" fontSize={18} sx={{ minWidth: 28 }}>
                        #{i + 1}
                      </Typography>
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={600} fontSize={14}>{issue.title}</Typography>
                        <Typography variant="caption" color="text.secondary">{issue.location}</Typography>
                      </Box>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <ThumbUp sx={{ fontSize: 16, color: '#F59E0B' }} />
                        <Typography fontWeight={700} color="#F59E0B">{issue.voteCount || 0}</Typography>
                      </Stack>
                      <Chip label={STATUS_LABELS[issue.status] || issue.status} size="small"
                        sx={{ bgcolor: `${STATUS_COLORS[issue.status]}20`, color: STATUS_COLORS[issue.status], fontWeight: 600, fontSize: '0.7rem' }} />
                    </Stack>
                  ))}
              </Stack>
            </GlassCard>
          </Grid>
        )}
        {/* ═══ USER MANAGEMENT ═══ */}
        <Grid item xs={12}>
          <UserManagement onDataChange={refreshStats} />
        </Grid>

        {/* ═══ PLACE MANAGEMENT ═══ */}
        <Grid item xs={12}>
          <PlaceManagement onDataChange={refreshStats} />
        </Grid>

        {/* ENVIRONMENT HISTORY CHART */}
        <Grid item xs={12}>
          <EnvironmentHistoryChart GlassCard={GlassCard} ChartTooltip={ChartTooltip} />
        </Grid>

        {/* DISTRICT STATISTICS */}
        {districtData.length > 0 && (
          <Grid item xs={12} md={6}>
            <GlassCard>
              <Typography fontWeight={600} mb={2}>🏙️ Sự cố theo quận</Typography>
              <ResponsiveContainer width="100%" height={395}>
                <BarChart data={districtData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} width={100} />
                  <RTooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Số sự cố" radius={[0, 6, 6, 0]} barSize={20}>
                    {districtData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </Grid>
        )}

        {/* ENVIRONMENT CURRENT */}
        <Grid item xs={12} md={districtData.length > 0 ? 6 : 12}>
          <GlassCard>
            <Typography fontWeight={600} mb={2}>🌡️ Môi trường các khu vực</Typography>
            <Grid container spacing={1.5}>
              {envData.length > 0 ? envData.map((env, i) => (
                <Grid item xs={12} sm={6} md={4} lg key={i}>
                  <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                    <Typography variant="body2" fontWeight={600} mb={0.5}>{env.location}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>{env.weatherCondition}</Typography>
                    <Stack direction="row" justifyContent="center" spacing={3}>
                      <Stack direction="row" alignItems="center" spacing={0.5}><Thermostat sx={{ fontSize: 18, color: '#F59E0B' }} /><Typography variant="h6" fontWeight={700}>{env.temperature}°C</Typography></Stack>
                      <Stack direction="row" alignItems="center" spacing={0.5}><WaterDrop sx={{ fontSize: 18, color: '#3B82F6' }} /><Typography variant="h6" fontWeight={700}>{env.humidity}%</Typography></Stack>
                    </Stack>
                  </Box>
                </Grid>
              )) : <Grid item xs={12}><Typography variant="body2" color="text.secondary">Không có dữ liệu</Typography></Grid>}
            </Grid>
          </GlassCard>
        </Grid>


      </Grid>
    </Box>
  );
};

export default AdminDashboard;
