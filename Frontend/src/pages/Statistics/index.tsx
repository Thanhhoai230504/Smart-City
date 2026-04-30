import React, { useEffect, useState } from 'react';
import {
  Box, Container, Typography, Grid, Card, CardContent, Stack,
  LinearProgress, Skeleton, Rating,
} from '@mui/material';
import {
  TrendingUp, CheckCircle, AccessTime, Star,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import { statisticsApi } from '../../api/statisticsApi';
import { CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';

interface DistrictStat { district: string; total: number; resolved: number; rate: number; }

interface StatsData {
  overview: { totalIssues: number; resolvedCount: number; resolutionRate: number; avgResolutionHours: number; };
  issuesByStatus: Record<string, number>;
  issuesByCategory: { category: string; label: string; count: number }[];
  issuesTrend: { date: string; count: number }[];
  issuesByDistrict: DistrictStat[];
  rating: { average: number; total: number; distribution: Record<number, number> };
}

const STAT_COLORS = ['#0EA5E9', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const StatisticsPage: React.FC = () => {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await statisticsApi.getPublicStatistics();
        setData(res.data.data);
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Skeleton variant="text" width={300} height={50} />
        <Grid container spacing={3} mt={1}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rounded" height={120} sx={{ borderRadius: '16px' }} />
            </Grid>
          ))}
          <Grid item xs={12} md={8}><Skeleton variant="rounded" height={350} sx={{ borderRadius: '16px' }} /></Grid>
          <Grid item xs={12} md={4}><Skeleton variant="rounded" height={350} sx={{ borderRadius: '16px' }} /></Grid>
        </Grid>
      </Container>
    );
  }

  if (!data) return null;

  const statusData = Object.entries(data.issuesByStatus).map(([key, value]) => ({
    name: STATUS_MAP[key]?.label || key,
    value,
    color: STATUS_MAP[key]?.color || '#6B7280',
  }));

  const trendData = data.issuesTrend.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
  }));

  const maxDistrict = Math.max(...data.issuesByDistrict.map(d => d.total), 1);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" fontWeight={700} mb={1}>
          📊 Thống kê sự cố đô thị
        </Typography>
        <Typography color="text.secondary">
          Dữ liệu công khai về tình hình sự cố tại thành phố Đà Nẵng — cập nhật realtime
        </Typography>
      </Box>

      {/* Overview cards */}
      <Grid container spacing={3} mb={4}>
        {[
          { label: 'Tổng sự cố', value: data.overview.totalIssues, icon: <TrendingUp />, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
          { label: 'Đã xử lý', value: data.overview.resolvedCount, icon: <CheckCircle />, color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
          { label: 'Tỷ lệ xử lý', value: `${data.overview.resolutionRate}%`, icon: <TrendingUp />, color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
          { label: 'TB thời gian xử lý', value: `${data.overview.avgResolutionHours}h`, icon: <AccessTime />, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
        ].map((card, i) => (
          <Grid item xs={6} md={3} key={i}>
            <Card sx={{
              background: `linear-gradient(135deg, ${card.bg}, transparent)`,
              border: `1px solid ${card.color}20`,
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-4px)' },
            }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Box sx={{ p: 1, borderRadius: '10px', bgcolor: `${card.color}15`, color: card.color }}>
                    {card.icon}
                  </Box>
                </Stack>
                <Typography variant="h4" fontWeight={800} color={card.color}>{card.value}</Typography>
                <Typography variant="body2" color="text.secondary">{card.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Charts row 1: Trend + Pie */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography fontWeight={600} mb={2}>📈 Xu hướng báo cáo (30 ngày)</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#1A2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                    labelStyle={{ color: '#F1F5F9' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#0EA5E9" fill="url(#trendGrad)" strokeWidth={2} name="Sự cố" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography fontWeight={600} mb={2}>🎯 Theo trạng thái</Typography>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1A2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                  <Legend formatter={(value) => <span style={{ color: '#9CA3AF', fontSize: 12 }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts row 2: Category + District */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography fontWeight={600} mb={2}>📂 Theo danh mục</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.issuesByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" tick={{ fill: '#E2E8F0', fontSize: 12 }} width={120} />
                  <Tooltip contentStyle={{ background: '#1A2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                  <Bar dataKey="count" name="Số lượng" radius={[0, 6, 6, 0]}>
                    {data.issuesByCategory.map((entry, i) => (
                      <Cell key={i} fill={CATEGORY_MAP[entry.category]?.color || STAT_COLORS[i % STAT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography fontWeight={600} mb={2}>📍 Theo quận/huyện</Typography>
              <Stack spacing={1.5}>
                {data.issuesByDistrict.map((d, i) => (
                  <Box key={d.district}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="body2" fontWeight={500}>{d.district}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          {d.resolved}/{d.total} đã xử lý
                        </Typography>
                        <Typography variant="caption" fontWeight={600}
                          color={d.rate >= 70 ? '#10B981' : d.rate >= 40 ? '#F59E0B' : '#EF4444'}>
                          {d.rate}%
                        </Typography>
                      </Stack>
                    </Stack>
                    <Box sx={{ position: 'relative' }}>
                      <LinearProgress
                        variant="determinate"
                        value={(d.total / maxDistrict) * 100}
                        sx={{
                          height: 8, borderRadius: 4,
                          bgcolor: 'rgba(255,255,255,0.06)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 4,
                            background: `linear-gradient(90deg, ${STAT_COLORS[i % STAT_COLORS.length]}, ${STAT_COLORS[(i + 1) % STAT_COLORS.length]})`,
                          },
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Rating summary */}
      {data.rating.total > 0 && (
        <Card sx={{ bgcolor: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <CardContent>
            <Typography fontWeight={600} mb={2}>⭐ Đánh giá chất lượng xử lý</Typography>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} sm={4} textAlign="center">
                <Typography variant="h2" fontWeight={800} color="#F59E0B">
                  {data.rating.average}
                </Typography>
                <Rating value={data.rating.average} readOnly precision={0.1}
                  sx={{ '& .MuiRating-iconFilled': { color: '#F59E0B' }, fontSize: '1.8rem' }} />
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  {data.rating.total} đánh giá
                </Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Stack spacing={1}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = data.rating.distribution[star] || 0;
                    const pct = data.rating.total > 0 ? (count / data.rating.total) * 100 : 0;
                    return (
                      <Stack key={star} direction="row" alignItems="center" spacing={1.5}>
                        <Typography variant="body2" fontWeight={500} sx={{ minWidth: 20 }}>{star}⭐</Typography>
                        <LinearProgress
                          variant="determinate" value={pct}
                          sx={{
                            flex: 1, height: 8, borderRadius: 4,
                            bgcolor: 'rgba(255,255,255,0.06)',
                            '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: '#F59E0B' },
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 30 }}>{count}</Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Footer note */}
      <Box textAlign="center" mt={4}>
        <Typography variant="caption" color="text.secondary">
          Dữ liệu thống kê từ hệ thống Smart City Đà Nẵng • Cập nhật theo thời gian thực
        </Typography>
      </Box>
    </Container>
  );
};

export default StatisticsPage;
