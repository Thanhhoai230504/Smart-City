import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  LinearProgress,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  Email,
  SourceOutlined,
  Thermostat,
  ThumbUp,
  WaterDrop,
} from '@mui/icons-material';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RootState } from '../../store/store';
import { dashboardApi } from '../../api/dashboardApi';
import { environmentApi } from '../../api/environmentApi';
import {
  CATEGORY_LABELS,
  ChartTooltip,
  DashboardStats,
  EnvData,
  GlassCard,
  STATUS_COLORS,
  STATUS_LABELS,
  TrafficStats,
} from './types';
import AssignmentManagement from './AssignmentManagement';
import AuditLogManagement from './AuditLogManagement';
import CameraManagement from './CameraManagement';
import DashboardLoading from './DashboardLoading';
import DepartmentManagement from './DepartmentManagement';
import DepartmentPerformance from './DepartmentPerformance';
import EnvironmentHistoryChart from './EnvironmentHistoryChart';
import ExportButton from './ExportButton';
import IssueManagement from './IssueManagement';
import PlaceManagement from './PlaceManagement';
import TrafficDashboard from './TrafficDashboard';
import UserManagement from './UserManagement';

const TAB_KEYS = ['overview', 'departments', 'assignments', 'performance', 'cameras', 'audit'];
const TAB_HEADINGS = [
  ['Tổng quan điều hành', 'Theo dõi hoạt động và điều phối dịch vụ đô thị Đà Nẵng'],
  ['Đơn vị xử lý', 'Quản lý cơ quan, phạm vi phụ trách và SLA theo đơn vị'],
  ['Phân công sự cố', 'Điều phối sự cố đến đúng đơn vị và cán bộ phụ trách'],
  ['Hiệu suất đơn vị', 'Theo dõi tiến độ, chất lượng và khả năng đáp ứng SLA'],
  ['Quản lý camera', 'Theo dõi các điểm camera công cộng và luồng giám sát'],
  ['Nhật ký hoạt động', 'Tra cứu các thay đổi quan trọng trong hệ thống'],
];

const DashboardPanel: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  sx?: object;
  contentSx?: object;
}> = ({ title, subtitle, children, sx, contentSx }) => (
  <Box
    component="section"
    sx={{
      bgcolor: 'background.paper',
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 1.5,
      overflow: 'hidden',
      ...sx,
    }}
  >
    <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="h6" component="h2">{title}</Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
      )}
    </Box>
    <Box sx={{ p: 2.5, ...contentSx }}>{children}</Box>
  </Box>
);

