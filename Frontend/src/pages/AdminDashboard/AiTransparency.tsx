import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Grid,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { GavelOutlined, HubOutlined, InsightsOutlined, SortOutlined } from '@mui/icons-material';
import { issueApi } from '../../api/issueApi';
import { DuplicateConfig, DuplicateMetrics, PriorityConfig } from '../../types';
import { GlassCard } from './types';

// Khoá trọng số ở API là camelCase, khác mã factor snake_case của PRIORITY_FACTOR_LABELS.
const PRIORITY_WEIGHT_LABELS: Record<string, string> = {
  severity: 'Mức nghiêm trọng theo loại sự cố',
  ageSla: 'Thời gian tồn đọng / sát hạn SLA',
  votes: 'Lượt ủng hộ của người dân',
  nearbyDensity: 'Mật độ sự cố đang mở xung quanh',
  sensitivePlace: 'Gần bệnh viện / trường học',
};

const DUPLICATE_WEIGHT_LABELS: Record<string, string> = {
  semantic: 'Độ giống nội dung (embedding)',
  geo: 'Khoảng cách địa lý',
  category: 'Cùng loại sự cố',
  recency: 'Thời điểm báo cáo gần nhau',
};

const pct = (value: number) => `${Math.round(value * 100)}%`;
const dateTime = (iso: string) => new Date(iso).toLocaleString('vi-VN');

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; version?: string }> = ({
  icon, title, subtitle, version,
}) => (
  <Stack direction="row" spacing={1.25} alignItems="flex-start" mb={2}>
    <Box sx={{ color: 'primary.main', mt: 0.25 }} aria-hidden>{icon}</Box>
    <Box sx={{ flex: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="h6" component="h2">{title}</Typography>
        {version && <Chip size="small" label={version} variant="outlined" />}
      </Stack>
      <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
    </Box>
  </Stack>
);

const WeightBars: React.FC<{ weights: Record<string, number>; labels: Record<string, string> }> = ({ weights, labels }) => (
  <Stack spacing={1.5}>
    {Object.entries(weights)
      .sort(([, a], [, b]) => b - a)
      .map(([key, weight]) => (
        <Box key={key}>
          <Stack direction="row" justifyContent="space-between" mb={0.5}>
            <Typography variant="body2">{labels[key] || key}</Typography>
            <Typography variant="body2" fontWeight={700}>{pct(weight)}</Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={weight * 100}
            aria-label={`${labels[key] || key}: ${pct(weight)}`}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      ))}
  </Stack>
);

const Metric: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, height: '100%' }}>
    <Typography variant="caption" color="text.secondary" component="p">{label}</Typography>
    <Typography variant="h6" component="p" fontWeight={700}>{value}</Typography>
    {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
  </Box>
);

/**
 * Minh bạch AI — trả lời câu hỏi "AI quyết định thế nào?" bằng cấu hình THẬT
 * đang chạy, không phải mô tả viết tay có thể lệch code.
 *
 * Ba nguồn: cấu hình điểm ưu tiên, cấu hình dò trùng, và số liệu vận hành của
 * dò trùng. Lưu ý trung thực đã ghi ngay trên giao diện:
 * - Số liệu vận hành nằm trong RAM của server, reset mỗi lần khởi động lại.
 * - Đó KHÔNG phải precision/recall. Precision/recall chỉ có khi chạy
 *   `npm run evaluate:duplicates` trên tập cặp đã gắn nhãn.
 */
