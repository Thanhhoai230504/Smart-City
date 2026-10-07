import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Grid, Rating, Skeleton, Stack, Typography, keyframes } from '@mui/material';
import {
  CategoryRounded,
  DonutLargeRounded,
  InboxRounded,
  ListAltRounded,
  LocationCityRounded,
  RefreshRounded,
  ScheduleOutlined,
  ShowChartRounded,
  SourceOutlined,
  StarRounded,
  TaskAltRounded,
  TimerRounded,
  TrendingUpRounded,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { statisticsApi } from '../../api/statisticsApi';
import { STATUS_MAP } from '../../utils/constants';
import { CHROME } from '../../layout/chrome';
import PageHero, { HeroButton, HeroGlassCard, HeroStatTile } from '../../components/PageHero';
import { C, EASE, FONT_MONO, NO_MOTION, mix, prefersReducedMotion } from '../Home/homeStyle';
import { categoryColor, categoryIcon } from '../Home/categoryIcons';
import { useCountUp } from '../Home/hooks';
import { GradientText } from '../Home/SectionHeading';
import StatCard from './StatCard';
import Leaderboard from './Leaderboard';

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

const numberFormatter = new Intl.NumberFormat('vi-VN');
const decimalFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const timeFormatter = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });
const STATUS_ORDER = ['reported', 'processing', 'resolved', 'rejected'];

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/** Màu tỷ lệ xử lý theo địa bàn: ≥ 70% xanh, ≥ 40% cam, còn lại đỏ (cặp chữ/nền ≥ 4.5:1). */
const rateTone = (rate: number) => (
  rate >= 70 ? STATUS_MAP.resolved : rate >= 40 ? STATUS_MAP.processing : STATUS_MAP.reported
);

// ---------------------------------------------------------------------------
// Phần đầu: bốn chỉ số tổng quan trong thẻ kính
// ---------------------------------------------------------------------------

interface KpiProps {
  icon: SvgIconComponent;
  label: string;
  value: number | null;
  format: (n: number) => string;
  note: string;
  highlight?: boolean;
}

const KpiTile: React.FC<KpiProps> = ({ icon, label, value, format, note, highlight }) => {
  const current = useCountUp(value, value != null);
  return (
    <HeroStatTile icon={icon} label={label} value={value == null ? '—' : format(current)} note={note} highlight={highlight} />
  );
};

const KpiPanel: React.FC<{ overview: StatsData['overview'] | null }> = ({ overview }) => {
  const hours = overview?.avgResolutionHours ?? null;
  return (
    <HeroGlassCard>
      <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 1.75 }}>Tổng quan toàn thành phố</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
        <KpiTile icon={InboxRounded} label="Tổng phản ánh" value={overview?.totalIssues ?? null}
          format={(n) => numberFormatter.format(Math.round(n))} note="đã được ghi nhận" />
        <KpiTile icon={TaskAltRounded} label="Đã xử lý" value={overview?.resolvedCount ?? null}
          format={(n) => numberFormatter.format(Math.round(n))} note="phản ánh đã hoàn tất" />
        <KpiTile icon={DonutLargeRounded} label="Tỷ lệ xử lý" value={overview?.resolutionRate ?? null} highlight
          format={(n) => `${decimalFormatter.format(Math.round(n))}%`} note="trên tổng phản ánh" />
        <KpiTile icon={TimerRounded} label="Thời gian trung bình" value={hours}
          format={(n) => `${decimalFormatter.format(Math.round(n * 10) / 10)} giờ`}
          note={hours != null && hours >= 24 ? `≈ ${decimalFormatter.format(hours / 24)} ngày để hoàn tất` : 'từ tiếp nhận đến hoàn tất'} />
      </Box>
    </HeroGlassCard>
  );
};

// ---------------------------------------------------------------------------
// Các khối số liệu
// ---------------------------------------------------------------------------

const TrendTooltip: React.FC<TooltipProps<number, string>> = ({ active, payload, label }) => (
  active && payload?.length ? (
    <Box sx={{ px: 1.5, py: 1, bgcolor: C.white, border: `1px solid ${C.line}`, borderRadius: '12px', boxShadow: '0 12px 28px -14px rgba(15,34,51,.45)' }}>
      <Typography sx={{ fontSize: 12, color: C.muted }}>Ngày {label}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{payload[0].value} phản ánh</Typography>
    </Box>
  ) : null
);

const SummaryChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ px: 1.25, py: 0.6, borderRadius: '10px', bgcolor: C.bg, border: `1px solid ${C.line}`, textAlign: 'right' }}>
    <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '.08em', color: C.muted, lineHeight: 1.4 }}>{label}</Typography>
    <Typography sx={{ fontSize: 14, fontWeight: 800, color: C.ink, lineHeight: 1.3, whiteSpace: 'nowrap' }}>{value}</Typography>
  </Box>
);

const TrendCard: React.FC<{ trend: StatsData['issuesTrend'] }> = ({ trend }) => {
  const data = trend.map((item) => ({
    ...item,
    label: (() => { const d = new Date(item.date); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; })(),
  }));
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const peak = data.reduce<(typeof data)[number] | null>((best, item) => (!best || item.count > best.count ? item : best), null);
  return (
    <StatCard
      icon={ShowChartRounded}
      title="Diễn biến phản ánh"
      subtitle="Số phản ánh mới được ghi nhận trong 30 ngày gần nhất"
      action={data.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', sm: 'flex' } }}>
          <SummaryChip label="30 NGÀY" value={`${numberFormatter.format(total)} phản ánh`} />
          {peak && <SummaryChip label="CAO NHẤT" value={`${peak.count} · ${peak.label}`} />}
        </Stack>
      )}
    >
      {data.length > 0 ? (
        <Box sx={{ height: 300, ml: -1.5 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="statsTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.blue} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={C.aqua} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="statsTrendStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={C.blue} />
                  <stop offset="100%" stopColor={C.teal} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#E6EDF1" strokeDasharray="4 4" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 11.5 }} minTickGap={24} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 11.5 }} allowDecimals={false} width={36} />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: C.aqua, strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="count"
                name="Phản ánh"
                stroke="url(#statsTrendStroke)"
                strokeWidth={2.5}
                fill="url(#statsTrendFill)"
                dot={data.length <= 10 ? { r: 3, fill: C.blue } : false}
                activeDot={{ r: 5, fill: C.white, stroke: C.blue, strokeWidth: 2.5 }}
                isAnimationActive={!prefersReducedMotion()}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      ) : (
        <Stack alignItems="center" justifyContent="center" sx={{ height: 300 }}>
          <Typography sx={{ fontSize: 14, color: C.muted }}>Chưa có dữ liệu trong 30 ngày gần nhất</Typography>
        </Stack>
      )}
    </StatCard>
  );
};

const StatusCard: React.FC<{ byStatus: StatsData['issuesByStatus'] }> = ({ byStatus }) => {
  const items = STATUS_ORDER.filter((key) => key in byStatus).map((key) => ({
    key, name: STATUS_MAP[key]?.label || key, value: byStatus[key] || 0, color: STATUS_MAP[key]?.color || '#6B7280',
  }));
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <StatCard icon={DonutLargeRounded} title="Tiến độ xử lý" subtitle="Phân bố phản ánh theo trạng thái hiện tại">
      <Box
        role="img"
        aria-label={items.map((item) => `${item.name} ${item.value}`).join(', ')}
        sx={{ position: 'relative', height: 196, mt: 0.5 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total > 0 ? items : [{ key: 'none', name: 'Chưa có', value: 1, color: '#E6EDF1' }]}
              dataKey="value"
              nameKey="name"
              innerRadius="70%"
              outerRadius="98%"
              paddingAngle={total > 0 ? 2.5 : 0}
              cornerRadius={4}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              isAnimationActive={!prefersReducedMotion()}
            >
              {(total > 0 ? items : [{ key: 'none', color: '#E6EDF1' }]).map((item) => <Cell key={item.key} fill={item.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <Typography sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: C.ink }}>{numberFormatter.format(total)}</Typography>
          <Typography sx={{ fontSize: 12.5, color: C.muted, mt: 0.5 }}>phản ánh</Typography>
        </Stack>
      </Box>
      <Stack spacing={1} sx={{ mt: 2 }}>
        {items.map((item) => (
          <Stack key={item.key} direction="row" alignItems="center" spacing={1.25}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color, flexShrink: 0 }} />
            <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.body }}>{item.name}</Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{numberFormatter.format(item.value)}</Typography>
            <Typography sx={{ width: 50, textAlign: 'right', fontFamily: FONT_MONO, fontSize: 12, color: C.muted }}>
              {total > 0 ? `${decimalFormatter.format((item.value / total) * 100)}%` : '—'}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </StatCard>
  );
};

const CategoryCard: React.FC<{ categories: StatsData['issuesByCategory'] }> = ({ categories }) => {
  const total = categories.reduce((sum, item) => sum + item.count, 0);
  const max = Math.max(1, ...categories.map((item) => item.count));
  return (
    <StatCard icon={CategoryRounded} title="Nhóm vấn đề" subtitle="Số phản ánh theo loại sự cố">
      <Stack spacing={1.75} sx={{ mt: 0.5 }}>
        {categories.map((item) => {
          const color = categoryColor(item.category);
          const Icon = categoryIcon(item.category);
          return (
            <Box key={item.category}>
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 0.75 }}>
                <Box sx={{
                  width: 30, height: 30, flexShrink: 0, borderRadius: '9px', display: 'grid', placeItems: 'center',
                  color: mix(color, '#0F2233', 0.35), bgcolor: mix(color, '#FFFFFF', 0.86),
                }}>
                  <Icon sx={{ fontSize: 17 }} />
                </Box>
                <Typography sx={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, color: C.ink }}>{item.label}</Typography>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{numberFormatter.format(item.count)}</Typography>
                <Typography sx={{ width: 50, textAlign: 'right', fontFamily: FONT_MONO, fontSize: 12, color: C.muted }}>
                  {total > 0 ? `${decimalFormatter.format((item.count / total) * 100)}%` : '—'}
                </Typography>
              </Stack>
              <Box sx={{ height: 7, borderRadius: 7, bgcolor: mix(color, '#FFFFFF', 0.86), overflow: 'hidden' }}>
                <Box sx={{
                  height: '100%', borderRadius: 7, width: `${(item.count / max) * 100}%`,
                  background: `linear-gradient(90deg, ${mix(color, '#FFFFFF', 0.35)}, ${color})`,
                  transition: `width 900ms ${EASE}`, [NO_MOTION]: { transition: 'none' },
                }} />
              </Box>
            </Box>
          );
        })}
        {categories.length === 0 && (
          <Typography sx={{ py: 4, textAlign: 'center', fontSize: 14, color: C.muted }}>Chưa có phản ánh nào</Typography>
        )}
      </Stack>
    </StatCard>
  );
};