const AdminDashboard: React.FC = () => {
  const { user: currentUser, isAuthenticated } = useSelector((state: RootState) => state.auth);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [traffic, setTraffic] = useState<TrafficStats | null>(null);
  const [envData, setEnvData] = useState<EnvData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReport, setSendingReport] = useState(false);
  const [reportNotice, setReportNotice] = useState<{
    open: boolean;
    severity: 'success' | 'error';
    message: string;
  }>({ open: false, severity: 'success', message: '' });
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedTab = searchParams.get('tab') || 'overview';
  const activeTab = Math.max(0, TAB_KEYS.indexOf(requestedTab));

  const refreshStats = useCallback(async () => {
    try {
      const { data } = await dashboardApi.getStats();
      setStats(data.data);
    } catch {
      // Các bảng quản trị tự hiển thị lỗi riêng; giữ dữ liệu tổng quan gần nhất.
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !currentUser || currentUser.role !== 'admin') return;

    (async () => {
      setLoading(true);
      try {
        const [statsResult, trafficResult, environmentResult] = await Promise.allSettled([
          dashboardApi.getStats(),
          dashboardApi.getTrafficStats(),
          environmentApi.getEnvironmentData(),
        ]);

        if (statsResult.status === 'fulfilled') setStats(statsResult.value.data.data);
        if (trafficResult.status === 'fulfilled') setTraffic(trafficResult.value.data.data);
        if (environmentResult.status === 'fulfilled') {
          const payload = environmentResult.value.data.data;
          setEnvData(Array.isArray(payload.environment) ? payload.environment : []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, currentUser]);

  const sendWeeklyReport = async () => {
    setSendingReport(true);
    try {
      await dashboardApi.sendReport('weekly');
      setReportNotice({
        open: true,
        severity: 'success',
        message: 'Đã gửi báo cáo tuần đến email quản trị.',
      });
    } catch {
      setReportNotice({
        open: true,
        severity: 'error',
        message: 'Không thể gửi báo cáo. Vui lòng thử lại.',
      });
    } finally {
      setSendingReport(false);
    }
  };

  const districtData = (stats?.issuesByDistrict || []).filter((item) => item.count > 0);
  const topVotedIssues = stats?.topVotedIssues || [];

  const statusData = useMemo(
    () => stats
      ? Object.entries(stats.issuesByStatus).map(([key, value]) => ({
          key,
          name: STATUS_LABELS[key] || key,
          value,
          color: STATUS_COLORS[key] || '#6B7280',
        }))
      : [],
    [stats],
  );

  const categoryData = useMemo(
    () => stats?.issuesByCategory.map((item) => ({
      key: item.category,
      name: CATEGORY_LABELS[item.category] || item.label,
      value: item.count,
    })) || [],
    [stats],
  );

  const trendData = useMemo(
    () => stats?.issuesTrend.map((item) => ({
      date: new Date(item.date).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
      }),
      'Sự cố': item.count,
    })) || [],
    [stats],
  );

  const statusTotal = Math.max(
    statusData.reduce((sum, item) => sum + item.value, 0),
    1,
  );
  const maxCategory = Math.max(...categoryData.map((item) => item.value), 1);
  const maxDistrict = Math.max(...districtData.map((item) => item.count), 1);
  const congestionColor = traffic
    ? traffic.congestionIndex > 50
      ? '#C62828'
      : traffic.congestionIndex > 30
        ? '#B26A00'
        : '#2F7D64'
    : '#2F7D64';

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!currentUser) return <DashboardLoading />;
  if (currentUser.role !== 'admin') return <Navigate to="/" replace />;
  if (loading) return <DashboardLoading />;

  const overviewMetrics = [
    {
      label: 'Tổng sự cố',
      value: stats?.overview.totalIssues || 0,
      note: 'đã ghi nhận trong hệ thống',
      color: '#172B3A',
    },
    {
      label: 'Hôm nay',
      value: stats?.overview.issuesToday || 0,
      note: 'phản ánh mới',
      color: (stats?.overview.issuesToday || 0) > 0 ? '#B26A00' : '#172B3A',
    },
    {
      label: 'Tuần này',
      value: stats?.overview.issuesThisWeek || 0,
      note: 'phản ánh mới',
      color: '#172B3A',
    },
    {
      label: 'Người dùng',
      value: stats?.overview.totalUsers || 0,
      note: 'tài khoản đã đăng ký',
      color: '#172B3A',
    },
    {
      label: 'Địa điểm',
      value: stats?.overview.totalPlaces || 0,
      note: 'điểm hạ tầng đô thị',
      color: '#172B3A',
    },
    {
      label: 'Chỉ số tắc nghẽn',
      value: `${traffic?.congestionIndex || 0}%`,
      note: `Tốc độ TB ${traffic?.averageSpeed || 0} km/h`,
      color: congestionColor,
    },
  ];

  return (
    <Box sx={{ maxWidth: 1460, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Box
        component="header"
        sx={{
          pb: 3,
          mb: 0,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          alignItems={{ lg: 'flex-end' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Typography variant="body2" color="primary.main" fontWeight={700} mb={0.75}>
              Trung tâm điều hành
            </Typography>
            <Typography variant="h3" component="h1" mb={0.65}>
              {TAB_HEADINGS[activeTab][0]}
            </Typography>
            <Typography color="text.secondary">
              {TAB_HEADINGS[activeTab][1]}
            </Typography>
          </Box>

          {activeTab === 0 && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: { sm: 1 } }}>
                {new Date().toLocaleDateString('vi-VN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Typography>
              <ExportButton />
              <Button
                size="small"
                variant="outlined"
                startIcon={sendingReport ? <CircularProgress size={14} /> : <Email />}
                disabled={sendingReport}
                onClick={sendWeeklyReport}
              >
                {sendingReport ? 'Đang gửi...' : 'Gửi báo cáo'}
              </Button>
            </Stack>
          )}
        </Stack>
      </Box>

      <Box
        sx={{
          display: { xs: 'block', lg: 'none' },
          borderBottom: '1px solid',
          borderColor: 'divider',
          mb: 2.5,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, value: number) => setSearchParams(
            value === 0 ? {} : { tab: TAB_KEYS[value] },
            { replace: true },
          )}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Khu vực quản trị"
        >
          <Tab label="Tổng quan" />
          <Tab label="Đơn vị xử lý" />
          <Tab label="Phân công" />
          <Tab label="Hiệu suất" />
          <Tab label="Camera" />
          <Tab label="Nhật ký" />
        </Tabs>
      </Box>

      {activeTab === 0 ? (
        <Stack spacing={2.5} sx={{ mt: { xs: 0, lg: 2.5 } }}>
          <Box
            component="section"
            aria-label="Chỉ số điều hành"
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr 1fr',
                md: 'repeat(3, 1fr)',
                xl: 'repeat(6, 1fr)',
              },
              bgcolor: 'background.paper',
              borderLeft: '1px solid',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            {overviewMetrics.map((item, index) => (
              <Box
                key={item.label}
                sx={{
                  p: { xs: 1.75, md: 2.15 },
                  minWidth: 0,
                  borderTop: '1px solid',
                  borderRight: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={0.75}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    {item.label}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {String(index + 1).padStart(2, '0')}
                  </Typography>
                </Stack>
                <Typography variant="h5" component="p" color={item.color} mb={0.25}>
                  {item.value}
                </Typography>
                <Typography variant="caption" color="text.disabled">{item.note}</Typography>
              </Box>
            ))}
          </Box>

          <Grid container spacing={2.5}>
            <Grid item xs={12} md={8}>
              <DashboardPanel
                title="Diễn biến phản ánh"
                subtitle="Số sự cố mới được ghi nhận trong 30 ngày gần nhất"
                sx={{ height: '100%' }}
                contentSx={{ px: { xs: 0.5, sm: 1.5 }, pt: 2, pb: 1 }}
              >
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={trendData} margin={{ top: 8, right: 18, left: -12, bottom: 2 }}>
                      <defs>
                        <linearGradient id="adminTrendFill" x1="0" y1="0" x2="0" y2="1">
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
                      <RTooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="Sự cố"
                        stroke="#0B5E8E"
                        fill="url(#adminTrendFill)"
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
              </DashboardPanel>
            </Grid>

            <Grid item xs={12} md={4}>
              <DashboardPanel
                title="Tiến độ xử lý"
                subtitle="Phân bố toàn bộ sự cố theo trạng thái hiện tại"
                sx={{ height: '100%' }}
              >
                <Stack spacing={2.15}>
                  {statusData.map((item) => {
                    const percentage = (item.value / statusTotal) * 100;
                    return (
                      <Box key={item.key}>
                        <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={0.7}>
                          <Stack direction="row" spacing={0.8} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
                            <Typography variant="body2" fontWeight={600}>{item.name}</Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={700}>
                            {item.value}
                            <Typography component="span" variant="caption" color="text.secondary" ml={0.7}>
                              {Math.round(percentage)}%
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
              </DashboardPanel>
            </Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid item xs={12} md={5}>
              <DashboardPanel
                title="Cơ cấu vấn đề"
                subtitle="Số sự cố theo từng nhóm hạ tầng"
                sx={{ height: '100%' }}
              >
                <Stack spacing={1.65}>
                  {categoryData.map((item, index) => {
                    const color = ['#0B5E8E', '#2F7D64', '#B26A00', '#397DA5', '#C62828', '#6B7F8C'][index % 6];
                    return (
                      <Box key={item.key}>
                        <Stack direction="row" justifyContent="space-between" mb={0.6}>
                          <Stack direction="row" spacing={0.9} alignItems="center">
                            <Box sx={{ width: 3, height: 15, bgcolor: color }} />
                            <Typography variant="body2">{item.name}</Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={700}>{item.value}</Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={(item.value / maxCategory) * 100}
                          sx={{
                            height: 4,
                            bgcolor: '#E8EDF0',
                            '& .MuiLinearProgress-bar': { bgcolor: color },
                          }}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              </DashboardPanel>
            </Grid>

            <Grid item xs={12} md={7}>
              <DashboardPanel
                title="Phản ánh được quan tâm"
                subtitle="Xếp hạng theo lượt đồng thuận của cộng đồng"
                sx={{ height: '100%' }}
                contentSx={{ p: 0 }}
              >
                {topVotedIssues.length > 0 ? (
                  <Stack divider={<Box sx={{ borderTop: '1px solid #E6EBEE' }} />}>
                    {topVotedIssues.map((issue, index) => (
                      <Box
                        key={issue._id}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '34px minmax(0, 1fr) auto',
                          gap: 1.25,
                          alignItems: 'center',
                          px: 2.5,
                          py: 1.45,
                        }}
                      >
                        <Typography variant="body2" fontWeight={750} color="primary.main">
                          {String(index + 1).padStart(2, '0')}
                        </Typography>
                        <Box minWidth={0}>
                          <Typography variant="body2" fontWeight={650} noWrap>{issue.title}</Typography>
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {issue.location}
                            </Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  bgcolor: STATUS_COLORS[issue.status] || '#6B7280',
                                }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {STATUS_LABELS[issue.status] || issue.status}
                              </Typography>
                            </Stack>
                          </Stack>
                        </Box>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <ThumbUp sx={{ fontSize: 15, color: '#B26A00' }} />
                          <Typography variant="body2" fontWeight={700}>{issue.voteCount || 0}</Typography>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2.5 }}>
                    Chưa có phản ánh nhận được lượt đồng thuận.
                  </Typography>
                )}
              </DashboardPanel>
            </Grid>
          </Grid>

          {traffic ? (
            <TrafficDashboard traffic={traffic} />
          ) : (
            <GlassCard>
              <Typography color="text.secondary">Đang tải dữ liệu giao thông...</Typography>
            </GlassCard>
          )}

          <IssueManagement onDataChange={refreshStats} />
          <UserManagement onDataChange={refreshStats} />
          <PlaceManagement onDataChange={refreshStats} />
          <EnvironmentHistoryChart GlassCard={GlassCard} ChartTooltip={ChartTooltip} />

          <Grid container spacing={2.5}>
            {districtData.length > 0 && (
              <Grid item xs={12} md={6}>
                <DashboardPanel
                  title="Phân bố theo địa bàn"
                  subtitle="Số sự cố đã ghi nhận tại từng quận, huyện"
                  sx={{ height: '100%' }}
                >
                  <Stack spacing={1.55}>
                    {districtData.map((item) => (
                      <Box key={item.name}>
                        <Stack direction="row" justifyContent="space-between" mb={0.55}>
                          <Typography variant="body2">{item.name}</Typography>
                          <Typography variant="body2" fontWeight={700}>{item.count}</Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={(item.count / maxDistrict) * 100}
                          sx={{
                            height: 4,
                            bgcolor: '#E8EDF0',
                            '& .MuiLinearProgress-bar': { bgcolor: '#0B5E8E' },
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </DashboardPanel>
              </Grid>
            )}

            <Grid item xs={12} md={districtData.length > 0 ? 6 : 12}>
              <DashboardPanel
                title="Điều kiện môi trường"
                subtitle="Dữ liệu thời tiết tại các khu vực đang theo dõi"
                sx={{ height: '100%' }}
                contentSx={{ p: 0 }}
              >
                {envData.length > 0 ? (
                  <Stack divider={<Box sx={{ borderTop: '1px solid #E6EBEE' }} />}>
                    {envData.map((environment, index) => (
                      <Box
                        key={`${environment.location}-${index}`}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(130px, 1fr) auto auto',
                          gap: 2,
                          alignItems: 'center',
                          px: 2.5,
                          py: 1.45,
                        }}
                      >
                        <Box minWidth={0}>
                          <Typography variant="body2" fontWeight={650} noWrap>
                            {environment.location}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {environment.weatherCondition}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.6} alignItems="center">
                          <Thermostat sx={{ fontSize: 17, color: '#B26A00' }} />
                          <Typography variant="body2" fontWeight={700}>{environment.temperature}°C</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.6} alignItems="center">
                          <WaterDrop sx={{ fontSize: 17, color: '#397DA5' }} />
                          <Typography variant="body2" fontWeight={700}>{environment.humidity}%</Typography>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2.5 }}>
                    Chưa có dữ liệu môi trường.
                  </Typography>
                )}
              </DashboardPanel>
            </Grid>
          </Grid>

          <Stack direction="row" spacing={0.75} alignItems="center" color="text.secondary" pt={0.5}>
            <SourceOutlined sx={{ fontSize: 16 }} />
            <Typography variant="caption">
              Dữ liệu tổng hợp từ các phân hệ sự cố, giao thông, địa điểm và môi trường.
            </Typography>
          </Stack>
        </Stack>
      ) : activeTab === 1 ? (
        <Box mt={{ xs: 0, lg: 2.5 }}><DepartmentManagement /></Box>
      ) : activeTab === 2 ? (
        <Box mt={{ xs: 0, lg: 2.5 }}><AssignmentManagement /></Box>
      ) : activeTab === 3 ? (
        <Box mt={{ xs: 0, lg: 2.5 }}><DepartmentPerformance /></Box>
      ) : activeTab === 4 ? (
        <Box mt={{ xs: 0, lg: 2.5 }}><CameraManagement /></Box>
      ) : (
        <Box mt={{ xs: 0, lg: 2.5 }}><AuditLogManagement /></Box>
      )}

      <Snackbar
        open={reportNotice.open}
        autoHideDuration={4000}
        onClose={() => setReportNotice((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          variant="filled"
          severity={reportNotice.severity}
          onClose={() => setReportNotice((current) => ({ ...current, open: false }))}
        >
          {reportNotice.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminDashboard;
