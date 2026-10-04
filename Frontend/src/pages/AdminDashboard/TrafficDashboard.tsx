import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { PlaceOutlined } from '@mui/icons-material';
import {
  GlassCard,
  TRAFFIC_LEVEL_COLORS,
  TRAFFIC_LEVEL_LABELS,
  TrafficRoad,
  TrafficStats,
} from './types';

interface Props {
  traffic: TrafficStats;
}

type ViewMode = 'overview' | 'roads';

const getRoadRatio = (road: TrafficRoad) => (
  road.freeFlowSpeed > 0
    ? Math.round((road.currentSpeed / road.freeFlowSpeed) * 100)
    : 0
);

const TrafficStatus: React.FC<{ level: string }> = ({ level }) => (
  <Stack direction="row" spacing={0.75} alignItems="center">
    <Box
      sx={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        bgcolor: TRAFFIC_LEVEL_COLORS[level] || '#6B7280',
      }}
    />
    <Typography variant="body2" color="text.secondary" whiteSpace="nowrap">
      {TRAFFIC_LEVEL_LABELS[level] || level}
    </Typography>
  </Stack>
);

/**
 * Tên tuyến + nút xem điểm đo trên bản đồ + ghi chú riêng của số liệu tuyến đó.
 * Trước đây cột này là địa chỉ tra ngược quanh điểm đo ("Trà chanh …", "Kiệt
 * 372 …") và không có cách nào biết số liệu đo ở đâu.
 */