const DISTRICT_COLUMNS = 'minmax(120px, 1fr) 72px 72px 176px';

const DistrictCard: React.FC<{ districts: DistrictStat[] }> = ({ districts }) => (
  <StatCard icon={LocationCityRounded} title="Kết quả theo địa bàn" subtitle="Số phản ánh và tỷ lệ xử lý theo quận, huyện">
    <Box sx={{
      display: { xs: 'none', sm: 'grid' }, gridTemplateColumns: DISTRICT_COLUMNS, gap: 1.5,
      px: 1.5, py: 1, mt: 0.5, borderRadius: '10px', bgcolor: C.bg,
    }}>
      {['ĐỊA BÀN', 'PHẢN ÁNH', 'ĐÃ XỬ LÝ', 'TỶ LỆ'].map((label) => (
        <Typography key={label} sx={{ fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', color: C.muted }}>
          {label}
        </Typography>
      ))}
    </Box>
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {districts.map((item, index) => {
        const tone = rateTone(item.rate);
        const empty = item.total === 0;
        return (
          <Box
            component="li"
            key={item.district}
            sx={{
              display: 'grid', alignItems: 'center', gap: { xs: 0.5, sm: 1.5 },
              gridTemplateColumns: { xs: '1fr auto', sm: DISTRICT_COLUMNS },
              px: 1.5, py: 1.25, borderRadius: '10px',
              borderTop: index === 0 ? 'none' : `1px solid ${C.line}`,
              transition: 'background-color 160ms ease',
              '&:hover': { bgcolor: '#F7FAFB' },
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
              <Typography sx={{ width: 18, fontFamily: FONT_MONO, fontSize: 12, color: C.muted }}>{index + 1}</Typography>
              <Typography sx={{ fontSize: 14.5, fontWeight: 650, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.district}
              </Typography>
            </Stack>
            <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 14.5, fontWeight: 700, color: C.ink }}>{item.total}</Typography>
            <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 14.5, color: C.body }}>{item.resolved}</Typography>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Box sx={{ display: { xs: 'none', sm: 'block' }, flex: 1, height: 7, borderRadius: 7, bgcolor: '#E8EEF1', overflow: 'hidden' }}>
                {!empty && (
                  <Box sx={{ height: '100%', width: `${item.rate}%`, borderRadius: 7, bgcolor: tone.color, transition: `width 900ms ${EASE}`, [NO_MOTION]: { transition: 'none' } }} />
                )}
              </Box>
              <Box sx={{
                minWidth: 50, px: 1, py: 0.25, borderRadius: 999, textAlign: 'center',
                fontSize: 12.5, fontWeight: 800,
                bgcolor: empty ? '#EEF3F6' : tone.bg, color: empty ? C.muted : tone.text,
              }}>
                {empty ? '—' : `${item.rate}%`}
              </Box>
            </Stack>
            <Typography sx={{ display: { xs: 'block', sm: 'none' }, gridColumn: '1 / -1', pl: 3.75, fontSize: 12.5, color: C.muted }}>
              {item.resolved}/{item.total} phản ánh đã xử lý
            </Typography>
          </Box>
        );
      })}
    </Box>
  </StatCard>
);

const RatingCard: React.FC<{ rating: StatsData['rating'] }> = ({ rating }) => {
  const share = (stars: number[]) => (rating.total > 0
    ? Math.round((stars.reduce((sum, star) => sum + (rating.distribution[star] || 0), 0) / rating.total) * 100)
    : 0);
  return (
  <StatCard icon={StarRounded} tone="#D97706" title="Đánh giá chất lượng xử lý" subtitle="Phản hồi của người dân sau khi sự cố được hoàn tất">
    <Box sx={{ display: 'grid', alignItems: 'center', gap: 3, mt: 1, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '170px minmax(0, 1fr)' } }}>
      <Box sx={{ textAlign: 'center', py: 1, borderRadius: '16px', bgcolor: '#FFF8EC', border: '1px solid #FBE3B8' }}>
        <Typography sx={{ fontSize: 50, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', color: C.ink }}>
          {decimalFormatter.format(rating.average)}
        </Typography>
        <Rating value={rating.average} readOnly precision={0.1} sx={{ '& .MuiRating-iconFilled': { color: '#F59E0B' }, fontSize: '1.45rem' }} />
        <Typography sx={{ mt: 0.25, fontSize: 13, color: C.muted }}>{numberFormatter.format(rating.total)} lượt đánh giá</Typography>
      </Box>
      <Stack spacing={1.1}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = rating.distribution[star] || 0;
          const percentage = rating.total > 0 ? (count / rating.total) * 100 : 0;
          return (
            <Stack key={star} direction="row" alignItems="center" spacing={1.25}>
              <Typography sx={{ width: 44, fontSize: 13.5, fontWeight: 600, color: C.body, whiteSpace: 'nowrap' }}>{star} sao</Typography>
              <Box sx={{ flex: 1, height: 8, borderRadius: 8, bgcolor: '#FDF2E0', overflow: 'hidden' }}>
                <Box sx={{
                  height: '100%', width: `${percentage}%`, borderRadius: 8,
                  background: 'linear-gradient(90deg, #FBBF24, #F59E0B)',
                  transition: `width 900ms ${EASE}`, [NO_MOTION]: { transition: 'none' },
                }} />
              </Box>
              <Typography sx={{ width: 28, textAlign: 'right', fontFamily: FONT_MONO, fontSize: 12, color: C.muted }}>{count}</Typography>
            </Stack>
          );
        })}
      </Stack>
    </Box>
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2.25, pt: 2, borderTop: `1px dashed ${C.line}` }}>
      <Box sx={{ px: 1.25, py: 0.5, borderRadius: 999, fontSize: 13, fontWeight: 700, color: STATUS_MAP.resolved.text, bgcolor: STATUS_MAP.resolved.bg }}>
        {share([4, 5])}% hài lòng (4–5 sao)
      </Box>
      <Box sx={{ px: 1.25, py: 0.5, borderRadius: 999, fontSize: 13, fontWeight: 700, color: STATUS_MAP.reported.text, bgcolor: STATUS_MAP.reported.bg }}>
        {share([1, 2])}% chưa hài lòng (1–2 sao)
      </Box>
    </Stack>
  </StatCard>
  );
};

