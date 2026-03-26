import React, { useState } from 'react';
import {
  Box, Typography, Stack, Chip, Grid, LinearProgress,
  ToggleButton, ToggleButtonGroup, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tooltip,
} from '@mui/material';
import {
  Speed, TrendingUp, TrendingDown, DirectionsCar,
} from '@mui/icons-material';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrafficStats, TrafficRoad, GlassCard, ChartTooltip,
  TRAFFIC_LEVEL_COLORS, TRAFFIC_LEVEL_LABELS,
} from './types';

interface Props {
  traffic: TrafficStats;
}

type ViewMode = 'overview' | 'roads';

const TrafficDashboard: React.FC<Props> = ({ traffic }) => {
  const [view, setView] = useState<ViewMode>('overview');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  const congestionColor = traffic.congestionIndex > 60 ? '#EF4444' : traffic.congestionIndex > 35 ? '#F97316' : traffic.congestionIndex > 15 ? '#F59E0B' : '#10B981';

  // Pie chart data
  const pieData = Object.entries(traffic.summary).map(([key, value]) => ({
    name: TRAFFIC_LEVEL_LABELS[key] || key,
    value,
    color: TRAFFIC_LEVEL_COLORS[key] || '#666',
  }));

  // Speed comparison bar chart (worst roads)
  const speedChartData = traffic.worstRoads.slice(0, 5).map((r) => ({
    name: r.name.replace('Đường ', '').substring(0, 18),
    'Tốc độ hiện tại': r.currentSpeed,
    'Tốc độ tự do': r.freeFlowSpeed,
    level: r.level,
  }));

  // All roads filtered
  const filteredRoads = (traffic.roads || []).filter(
    (r) => levelFilter === 'all' || r.level === levelFilter
  );

  const getRoadIcon = (level: string) => {
    switch (level) {
      case 'heavy': return '🔴';
      case 'congested': return '🟠';
      case 'slow': return '🟡';
      default: return '🟢';
    }
  };

  return (
    <GlassCard>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5} flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <DirectionsCar sx={{ color: '#3B82F6' }} />
          <Typography fontWeight={700} fontSize="1.1rem">🚗 Giao thông Đà Nẵng</Typography>
          <Chip size="small" label={`${traffic.totalRoads} tuyến đường`}
            sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#60A5FA', fontWeight: 600 }} />
        </Stack>
        <ToggleButtonGroup value={view} exclusive onChange={(_, v) => v && setView(v)} size="small">
          <ToggleButton value="overview" sx={{ fontSize: '0.75rem', px: 1.5, borderRadius: '8px !important', border: '1px solid rgba(255,255,255,0.1) !important' }}>
            Tổng quan
          </ToggleButton>
          <ToggleButton value="roads" sx={{ fontSize: '0.75rem', px: 1.5, borderRadius: '8px !important', border: '1px solid rgba(255,255,255,0.1) !important' }}>
            Chi tiết đường
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {view === 'overview' ? (
        <>
          {/* ═══ STATS ROW ═══ */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.03)' }}>
                <Typography variant="h3" fontWeight={800} sx={{ color: congestionColor, lineHeight: 1.2 }}>
                  {traffic.congestionIndex}%
                </Typography>
                <Typography variant="caption" color="text.secondary">Chỉ số tắc nghẽn</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.03)' }}>
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                  <Speed sx={{ color: '#3B82F6', fontSize: 20 }} />
                  <Typography variant="h4" fontWeight={700}>{traffic.averageSpeed}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">TB km/h</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.03)' }}>
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                  <TrendingDown sx={{ color: '#EF4444', fontSize: 20 }} />
                  <Typography variant="h4" fontWeight={700}>{traffic.summary.heavy || 0}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">Đường kẹt cứng</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.03)' }}>
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                  <TrendingUp sx={{ color: '#10B981', fontSize: 20 }} />
                  <Typography variant="h4" fontWeight={700}>{traffic.summary.normal || 0}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">Đường thông thoáng</Typography>
              </Box>
            </Grid>
          </Grid>

          {/* ═══ CHARTS ═══ */}
          <Grid container spacing={2.5} mb={2.5}>
            {/* Pie Chart - Phân bổ tình trạng */}
            <Grid item xs={12} md={5}>
              <Typography variant="body2" fontWeight={600} mb={1.5} color="text.secondary">
                📊 Phân bổ tình trạng giao thông
              </Typography>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <RTooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
                </PieChart>
              </ResponsiveContainer>
              {/* Progress bars */}
              <Stack spacing={1} mt={1}>
                {Object.entries(traffic.summary).map(([level, count]) => {
                  const pct = traffic.totalRoads > 0 ? Math.round((count / traffic.totalRoads) * 100) : 0;
                  return (
                    <Stack key={level} direction="row" alignItems="center" spacing={1}>
                      <Typography variant="caption" sx={{ width: 85, color: TRAFFIC_LEVEL_COLORS[level], fontWeight: 600 }}>
                        {TRAFFIC_LEVEL_LABELS[level]}
                      </Typography>
                      <LinearProgress variant="determinate" value={pct}
                        sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.05)',
                          '& .MuiLinearProgress-bar': { bgcolor: TRAFFIC_LEVEL_COLORS[level], borderRadius: 3 } }} />
                      <Typography variant="caption" fontWeight={600} sx={{ width: 50, textAlign: 'right' }}>
                        {count} ({pct}%)
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </Grid>

            {/* Bar Chart - So sánh tốc độ */}
            <Grid item xs={12} md={7}>
              <Typography variant="body2" fontWeight={600} mb={1.5} color="text.secondary">
                🔴 Top đường kẹt nhất — So sánh tốc độ
              </Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={speedChartData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 10 }} unit=" km/h" />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 10 }} width={100} />
                  <RTooltip content={<ChartTooltip />} />
                  <Bar dataKey="Tốc độ hiện tại" fill="#EF4444" radius={[0, 4, 4, 0]} barSize={10} />
                  <Bar dataKey="Tốc độ tự do" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={10} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </Grid>
          </Grid>

          {/* ═══ BEST & WORST ROADS ═══ */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" fontWeight={600} mb={1} color="text.secondary">🔴 Đường kẹt nhất</Typography>
              <Stack spacing={0.5}>
                {traffic.worstRoads.slice(0, 5).map((r, i) => (
                  <RoadRow key={i} road={r} index={i + 1} />
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" fontWeight={600} mb={1} color="text.secondary">🟢 Đường thông thoáng nhất</Typography>
              <Stack spacing={0.5}>
                {(traffic.bestRoads || []).slice(0, 5).map((r, i) => (
                  <RoadRow key={i} road={r} index={i + 1} />
                ))}
              </Stack>
            </Grid>
          </Grid>
        </>
      ) : (
        /* ═══ ROADS TABLE VIEW ═══ */
        <>
          <Stack direction="row" spacing={0.5} mb={2} flexWrap="wrap" gap={0.5}>
            <Chip label="Tất cả" size="small"
              onClick={() => setLevelFilter('all')}
              sx={{ fontSize: '0.7rem', fontWeight: levelFilter === 'all' ? 700 : 400,
                bgcolor: levelFilter === 'all' ? 'primary.main' : 'rgba(255,255,255,0.05)',
                color: levelFilter === 'all' ? '#fff' : 'text.secondary' }} />
            {Object.entries(TRAFFIC_LEVEL_LABELS).map(([key, label]) => (
              <Chip key={key} label={`${getRoadIcon(key)} ${label}`} size="small"
                onClick={() => setLevelFilter(key)}
                sx={{ fontSize: '0.7rem', fontWeight: levelFilter === key ? 700 : 400,
                  bgcolor: levelFilter === key ? TRAFFIC_LEVEL_COLORS[key] : 'rgba(255,255,255,0.05)',
                  color: levelFilter === key ? '#fff' : 'text.secondary' }} />
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1, alignSelf: 'center' }}>
              Hiển thị: {filteredRoads.length} / {traffic.roads?.length || 0} đường
            </Typography>
          </Stack>

          <TableContainer sx={{ maxHeight: 420, '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 } }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: 'rgba(17,24,39,0.95)', color: '#9CA3AF', fontWeight: 600 }}>#</TableCell>
                  <TableCell sx={{ bgcolor: 'rgba(17,24,39,0.95)', color: '#9CA3AF', fontWeight: 600 }}>Tên đường</TableCell>
                  <TableCell sx={{ bgcolor: 'rgba(17,24,39,0.95)', color: '#9CA3AF', fontWeight: 600 }} align="center">Tốc độ</TableCell>
                  <TableCell sx={{ bgcolor: 'rgba(17,24,39,0.95)', color: '#9CA3AF', fontWeight: 600 }} align="center">Tốc độ tự do</TableCell>
                  <TableCell sx={{ bgcolor: 'rgba(17,24,39,0.95)', color: '#9CA3AF', fontWeight: 600 }} align="center">Tỷ lệ</TableCell>
                  <TableCell sx={{ bgcolor: 'rgba(17,24,39,0.95)', color: '#9CA3AF', fontWeight: 600 }} align="center">Trạng thái</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRoads.map((road, i) => {
                  const ratio = road.freeFlowSpeed > 0 ? Math.round((road.currentSpeed / road.freeFlowSpeed) * 100) : 0;
                  return (
                    <TableRow key={i} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.04)', color: '#9CA3AF' }}>{i + 1}</TableCell>
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                        <Typography variant="body2" fontWeight={500}>{road.name}</Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                        <Typography variant="body2" fontWeight={700} sx={{ color: TRAFFIC_LEVEL_COLORS[road.level] }}>
                          {road.currentSpeed} km/h
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ borderColor: 'rgba(255,255,255,0.04)', color: '#9CA3AF' }}>
                        {road.freeFlowSpeed} km/h
                      </TableCell>
                      <TableCell align="center" sx={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                        <Tooltip title={`${ratio}% so với tốc độ tự do`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                            <LinearProgress variant="determinate" value={ratio}
                              sx={{ width: 50, height: 5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.08)',
                                '& .MuiLinearProgress-bar': { bgcolor: TRAFFIC_LEVEL_COLORS[road.level], borderRadius: 3 } }} />
                            <Typography variant="caption" fontWeight={600}>{ratio}%</Typography>
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center" sx={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                        <Chip size="small"
                          label={`${getRoadIcon(road.level)} ${TRAFFIC_LEVEL_LABELS[road.level]}`}
                          sx={{ height: 22, fontSize: '0.65rem', fontWeight: 600,
                            bgcolor: `${TRAFFIC_LEVEL_COLORS[road.level]}20`,
                            color: TRAFFIC_LEVEL_COLORS[road.level],
                            border: `1px solid ${TRAFFIC_LEVEL_COLORS[road.level]}40` }} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </GlassCard>
  );
};

// Road row sub-component
const RoadRow: React.FC<{ road: TrafficRoad; index: number }> = ({ road, index }) => {
  const ratio = road.freeFlowSpeed > 0 ? Math.round((road.currentSpeed / road.freeFlowSpeed) * 100) : 0;
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between"
      sx={{ py: 0.8, px: 1.5, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.03)',
        transition: 'all 0.2s', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, width: 18 }}>{index}</Typography>
        <Typography variant="body2" fontWeight={500} noWrap>{road.name}</Typography>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="caption" sx={{ color: TRAFFIC_LEVEL_COLORS[road.level], fontWeight: 700 }}>
          {road.currentSpeed}/{road.freeFlowSpeed}
        </Typography>
        <Chip size="small" label={`${ratio}%`}
          sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700,
            bgcolor: TRAFFIC_LEVEL_COLORS[road.level], color: '#fff', minWidth: 42 }} />
      </Stack>
    </Stack>
  );
};

export default TrafficDashboard;