const AiTransparency: React.FC = () => {
  const [priority, setPriority] = useState<PriorityConfig | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateConfig | null>(null);
  const [metrics, setMetrics] = useState<DuplicateMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);

  useEffect(() => {
    let stale = false;
    (async () => {
      const [p, d, m] = await Promise.allSettled([
        issueApi.getPriorityConfig(),
        issueApi.getDuplicateConfig(),
        issueApi.getDuplicateMetrics(),
      ]);
      if (stale) return;
      const errors: string[] = [];
      if (p.status === 'fulfilled') setPriority(p.value.data.data.config); else errors.push('cấu hình điểm ưu tiên');
      if (d.status === 'fulfilled') setDuplicate(d.value.data.data.config); else errors.push('cấu hình dò trùng');
      if (m.status === 'fulfilled') setMetrics(m.value.data.data.metrics); else errors.push('số liệu vận hành');
      setFailed(errors);
      setLoading(false);
    })();
    return () => { stale = true; };
  }, []);

  if (loading) {
    return (
      <Stack spacing={2.5}>
        {[160, 320, 320].map((h, i) => <Skeleton key={i} variant="rounded" height={h} />)}
      </Stack>
    );
  }

  const modeTotal = metrics ? metrics.embeddingRequests + metrics.mixedRequests + metrics.fallbackRequests : 0;

  return (
    <Stack spacing={2.5}>
      {failed.length > 0 && (
        <Alert severity="warning">Không tải được: {failed.join(', ')}.</Alert>
      )}

      <GlassCard sx={{ p: 2.5 }}>
        <SectionTitle
          icon={<GavelOutlined />}
          title="Nguyên tắc: AI chỉ hỗ trợ, không tự ra quyết định"
          subtitle="Hai chức năng dùng thuật toán trong hệ thống đều dừng ở bước gợi ý"
        />
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography fontWeight={600} mb={0.5}>Điểm ưu tiên</Typography>
            <Typography variant="body2" color="text.secondary">
              Chỉ dùng để <strong>sắp xếp</strong> hàng chờ. Phân công, đổi trạng thái hay từ chối
              vẫn do quản trị viên và cán bộ quyết định. Mỗi điểm đều kèm danh sách yếu tố đã cộng vào,
              xem được ở từng sự cố.
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography fontWeight={600} mb={0.5}>Phát hiện trùng lặp</Typography>
            <Typography variant="body2" color="text.secondary">
              Chỉ <strong>đề xuất</strong> sự cố có thể trùng. Hệ thống không bao giờ tự gộp: người dân
              xác nhận &quot;đây là cùng một sự cố&quot;, hoặc quản trị viên xem hai báo cáo cạnh nhau rồi mới gộp.
              Khi dịch vụ embedding lỗi, hệ thống chuyển sang so khớp từ khoá thay vì chặn người dân gửi báo cáo.
            </Typography>
          </Grid>
        </Grid>
      </GlassCard>

      <Grid container spacing={2.5}>
        {priority && (
          <Grid item xs={12} lg={6}>
            <GlassCard sx={{ p: 2.5, height: '100%' }}>
              <SectionTitle
                icon={<SortOutlined />}
                title="Điểm ưu tiên xử lý"
                subtitle="Thang 0–100, cộng có trọng số từ 5 yếu tố"
                version={priority.version}
              />
              <WeightBars weights={priority.weights} labels={PRIORITY_WEIGHT_LABELS} />
              <Typography variant="subtitle2" mt={2.5} mb={1}>Ngưỡng phân mức</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`Khẩn cấp ≥ ${priority.thresholds.critical}`} />
                <Chip size="small" label={`Cao ≥ ${priority.thresholds.high}`} />
                <Chip size="small" label={`Trung bình ≥ ${priority.thresholds.medium}`} />
                <Chip size="small" label={`Thấp < ${priority.thresholds.medium}`} />
              </Stack>
              <Typography variant="body2" color="text.secondary" mt={2}>
                Mật độ tính trong bán kính {priority.geo.nearbyRadiusMeters} m (tối đa {priority.geo.nearbyDensityCap} sự cố).
                Điểm nhạy cảm xét bệnh viện, trường học trong {priority.geo.sensitiveRadiusMeters} m.
                Lượt ủng hộ chuẩn hoá và chặn ở {priority.voteCap} để không lấn át yếu tố an toàn.
              </Typography>
            </GlassCard>
          </Grid>
        )}

        {duplicate && (
          <Grid item xs={12} lg={6}>
            <GlassCard sx={{ p: 2.5, height: '100%' }}>
              <SectionTitle
                icon={<HubOutlined />}
                title="Phát hiện sự cố trùng lặp"
                subtitle={`Mô hình ${duplicate.model} (${duplicate.dimensions} chiều) qua ${duplicate.provider}`}
                version={duplicate.version}
              />
              <WeightBars weights={duplicate.weights} labels={DUPLICATE_WEIGHT_LABELS} />
              <Typography variant="subtitle2" mt={2.5} mb={1}>Ngưỡng độ tin cậy</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`Cao ≥ ${duplicate.thresholds.high}`} />
                <Chip size="small" label={`Có thể ≥ ${duplicate.thresholds.possible}`} />
                <Chip size="small" label={`Bỏ qua < ${duplicate.thresholds.minimum}`} />
              </Stack>
              <Typography variant="body2" color="text.secondary" mt={2}>
                Bước 1 lọc theo vị trí: tối đa {duplicate.candidates.maxGeoCandidates} sự cố đang mở trong{' '}
                {duplicate.candidates.radiusMeters} m và {duplicate.candidates.recencyWindowDays} ngày gần nhất.
                Bước 2 mới so nội dung, trả tối đa {duplicate.candidates.maxResults} gợi ý.
              </Typography>
            </GlassCard>
          </Grid>
        )}
      </Grid>

      {metrics && (
        <GlassCard sx={{ p: 2.5 }}>
          <SectionTitle
            icon={<InsightsOutlined />}
            title="Số liệu vận hành của dò trùng"
            subtitle={`Tính từ lần khởi động server lúc ${dateTime(metrics.startedAt)}`}
          />
          {metrics.requests === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Chưa có lượt dò trùng nào kể từ lần khởi động này.
            </Typography>
          ) : (
            <Grid container spacing={1.5}>
              <Grid item xs={6} md={3}><Metric label="Lượt dò trùng" value={String(metrics.requests)} /></Grid>
              <Grid item xs={6} md={3}><Metric label="Thời gian TB" value={`${metrics.avgLatencyMs} ms`} /></Grid>
              <Grid item xs={6} md={3}><Metric label="Gợi ý TB mỗi lượt" value={String(metrics.avgCandidates)} /></Grid>
              <Grid item xs={6} md={3}>
                <Metric
                  label="Người dân xác nhận trùng"
                  value={`${metrics.confirmationRate}%`}
                  hint={`${metrics.confirmations} lượt`}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <Metric
                  label="Phải dùng phương án dự phòng"
                  value={`${metrics.fallbackRate}%`}
                  hint={modeTotal ? `${metrics.fallbackRequests}/${modeTotal} lượt` : undefined}
                />
              </Grid>
              <Grid item xs={6} md={3}><Metric label="Lỗi dịch vụ embedding" value={`${metrics.providerErrorRate}%`} /></Grid>
              <Grid item xs={6} md={3}><Metric label="Cache embedding trúng" value={`${metrics.cacheHitRate}%`} /></Grid>
              <Grid item xs={6} md={3}><Metric label="Quản trị viên gộp" value={`${metrics.mergeRate}%`} hint={`${metrics.merges} lượt`} /></Grid>
            </Grid>
          )}
          <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
            Đây là số liệu <strong>vận hành</strong>, lưu trong bộ nhớ và reset khi server khởi động lại —{' '}
            <strong>không phải độ chính xác</strong>. Precision/recall chỉ đo được bằng{' '}
            <code>npm run evaluate:duplicates</code> trên tập cặp sự cố đã gắn nhãn đúng/sai.
          </Alert>
        </GlassCard>
      )}
    </Stack>
  );
};

export default AiTransparency;