// ---------------------------------------------------------------------------

/**
 * Trang thống kê công khai: phần đầu xanh biển (`PageHero`) với bốn chỉ số đếm lên trong thẻ
 * kính; các khối số liệu nổi đè lên mép dưới phần đầu: diễn biến 30 ngày, tiến độ xử lý (biểu
 * đồ vòng), nhóm vấn đề, kết quả theo địa bàn, đánh giá và người dân tích cực. Bấm "Cập nhật
 * dữ liệu" thì giữ số cũ trên màn hình trong lúc tải lại thay vì xoá trắng trang.
 */
const StatisticsPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const fetchData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const response = await statisticsApi.getPublicStatistics();
      setData(response.data.data);
      setFetchedAt(new Date());
    } catch {
      setError('Không thể tải dữ liệu thống kê lúc này. Vui lòng kiểm tra kết nối máy chủ và thử lại.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const failed = !loading && !data;

  return (
    <Box sx={{ bgcolor: C.bg, pb: { xs: 6, md: 9 } }}>
      <PageHero
        eyebrow={fetchedAt ? `DỮ LIỆU CÔNG KHAI · CẬP NHẬT ${timeFormatter.format(fetchedAt)}` : 'DỮ LIỆU CÔNG KHAI'}
        title={<>Thống kê <GradientText dark>sự cố đô thị</GradientText></>}
        description="Tổng hợp tình hình tiếp nhận và xử lý phản ánh trên địa bàn thành phố Đà Nẵng."
        actions={(
          <>
            <HeroButton
              startIcon={(
                <RefreshRounded sx={{
                  animation: refreshing || loading ? `${spin} 900ms linear infinite` : 'none',
                  [NO_MOTION]: { animation: 'none' },
                }} />
              )}
              onClick={() => fetchData(Boolean(data))}
              disabled={loading || refreshing}
            >
              {refreshing || loading ? 'Đang cập nhật...' : 'Cập nhật dữ liệu'}
            </HeroButton>
            <HeroButton startIcon={<ListAltRounded />} onClick={() => navigate('/issues')}>
              Xem danh sách sự cố
            </HeroButton>
          </>
        )}
        aside={failed ? (
          <HeroGlassCard>
            <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 0.75 }}>Chưa tải được số liệu</Typography>
            <Typography sx={{ fontSize: 14, color: CHROME.body, lineHeight: 1.6, mb: 2 }}>
              {error || 'Chưa có dữ liệu thống kê để hiển thị.'}
            </Typography>
            <Button
              startIcon={<RefreshRounded />}
              onClick={() => fetchData()}
              sx={{ borderRadius: '10px', fontWeight: 700, color: C.seaDark, bgcolor: '#FFFFFF', '&:hover': { bgcolor: '#E3F4F8' } }}
            >
              Thử lại
            </Button>
          </HeroGlassCard>
        ) : (
          <KpiPanel overview={data?.overview ?? null} />
        )}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', mt: { xs: -7, md: -8 } }}>
        {loading ? (
          <Grid container spacing={2.5}>
            {[8, 4, 5, 7].map((md, index) => (
              <Grid item xs={12} md={md} key={index}>
                <Skeleton variant="rounded" height={index < 2 ? 400 : 360} sx={{ borderRadius: '20px', bgcolor: index < 2 ? '#DCE6EB' : undefined }} />
              </Grid>
            ))}
          </Grid>
        ) : data ? (
          <>
            <Grid container spacing={2.5}>
              <Grid item xs={12} md={8}><TrendCard trend={data.issuesTrend} /></Grid>
              <Grid item xs={12} md={4}><StatusCard byStatus={data.issuesByStatus} /></Grid>
              <Grid item xs={12} md={5}><CategoryCard categories={data.issuesByCategory} /></Grid>
              <Grid item xs={12} md={7}><DistrictCard districts={data.issuesByDistrict} /></Grid>
            </Grid>

            {/* Đánh giá + bảng xếp hạng: thiếu một khối thì khối còn lại chiếm trọn hàng */}
            <Box sx={{
              mt: 2.5, display: 'grid', gap: 2.5,
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(auto-fit, minmax(380px, 1fr))' },
            }}>
              {data.rating.total > 0 && (
                <Box sx={{ alignSelf: 'start', minWidth: 0 }}><RatingCard rating={data.rating} /></Box>
              )}
              <Leaderboard />
            </Box>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              spacing={1}
              sx={{ mt: 3, color: C.muted }}
            >
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <SourceOutlined sx={{ fontSize: 16 }} />
                <Typography sx={{ fontSize: 12.5 }}>Nguồn: Hệ thống Smart City Đà Nẵng</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <ScheduleOutlined sx={{ fontSize: 16 }} />
                <Typography sx={{ fontSize: 12.5 }}>
                  {fetchedAt ? `Cập nhật lúc ${timeFormatter.format(fetchedAt)} · ` : ''}Số liệu được cập nhật theo thời gian thực
                </Typography>
              </Stack>
            </Stack>
          </>
        ) : (
          <Box sx={{ minHeight: 120 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{
              p: 2.5, borderRadius: '20px', bgcolor: C.white, border: `1px dashed #C9D7DE`, color: C.body,
            }}>
              <TrendingUpRounded sx={{ color: C.muted }} />
              <Typography sx={{ fontSize: 14.5 }}>Số liệu sẽ hiện ở đây khi máy chủ phản hồi.</Typography>
            </Stack>
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default StatisticsPage;
