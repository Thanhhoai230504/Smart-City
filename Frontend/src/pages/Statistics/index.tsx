import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  LinearProgress,
  Rating,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import {
  Refresh,
  ScheduleOutlined,
  SourceOutlined,
} from '@mui/icons-material';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { statisticsApi } from '../../api/statisticsApi';
import { CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';

interface DistrictStat {
  district: string;
  total: number;
  resolved: number;
  rate: number;
}

interface StatsData {
  overview: {
    totalIssues: number;
    resolvedCount: number;
    resolutionRate: number;
    avgResolutionHours: number;
  };
  issuesByStatus: Record<string, number>;
  issuesByCategory: { category: string; label: string; count: number }[];
  issuesTrend: { date: string; count: number }[];
  issuesByDistrict: DistrictStat[];
  rating: {
    average: number;
    total: number;
    distribution: Record<number, number>;
  };
}

const FALLBACK_COLORS = ['#0B5E8E', '#397DA5', '#2F7D64', '#B26A00', '#C62828', '#6B7F8C'];

const numberFormatter = new Intl.NumberFormat('vi-VN');
const decimalFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

const StatisticsPage: React.FC = () => {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await statisticsApi.getPublicStatistics();
      setData(response.data.data);
    } catch {
      setError('Không thể tải dữ liệu thống kê lúc này. Vui lòng kiểm tra kết nối máy chủ và thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 } }}>
        <Skeleton variant="text" width={210} height={24} />
        <Skeleton variant="text" width={390} height={52} />
        <Skeleton variant="text" width="62%" height={28} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            mt: 3,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <Box key={index} sx={{ p: 2.5, borderRight: index < 3 ? '1px solid #D8E1E7' : 0 }}>
              <Skeleton width="55%" />
              <Skeleton height={44} width="70%" />
              <Skeleton width="80%" />
            </Box>
          ))}
        </Box>
        <Grid container spacing={2.5} mt={0.5}>
          <Grid item xs={12} md={8}><Skeleton variant="rounded" height={360} /></Grid>
          <Grid item xs={12} md={4}><Skeleton variant="rounded" height={360} /></Grid>
        </Grid>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 }, minHeight: '55vh' }}>
        <Typography variant="body2" color="primary.main" fontWeight={700} mb={0.75}>
          Dữ liệu công khai
        </Typography>
        <Typography variant="h3" component="h1" mb={1}>Thống kê sự cố đô thị</Typography>
        <Typography color="text.secondary" mb={3}>
          Tổng hợp tình hình tiếp nhận và xử lý phản ánh trên địa bàn thành phố Đà Nẵng.
        </Typography>
        <Alert
          severity="warning"
          action={(
            <Button color="inherit" size="small" startIcon={<Refresh />} onClick={fetchData}>
              Thử lại
            </Button>
          )}
        >
          {error || 'Chưa có dữ liệu thống kê để hiển thị.'}
        </Alert>
      </Container>
    );
  }

  const statusData = Object.entries(data.issuesByStatus).map(([key, value]) => ({
    key,
    name: STATUS_MAP[key]?.label || key,
    value,
    color: STATUS_MAP[key]?.color || '#6B7280',
  }));

  const statusTotal = Math.max(
    statusData.reduce((sum, item) => sum + item.value, 0),
    1,
  );

  const trendData = data.issuesTrend.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
    }),
  }));

  const maxCategory = Math.max(...data.issuesByCategory.map((item) => item.count), 1);

  const metrics = [
    {
      index: '01',
      label: 'Tổng phản ánh',
      value: numberFormatter.format(data.overview.totalIssues),
      note: 'đã được ghi nhận',
    },
    {
      index: '02',
      label: 'Đã xử lý',
      value: numberFormatter.format(data.overview.resolvedCount),
      note: 'phản ánh đã hoàn tất',
    },
    {
      index: '03',
      label: 'Tỷ lệ xử lý',
      value: `${decimalFormatter.format(data.overview.resolutionRate)}%`,
      note: 'trên tổng phản ánh',
    },
    {
      index: '04',
      label: 'Thời gian trung bình',
      value: `${decimalFormatter.format(data.overview.avgResolutionHours)} giờ`,
      note: 'từ tiếp nhận đến hoàn tất',
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 } }}>
      <Box
        component="header"
        sx={{
          pb: 3,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'flex-end' }}
          spacing={2}
        >
          <Box>
            <Typography variant="body2" color="primary.main" fontWeight={700} mb={0.75}>
              Dữ liệu công khai
            </Typography>
            <Typography variant="h3" component="h1" mb={0.75}>
              Thống kê sự cố đô thị
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 680 }}>
              Tổng hợp tình hình tiếp nhận và xử lý phản ánh trên địa bàn thành phố Đà Nẵng.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchData}
            sx={{ alignSelf: { xs: 'flex-start', sm: 'flex-end' }, whiteSpace: 'nowrap' }}
          >
            Cập nhật dữ liệu
          </Button>
        </Stack>
      </Box>

      <Box
        component="section"
        aria-label="Tổng quan số liệu"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          mb: 3,
          bgcolor: 'background.paper',
          borderLeft: '1px solid',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {metrics.map((metric, index) => (
          <Box
            key={metric.label}
            sx={{
              minWidth: 0,
              p: { xs: 2, md: 2.5 },
              borderTop: '1px solid',
              borderRight: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1.25}>
              <Typography variant="body2" fontWeight={700} color="text.secondary">
                {metric.label}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                {metric.index}
              </Typography>
            </Stack>
            <Typography
              variant="h4"
              component="p"
              color={index === 2 ? 'secondary.dark' : 'text.primary'}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {metric.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {metric.note}
            </Typography>
          </Box>
        ))}
      </Box>

      <Grid container spacing={2.5} mb={2.5}>
        <Grid item xs={12} md={8}>
          <Box
            component="section"
            sx={{
              height: '100%',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
              overflow: 'hidden',
            }}
          >
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" component="h2">Diễn biến phản ánh</Typography>
              <Typography variant="caption" color="text.secondary">
                Số phản ánh mới được ghi nhận trong 30 ngày gần nhất
              </Typography>
            </Box>
            <Box sx={{ px: { xs: 0.5, sm: 1.5 }, pt: 2, pb: 1 }}>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trendData} margin={{ top: 8, right: 18, left: -12, bottom: 2 }}>
                    <defs>
                      <linearGradient id="publicTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0B5E8E" stopOpacity={0.16} />
                        <stop offset="95%" stopColor="#0B5E8E" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#E3E9ED" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#627481', fontSize: 11 }}
                      minTickGap={24}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#627481', fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#FFFFFF',
                        border: '1px solid #D4DFE5',
                        borderRadius: 8,
                        boxShadow: '0 6px 18px rgba(23,43,58,0.08)',
                      }}
                      labelStyle={{ color: '#172B3A', fontWeight: 650 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Phản ánh"
                      stroke="#0B5E8E"
                      fill="url(#publicTrendFill)"
                      strokeWidth={2}
                      dot={trendData.length <= 10 ? { r: 3, fill: '#0B5E8E' } : false}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Stack alignItems="center" justifyContent="center" sx={{ height: 280 }}>
                  <Typography variant="body2" color="text.secondary">
                    Chưa có dữ liệu trong 30 ngày gần nhất
                  </Typography>
                </Stack>
              )}
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
          <Box
            component="section"
            sx={{
              height: '100%',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
              overflow: 'hidden',
            }}
          >
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" component="h2">Tiến độ xử lý</Typography>
              <Typography variant="caption" color="text.secondary">
                Phân bố phản ánh theo trạng thái hiện tại
              </Typography>
            </Box>
            <Stack spacing={2.15} sx={{ p: 2.5 }}>
              {statusData.map((item) => {
                const percentage = (item.value / statusTotal) * 100;
                return (
                  <Box key={item.key}>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={0.75}>
                      <Stack direction="row" alignItems="center" spacing={0.9}>
                        <Box sx={{ width: 8, height: 8, bgcolor: item.color, borderRadius: '50%' }} />
                        <Typography variant="body2" fontWeight={600}>{item.name}</Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={700}>
                        {item.value}
                        <Typography component="span" variant="caption" color="text.secondary" ml={0.7}>
                          {decimalFormatter.format(percentage)}%
                        </Typography>
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={percentage}
                      sx={{
                        height: 5,
                        bgcolor: '#E8EDF0',
                        '& .MuiLinearProgress-bar': { bgcolor: item.color },
                      }}
                    />
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} mb={2.5}>
        <Grid item xs={12} md={5}>
          <Box
            component="section"
            sx={{
              height: '100%',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
              overflow: 'hidden',
            }}
          >
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" component="h2">Nhóm vấn đề</Typography>
              <Typography variant="caption" color="text.secondary">
                Số lượng phản ánh theo danh mục
              </Typography>
            </Box>
            <Stack spacing={1.7} sx={{ p: 2.5 }}>
              {data.issuesByCategory.map((item, index) => {
                const itemColor = CATEGORY_MAP[item.category]?.color
                  || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                return (
                  <Box key={item.category}>
                    <Stack direction="row" justifyContent="space-between" mb={0.65}>
                      <Stack direction="row" spacing={0.9} alignItems="center">
                        <Box sx={{ width: 3, height: 16, bgcolor: itemColor }} />
                        <Typography variant="body2">{item.label}</Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={700}>{item.count}</Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(item.count / maxCategory) * 100}
                      sx={{
                        height: 4,
                        bgcolor: '#E8EDF0',
                        '& .MuiLinearProgress-bar': { bgcolor: itemColor },
                      }}
                    />
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </Grid>

        <Grid item xs={12} md={7}>
          <Box
            component="section"
            sx={{
              height: '100%',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
              overflow: 'hidden',
            }}
          >
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" component="h2">Kết quả theo địa bàn</Typography>
              <Typography variant="caption" color="text.secondary">
                So sánh số lượng và tỷ lệ xử lý giữa các quận, huyện
              </Typography>
            </Box>

            <Box
              sx={{
                display: { xs: 'none', sm: 'grid' },
                gridTemplateColumns: 'minmax(140px, 1fr) 80px 90px 150px',
                gap: 1.5,
                px: 2.5,
                py: 1.25,
                bgcolor: '#F4F7F8',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              {['Địa bàn', 'Phản ánh', 'Đã xử lý', 'Tỷ lệ'].map((label) => (
                <Typography key={label} variant="caption" fontWeight={700} color="text.secondary">
                  {label}
                </Typography>
              ))}
            </Box>

            <Stack divider={<Box sx={{ borderTop: '1px solid #E6EBEE' }} />}>
              {data.issuesByDistrict.map((districtItem) => {
                const rateColor = districtItem.rate >= 70
                  ? '#2F7D64'
                  : districtItem.rate >= 40
                    ? '#B26A00'
                    : '#C62828';
                return (
                  <Box
                    key={districtItem.district}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(140px, 1fr) 80px 90px 150px' },
                      gap: { xs: 0.75, sm: 1.5 },
                      alignItems: 'center',
                      px: 2.5,
                      py: 1.35,
                    }}
                  >
                    <Typography variant="body2" fontWeight={600}>{districtItem.district}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                      {districtItem.total}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                      {districtItem.resolved}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <LinearProgress
                        variant="determinate"
                        value={districtItem.rate}
                        sx={{
                          flex: 1,
                          minWidth: { xs: 85, sm: 88 },
                          height: 5,
                          bgcolor: '#E8EDF0',
                          '& .MuiLinearProgress-bar': { bgcolor: rateColor },
                        }}
                      />
                      <Typography variant="caption" fontWeight={700} color={rateColor} sx={{ minWidth: 36 }}>
                        {districtItem.rate}%
                      </Typography>
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: { xs: 'block', sm: 'none' }, gridColumn: '1 / -1' }}
                    >
                      {districtItem.resolved}/{districtItem.total} phản ánh đã xử lý
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </Grid>
      </Grid>

      {data.rating.total > 0 && (
        <Box
          component="section"
          sx={{
            mb: 2.5,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" component="h2">Đánh giá chất lượng xử lý</Typography>
            <Typography variant="caption" color="text.secondary">
              Phản hồi của người dân sau khi sự cố được hoàn tất
            </Typography>
          </Box>
          <Grid container>
            <Grid
              item
              xs={12}
              sm={4}
              sx={{
                p: 3,
                textAlign: 'center',
                borderRight: { sm: '1px solid #D8E1E7' },
                borderBottom: { xs: '1px solid #D8E1E7', sm: 0 },
              }}
            >
              <Typography variant="h2" fontWeight={750} color="text.primary">
                {decimalFormatter.format(data.rating.average)}
              </Typography>
              <Rating
                value={data.rating.average}
                readOnly
                precision={0.1}
                sx={{ '& .MuiRating-iconFilled': { color: '#B26A00' }, fontSize: '1.65rem' }}
              />
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                {data.rating.total} lượt đánh giá
              </Typography>
            </Grid>
            <Grid item xs={12} sm={8} sx={{ p: 3 }}>
              <Stack spacing={1.2}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = data.rating.distribution[star] || 0;
                  const percentage = data.rating.total > 0 ? (count / data.rating.total) * 100 : 0;
                  return (
                    <Stack key={star} direction="row" alignItems="center" spacing={1.5}>
                      <Typography variant="body2" sx={{ minWidth: 42 }}>{star} sao</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={percentage}
                        sx={{
                          flex: 1,
                          height: 5,
                          bgcolor: '#E8EDF0',
                          '& .MuiLinearProgress-bar': { bgcolor: '#B26A00' },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 28, textAlign: 'right' }}>
                        {count}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </Grid>
          </Grid>
        </Box>
      )}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ pt: 1, color: 'text.secondary' }}
      >
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <SourceOutlined sx={{ fontSize: 16 }} />
          <Typography variant="caption">Nguồn: Hệ thống Smart City Đà Nẵng</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <ScheduleOutlined sx={{ fontSize: 16 }} />
          <Typography variant="caption">Số liệu được cập nhật theo thời gian thực</Typography>
        </Stack>
      </Stack>
    </Container>
  );
};

export default StatisticsPage;
