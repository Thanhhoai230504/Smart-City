import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  SelectChangeEvent,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AccessTime,
  Business,
  CheckCircle,
  Groups,
  Refresh,
  Star,
  TaskAlt,
  WarningAmber,
} from '@mui/icons-material';
import { departmentApi } from '../../api/departmentApi';
import { DepartmentStat } from '../../types';
import { cellSx, GlassCard, headCellSx } from './types';

interface ApiErrorResponse {
  message?: string;
}

type UnitFilter = 'all' | 'active' | 'inactive';
type RateColor = 'success' | 'warning' | 'error';

const numberFormatter = new Intl.NumberFormat('vi-VN');

const getErrorMessage = (error: unknown) => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return 'Không thể tải bảng hiệu suất đơn vị.';
  }
  return error.response?.data?.message || 'Không thể tải bảng hiệu suất đơn vị.';
};

const getRateColor = (rate: number): RateColor => {
  if (rate >= 80) return 'success';
  if (rate >= 60) return 'warning';
  return 'error';
};

const formatHours = (hours: number | null) => {
  if (hours === null) return 'Chưa có dữ liệu';
  return `${hours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ`;
};

const SummaryCard: React.FC<{
  icon: React.ReactElement;
  label: string;
  value: number;
  color: string;
  helper: string;
}> = ({ icon, label, value, color, helper }) => (
  <GlassCard sx={{ height: '100%', p: 2 }}>
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Avatar sx={{ bgcolor: `${color}1A`, color, width: 42, height: 42 }}>
        {icon}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={700} lineHeight={1.2}>
          {numberFormatter.format(value)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      </Box>
    </Stack>
  </GlassCard>
);

const DepartmentPerformance: React.FC = () => {
  const [stats, setStats] = useState<DepartmentStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('all');

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await departmentApi.getStats();
      setStats(data.data.stats);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const totals = useMemo(() => stats.reduce(
    (result, item) => ({
      activeUnits: result.activeUnits + (item.isActive ? 1 : 0),
      total: result.total + item.total,
      processing: result.processing + item.processing,
      resolved: result.resolved + item.resolved,
      overdue: result.overdue + item.overdue,
    }),
    { activeUnits: 0, total: 0, processing: 0, resolved: 0, overdue: 0 },
  ), [stats]);

  const visibleStats = useMemo(() => stats.filter((item) => {
    if (unitFilter === 'active') return item.isActive;
    if (unitFilter === 'inactive') return !item.isActive;
    return true;
  }), [stats, unitFilter]);

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Hiệu suất đơn vị
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Theo dõi khối lượng, tiến độ, SLA và chất lượng xử lý của từng đơn vị.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <FormControl size="small" sx={{ minWidth: 165 }}>
            <InputLabel id="department-performance-filter-label">Trạng thái đơn vị</InputLabel>
            <Select
              labelId="department-performance-filter-label"
              value={unitFilter}
              label="Trạng thái đơn vị"
              onChange={(event: SelectChangeEvent<UnitFilter>) => {
                setUnitFilter(event.target.value as UnitFilter);
              }}
            >
              <MenuItem value="all">Tất cả</MenuItem>
              <MenuItem value="active">Đang hoạt động</MenuItem>
              <MenuItem value="inactive">Đã vô hiệu hóa</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Tải lại số liệu">
            <span>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadStats}
                disabled={loading}
                sx={{ height: '100%' }}
              >
                Làm mới
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(5, minmax(0, 1fr))',
          },
          gap: 2,
        }}
      >
        <SummaryCard
          icon={<Business />}
          label="Đơn vị hoạt động"
          value={totals.activeUnits}
          color="#0EA5E9"
          helper={`${numberFormatter.format(stats.length)} đơn vị tổng cộng`}
        />
        <SummaryCard
          icon={<TaskAlt />}
          label="Tổng việc"
          value={totals.total}
          color="#8B5CF6"
          helper="Đã giao cho các đơn vị"
        />
        <SummaryCard
          icon={<Groups />}
          label="Đang xử lý"
          value={totals.processing}
          color="#3B82F6"
          helper="Gồm việc mới và đang làm"
        />
        <SummaryCard
          icon={<CheckCircle />}
          label="Đã hoàn tất"
          value={totals.resolved}
          color="#10B981"
          helper="Đã xử lý xong"
        />
        <SummaryCard
          icon={<WarningAmber />}
          label="Đang quá hạn"
          value={totals.overdue}
          color="#EF4444"
          helper="Việc mở đã quá SLA"
        />
      </Box>

      {error && (
        <Alert
          severity="error"
          action={(
            <Button color="inherit" size="small" onClick={loadStats}>
              Thử lại
            </Button>
          )}
        >
          {error}
        </Alert>
      )}

      <GlassCard sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={0.5}
            justifyContent="space-between"
          >
            <Typography variant="h6" fontWeight={700}>
              Bảng hiệu suất
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Hiển thị {visibleStats.length}/{stats.length} đơn vị
            </Typography>
          </Stack>
        </Box>

        <TableContainer>
          <Table sx={{ minWidth: 1120 }} aria-label="Bảng hiệu suất đơn vị">
            <TableHead>
              <TableRow>
                <TableCell sx={headCellSx}>Đơn vị</TableCell>
                <TableCell align="right" sx={headCellSx}>Cán bộ</TableCell>
                <TableCell align="right" sx={headCellSx}>Tổng việc</TableCell>
                <TableCell align="right" sx={headCellSx}>Đang xử lý</TableCell>
                <TableCell align="right" sx={headCellSx}>Đã xong</TableCell>
                <TableCell align="right" sx={headCellSx}>Quá hạn</TableCell>
                <TableCell sx={{ ...headCellSx, minWidth: 180 }}>Tỷ lệ đúng hạn</TableCell>
                <TableCell sx={{ ...headCellSx, minWidth: 145 }}>Xử lý TB</TableCell>
                <TableCell sx={{ ...headCellSx, minWidth: 145 }}>Đánh giá TB</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    {Array.from({ length: 9 }).map((__, cellIndex) => (
                      <TableCell key={cellIndex} sx={cellSx}>
                        <Skeleton height={28} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : visibleStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ ...cellSx, py: 7 }}>
                    <Business sx={{ fontSize: 42, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">
                      {stats.length === 0
                        ? 'Chưa có đơn vị nào để thống kê.'
                        : 'Không có đơn vị phù hợp với bộ lọc.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                visibleStats.map((item) => (
                  <TableRow
                    key={item.departmentId}
                    hover
                    sx={{ opacity: item.isActive ? 1 : 0.62 }}
                  >
                    <TableCell sx={cellSx}>
                      <Stack spacing={0.5}>
                        <Typography variant="body2" fontWeight={650}>
                          {item.name}
                        </Typography>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            {item.code}
                          </Typography>
                          <Chip
                            label={item.isActive ? 'Hoạt động' : 'Vô hiệu hóa'}
                            color={item.isActive ? 'success' : 'default'}
                            variant="outlined"
                            size="small"
                            sx={{ height: 20, fontSize: '0.68rem' }}
                          />
                        </Stack>
                      </Stack>
                    </TableCell>
                    <TableCell align="right" sx={cellSx}>
                      {numberFormatter.format(item.staffCount)}
                    </TableCell>
                    <TableCell align="right" sx={cellSx}>
                      <Typography variant="body2" fontWeight={700}>
                        {numberFormatter.format(item.total)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={cellSx}>
                      <Chip
                        label={numberFormatter.format(item.processing)}
                        color={item.processing > 0 ? 'info' : 'default'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right" sx={cellSx}>
                      <Chip
                        label={numberFormatter.format(item.resolved)}
                        color={item.resolved > 0 ? 'success' : 'default'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right" sx={cellSx}>
                      <Chip
                        label={numberFormatter.format(item.overdue)}
                        color={item.overdue > 0 ? 'error' : 'success'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={cellSx}>
                      {item.onTimeRate === null ? (
                        <Typography variant="caption" color="text.secondary">
                          Chưa có dữ liệu
                        </Typography>
                      ) : (
                        <Stack spacing={0.6}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" fontWeight={650}>
                              {item.onTimeRate}%
                            </Typography>
                            <Chip
                              label={item.onTimeRate >= 80 ? 'Tốt' : item.onTimeRate >= 60 ? 'Cần theo dõi' : 'Cần cải thiện'}
                              color={getRateColor(item.onTimeRate)}
                              size="small"
                              sx={{ height: 20, fontSize: '0.66rem' }}
                            />
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={item.onTimeRate}
                            color={getRateColor(item.onTimeRate)}
                            sx={{ height: 5, borderRadius: 999 }}
                          />
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <AccessTime sx={{ fontSize: 17, color: 'text.secondary' }} />
                        <Typography
                          variant="body2"
                          color={item.avgResolutionHours === null ? 'text.secondary' : 'text.primary'}
                        >
                          {formatHours(item.avgResolutionHours)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      {item.avgRating === null ? (
                        <Typography variant="caption" color="text.secondary">
                          Chưa có đánh giá
                        </Typography>
                      ) : (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Star sx={{ color: '#F59E0B', fontSize: 19 }} />
                          <Typography variant="body2" fontWeight={650}>
                            {item.avgRating.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/5
                          </Typography>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ px: 2.5, py: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}>
          <Typography variant="caption" color="text.secondary">
            Tỷ lệ đúng hạn tính trên việc đã hoàn tất. Thời gian xử lý trung bình tính từ lúc
            phân công đến khi hoàn tất; dấu “chưa có dữ liệu” không đồng nghĩa với giá trị 0.
          </Typography>
        </Box>
      </GlassCard>
    </Stack>
  );
};

export default DepartmentPerformance;