const RoadName: React.FC<{ road: TrafficRoad; noWrap?: boolean }> = ({ road, noWrap = false }) => {
  const mapHref = road.lat != null && road.lon != null
    ? `https://www.google.com/maps/search/?api=1&query=${road.lat},${road.lon}`
    : null;
  const shared = road.sharedWith || [];
  return (
    <Box minWidth={0}>
      <Stack direction="row" spacing={0.25} alignItems="center" minWidth={0}>
        <Typography variant="body2" fontWeight={600} noWrap={noWrap}>{road.name}</Typography>
        {mapHref && (
          <Tooltip title="Xem điểm đo trên bản đồ">
            <IconButton
              size="small"
              component="a"
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Xem điểm đo ${road.name} trên bản đồ`}
              sx={{ p: 0.25, color: 'text.secondary' }}
            >
              <PlaceOutlined sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      {road.live === false && !road.closed && (
        <Typography variant="caption" color="text.secondary" display="block">
          Ước tính — chưa có xe dữ liệu trực tiếp
        </Typography>
      )}
      {shared.length > 0 && (
        <Typography variant="caption" color="text.secondary" display="block">
          Cùng đoạn đo với {shared.join(', ')}
        </Typography>
      )}
    </Box>
  );
};

const TrafficDashboard: React.FC<Props> = ({ traffic }) => {
  const [view, setView] = useState<ViewMode>('overview');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const isMock = traffic.source === 'mock';
  const measured = traffic.measuredSegments ?? traffic.totalRoads;
  const updatedAt = traffic.lastUpdated
    ? new Date(traffic.lastUpdated).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : null;

  const congestionColor = traffic.congestionIndex > 60
    ? '#C62828'
    : traffic.congestionIndex > 35
      ? '#B26A00'
      : traffic.congestionIndex > 15
        ? '#B26A00'
        : '#2F7D64';

  // Tỷ trọng tính trên số đoạn được xếp mức (mỗi đoạn một lần, bỏ đoạn chỉ có
  // số ước tính) — chia cho tổng số tuyến thì các thanh không cộng lại 100%.
  const trafficLevels = useMemo(() => {
    const counted = Object.values(traffic.summary).reduce((sum, value) => sum + value, 0);
    return Object.entries(traffic.summary)
      .filter(([key, value]) => key !== 'closed' || value > 0)
      .map(([key, value]) => ({
        key,
        label: TRAFFIC_LEVEL_LABELS[key] || key,
        value,
        color: TRAFFIC_LEVEL_COLORS[key] || '#6B7280',
        percentage: counted > 0 ? Math.round((value / counted) * 100) : 0,
      }));
  }, [traffic.summary]);

  const filteredRoads = (traffic.roads || []).filter(
    (road) => levelFilter === 'all' || road.level === levelFilter,
  );

  const summaryItems = [
    {
      label: 'Chỉ số tắc nghẽn',
      value: `${traffic.congestionIndex}%`,
      note: 'thời gian đi lại tăng so với lúc thông thoáng',
      color: congestionColor,
    },
    {
      label: 'Tốc độ trung bình',
      value: `${traffic.averageSpeed} km/h`,
      note: `trên ${measured} đoạn có dữ liệu trực tiếp`,
      color: '#172B3A',
    },
    {
      label: 'Kẹt cứng',
      value: traffic.summary.heavy || 0,
      note: 'tuyến cần ưu tiên',
      color: (traffic.summary.heavy || 0) > 0 ? '#C62828' : '#172B3A',
    },
    {
      label: 'Thông thoáng',
      value: traffic.summary.normal || 0,
      note: 'tuyến vận hành ổn định',
      color: '#2F7D64',
    },
  ];

  return (
    <GlassCard sx={{ p: 0, overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={1.5}
        sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Box>
          <Typography variant="h6" component="h2">Tình hình giao thông</Typography>
          <Typography variant="caption" color="text.secondary">
            {isMock
              ? 'Dữ liệu mẫu'
              : `Nguồn TomTom${updatedAt ? ` · cập nhật ${updatedAt}` : ''} · ${traffic.totalRoads} tuyến chính, ${measured} đoạn có dữ liệu trực tiếp`}
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_, nextView) => nextView && setView(nextView)}
          size="small"
          aria-label="Chế độ xem giao thông"
        >
          <ToggleButton value="overview" sx={{ px: 1.75, textTransform: 'none' }}>
            Tổng quan
          </ToggleButton>
          <ToggleButton value="roads" sx={{ px: 1.75, textTransform: 'none' }}>
            Chi tiết tuyến
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {isMock && (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          Server chưa cấu hình TOMTOM_API_KEY nên đây là dữ liệu mẫu, không phải tình hình giao thông thật.
        </Alert>
      )}

      {view === 'overview' ? (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            {summaryItems.map((item) => (
              <Box
                key={item.label}
                sx={{
                  p: 2.25,
                  borderRight: '1px solid',
                  borderBottom: { xs: '1px solid', md: 0 },
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                <Typography variant="h5" component="p" color={item.color} my={0.25}>
                  {item.value}
                </Typography>
                <Typography variant="caption" color="text.disabled">{item.note}</Typography>
              </Box>
            ))}
          </Box>

          <Grid container>
            <Grid
              item
              xs={12}
              md={5}
              sx={{
                p: 2.5,
                borderRight: { md: '1px solid #D8E1E7' },
                borderBottom: { xs: '1px solid #D8E1E7', md: 0 },
              }}
            >
              <Typography variant="body2" fontWeight={700} mb={0.25}>
                Phân bố trạng thái
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Tỷ trọng các tuyến theo mức độ lưu thông
              </Typography>

              <Stack spacing={1.8} mt={2.25}>
                {trafficLevels.map((item) => (
                  <Box key={item.key}>
                    <Stack direction="row" justifyContent="space-between" mb={0.65}>
                      <Stack direction="row" spacing={0.8} alignItems="center">
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: item.color }} />
                        <Typography variant="body2">{item.label}</Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={700}>
                        {item.value}
                        <Typography component="span" variant="caption" color="text.secondary" ml={0.65}>
                          {item.percentage}%
                        </Typography>
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={item.percentage}
                      sx={{
                        height: 5,
                        bgcolor: '#E8EDF0',
                        '& .MuiLinearProgress-bar': { bgcolor: item.color },
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            </Grid>

            <Grid item xs={12} md={7}>
              <Box sx={{ px: 2.5, pt: 2.5, pb: 1.25 }}>
                <Typography variant="body2" fontWeight={700}>Tuyến cần chú ý</Typography>
                <Typography variant="caption" color="text.secondary">
                  Các tuyến có tốc độ thấp nhất so với điều kiện thông thoáng
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small" aria-label="Các tuyến đường cần chú ý">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>Tuyến đường</TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>Hiện tại (km/h)</TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>Thông thoáng (km/h)</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>Hiệu suất</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {traffic.worstRoads.slice(0, 5).map((road) => {
                      const ratio = getRoadRatio(road);
                      return (
                        <TableRow key={road.name} hover>
                          <TableCell sx={{ maxWidth: 260 }}>
                            <RoadName road={road} noWrap />
                            <TrafficStatus level={road.level} />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={700} color={TRAFFIC_LEVEL_COLORS[road.level]}>
                              {road.currentSpeed}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="text.secondary">{road.freeFlowSpeed}</Typography>
                          </TableCell>
                          <TableCell sx={{ minWidth: 110 }}>
                            <Stack direction="row" alignItems="center" spacing={0.8}>
                              <LinearProgress
                                variant="determinate"
                                value={ratio}
                                sx={{
                                  flex: 1,
                                  height: 5,
                                  bgcolor: '#E8EDF0',
                                  '& .MuiLinearProgress-bar': {
                                    bgcolor: TRAFFIC_LEVEL_COLORS[road.level],
                                  },
                                }}
                              />
                              <Typography variant="caption" fontWeight={700}>{ratio}%</Typography>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </>
      ) : (
        <Box>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Button
              size="small"
              variant={levelFilter === 'all' ? 'contained' : 'text'}
              onClick={() => setLevelFilter('all')}
            >
              Tất cả
            </Button>
            {Object.entries(TRAFFIC_LEVEL_LABELS).map(([key, label]) => (
              <Button
                key={key}
                size="small"
                variant={levelFilter === key ? 'outlined' : 'text'}
                onClick={() => setLevelFilter(key)}
                startIcon={(
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      bgcolor: TRAFFIC_LEVEL_COLORS[key],
                    }}
                  />
                )}
              >
                {label}
              </Button>
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ ml: { sm: 'auto' } }}>
              {filteredRoads.length}/{traffic.roads?.length || 0} tuyến
            </Typography>
          </Stack>

          <TableContainer sx={{ maxHeight: 460 }}>
            <Table size="small" stickyHeader aria-label="Chi tiết tình hình các tuyến đường">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: '#F2F5F7', color: 'text.secondary', fontWeight: 700 }}>#</TableCell>
                  <TableCell sx={{ bgcolor: '#F2F5F7', color: 'text.secondary', fontWeight: 700 }}>Tên đường</TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#F2F5F7', color: 'text.secondary', fontWeight: 700 }}>Tốc độ</TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#F2F5F7', color: 'text.secondary', fontWeight: 700 }}>Tốc độ thông thoáng</TableCell>
                  <TableCell sx={{ bgcolor: '#F2F5F7', color: 'text.secondary', fontWeight: 700 }}>Hiệu suất</TableCell>
                  <TableCell sx={{ bgcolor: '#F2F5F7', color: 'text.secondary', fontWeight: 700 }}>Trạng thái</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRoads.map((road, index) => {
                  const ratio = getRoadRatio(road);
                  return (
                    <TableRow key={`${road.name}-${index}`} hover>
                      <TableCell sx={{ color: 'text.secondary' }}>{index + 1}</TableCell>
                      <TableCell>
                        <RoadName road={road} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700} color={TRAFFIC_LEVEL_COLORS[road.level]}>
                          {road.currentSpeed} km/h
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">{road.freeFlowSpeed} km/h</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 135 }}>
                        <Tooltip title={`${ratio}% so với tốc độ tự do`}>
                          <Stack direction="row" alignItems="center" spacing={0.8}>
                            <LinearProgress
                              variant="determinate"
                              value={ratio}
                              sx={{
                                width: 70,
                                height: 5,
                                bgcolor: '#E8EDF0',
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: TRAFFIC_LEVEL_COLORS[road.level],
                                },
                              }}
                            />
                            <Typography variant="caption" fontWeight={700}>{ratio}%</Typography>
                          </Stack>
                        </Tooltip>
                      </TableCell>
                      <TableCell><TrafficStatus level={road.level} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      <Typography
        variant="caption"
        color="text.secondary"
        component="p"
        sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
      >
        Tốc độ đo tại một điểm giữa mỗi tuyến. Hiệu suất = tốc độ hiện tại ÷ tốc độ khi đường thông thoáng.
        Chỉ số tắc nghẽn và tốc độ trung bình chỉ tính các đoạn có dữ liệu trực tiếp, mỗi đoạn một lần.
      </Typography>
    </GlassCard>
  );
};

export default TrafficDashboard;
