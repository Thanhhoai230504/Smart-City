import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, Divider, IconButton,
  LinearProgress, Link, Skeleton, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tabs, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { Close, FileDownload, Gavel } from '@mui/icons-material';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts';
import { toast } from 'react-toastify';
import { departmentApi } from '../../../api/departmentApi';
import {
  DepartmentEvaluation, DepartmentPerformanceDetail, PerformanceEvidenceIssue, PerformanceMetrics,
} from '../../../types';
import { CATEGORY_MAP, DEPARTMENT_SCORE_LABEL_STYLE, STATUS_MAP } from '../../../utils/constants';
import { formatPeriod, PeriodRange } from '../../../utils/period';
import { EVIDENCE_GROUPS, formatDateTime } from '../../../utils/performanceExport';
import { cellSx, headCellSx } from '../types';
import DecisionChip from '../../../components/evaluation/DecisionChip';
import EvaluationHistory from '../../../components/evaluation/EvaluationHistory';
import ScoreChip from './ScoreChip';
import EvaluationFormDialog from './EvaluationFormDialog';
import { exportDetailWorkbook } from './exportDepartmentPerformance';

const DANGER = '#B3261E';
const STAR = '#7D4F05';
const CHART = { assigned: '#397DA5', closed: '#2F7D64', onTime: '#B26A00' };

const fmt = new Intl.NumberFormat('vi-VN');
const dash = '—';
const hours = (h: number | null) => (h === null ? dash : `${h.toLocaleString('vi-VN')} giờ`);

const getErrorMessage = (error: unknown) => (axios.isAxiosError<{ message?: string }>(error)
  ? error.response?.data?.message || 'Không tải được chi tiết đơn vị.'
  : 'Không tải được chi tiết đơn vị.');

const pad = (n: number) => String(n).padStart(2, '0');
/**
 * Nhãn kỳ con theo giờ Việt Nam (UTC+7, không đổi giờ mùa hè) — khớp cách backend gom
 * tuần/tháng, dù trình duyệt đặt múi giờ nào. Không dùng Intl vì Chrome định dạng
 * ngày/tháng vi-VN thành "31-08".
 */
const bucketLabel = (iso: string, unit: 'week' | 'month') => {
  const vn = new Date(new Date(iso).getTime() + 7 * 3600000);
  return unit === 'month'
    ? `Tháng ${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`
    : `Tuần ${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}`;
};

/** Quá hạn bao lâu: theo ngày nếu từ 1 ngày trở lên, không thì theo giờ. */
const overdueFor = (dueAt: string, now: number) => {
  const h = Math.max(0, (now - new Date(dueAt).getTime()) / 3600000);
  return h >= 24 ? `${Math.floor(h / 24)} ngày` : `${Math.max(1, Math.floor(h))} giờ`;
};

const Stat: React.FC<{ label: string; value: React.ReactNode; helper?: string; danger?: boolean }> = ({
  label, value, helper, danger,
}) => (
  <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="h6" fontWeight={700} lineHeight={1.25} sx={{ color: danger ? DANGER : 'text.primary' }}>
      {value}
    </Typography>
    {helper && <Typography variant="caption" color="text.secondary">{helper}</Typography>}
  </Box>
);

const MetricsTable: React.FC<{
  head: string;
  rows: Array<{ key: string; label: React.ReactNode; m: PerformanceMetrics }>;
  empty: string;
}> = ({ head, rows, empty }) => (
  <TableContainer>
    <Table size="small" sx={{ minWidth: 760 }}>
      <TableHead>
        <TableRow>
          <TableCell sx={headCellSx}>{head}</TableCell>
          {['Được giao', 'Đã đóng', 'Đúng hạn', 'Xử lý TB', 'Hài lòng', 'Bị mở lại', 'Quá hạn / đang mở'].map((h) => (
            <TableCell key={h} align="right" sx={headCellSx}>{h}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length === 0 && (
          <TableRow><TableCell colSpan={8} sx={{ ...cellSx, py: 3, textAlign: 'center', color: 'text.secondary' }}>{empty}</TableCell></TableRow>
        )}
        {rows.map(({ key, label, m }) => (
          <TableRow key={key} hover>
            <TableCell sx={cellSx}>{label}</TableCell>
            <TableCell align="right" sx={cellSx}>{fmt.format(m.assigned)}</TableCell>
            <TableCell align="right" sx={cellSx}>{fmt.format(m.closed)}</TableCell>
            <TableCell align="right" sx={cellSx}>
              {m.onTimeRate === null ? dash : `${m.onTimeRate}% (${m.onTime}/${m.resolvedWithDue})`}
            </TableCell>
            <TableCell align="right" sx={cellSx}>{hours(m.avgResolutionHours)}</TableCell>
            <TableCell align="right" sx={cellSx}>
              {m.avgRating === null ? dash : `${m.avgRating.toLocaleString('vi-VN')} ★ (${m.ratingCount})`}
            </TableCell>
            <TableCell align="right" sx={cellSx}>{m.reopened}</TableCell>
            <TableCell align="right" sx={{ ...cellSx, color: m.overdueNow ? DANGER : undefined, fontWeight: m.overdueNow ? 700 : 400 }}>
              {m.overdueNow} / {m.openNow}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

const EvidenceItem: React.FC<{ issue: PerformanceEvidenceIssue; now: number }> = ({ issue: i, now }) => {
  const st = STATUS_MAP[i.status];
  const open = i.status === 'reported' || i.status === 'processing';
  const timing = open && i.dueAt && new Date(i.dueAt).getTime() < now
    ? `quá hạn ${overdueFor(i.dueAt, now)}`
    : i.resolvedAt ? `xong ${formatDateTime(i.resolvedAt)}` : i.dueAt ? `hạn ${formatDateTime(i.dueAt)}` : null;
  const facts = [
    CATEGORY_MAP[i.category]?.label || i.category,
    i.assignee ? `Cán bộ: ${i.assignee.name}` : 'Chưa giao cán bộ',
    timing,
    i.reopenCount ? `mở lại ${i.reopenCount} lần` : null,
    i.escalationLevel >= 2 ? 'đã leo cấp' : null,
  ].filter(Boolean);
  return (
    <Box sx={{ py: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Link component={RouterLink} to={`/issues/${i._id}`} target="_blank" rel="noopener" underline="hover" fontWeight={600}>
          {i.title}
        </Link>
        {st && <Chip size="small" label={st.label} sx={{ bgcolor: st.bg, color: st.text, height: 20, fontSize: '0.7rem' }} />}
      </Stack>
      <Typography variant="caption" color="text.secondary">{facts.join(' · ')}</Typography>
      {i.rating && (
        <Typography variant="body2" sx={{ mt: 0.25 }}>
          <Box component="span" sx={{ color: STAR, letterSpacing: 1 }} aria-label={`${i.rating.score}/5 sao`}>
            {'★'.repeat(i.rating.score)}{'☆'.repeat(5 - i.rating.score)}
          </Box>
          {i.rating.comment ? ` “${i.rating.comment}”` : ''}
        </Typography>
      )}
    </Box>
  );
};

const EvidenceGroups: React.FC<{ d: DepartmentPerformanceDetail; tone: 'attention' | 'bright'; now: number }> = ({ d, tone, now }) => {
  const groups = EVIDENCE_GROUPS.filter((g) => g.tone === tone);
  const total = groups.reduce((s, g) => s + d.evidence[g.key].length, 0);
  if (total === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
        {tone === 'attention' ? 'Không có phiếu nào cần chú ý trong kỳ.' : 'Chưa có phiếu nào được đánh giá 5 sao trong kỳ.'}
      </Typography>
    );
  }
  return (
    <Stack spacing={2}>
      {groups.filter((g) => d.evidence[g.key].length > 0).map((g) => (
        <Box key={g.key}>
          <Typography variant="subtitle2" fontWeight={700}>
            {g.label} ({d.evidence[g.key].length}{d.evidence[g.key].length >= 10 ? '+ — hiện 10 phiếu' : ''})
          </Typography>
          <Stack divider={<Divider flexItem />}>
            {d.evidence[g.key].map((i) => <EvidenceItem key={i._id} issue={i} now={now} />)}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
};

interface TrendTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ dataKey?: string | number; name?: string; value?: number | null }>;
}

const TrendTooltip: React.FC<TrendTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: 'background.paper', p: 1.25, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      {payload.map((p) => (
        <Typography key={String(p.dataKey)} variant="body2" fontWeight={600}>
          {p.name}: {p.value === null || p.value === undefined ? dash : p.dataKey === 'onTimeRate' ? `${p.value}%` : p.value}
        </Typography>
      ))}
    </Box>
  );
};

/**
 * Chi tiết một đơn vị trong kỳ: điểm từng thành phần, xu hướng, theo loại, theo cán
 * bộ và DANH SÁCH PHIẾU làm căn cứ — để lãnh đạo xem từng việc cụ thể trước khi khen
 * thưởng hay phê bình, không chỉ nhìn một con số.
 */
const DepartmentDetailDialog: React.FC<{
  departmentId: string | null;
  fallbackName?: string;
  range: PeriodRange;
  onClose: () => void;
  /** Gọi sau khi ghi / huỷ quyết định để bảng xếp hạng cập nhật nhãn "Đã quyết". */
  onEvaluationsChanged?: () => void;
}> = ({ departmentId, fallbackName, range, onClose, onEvaluationsChanged }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [detail, setDetail] = useState<DepartmentPerformanceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Mốc "bây giờ" chốt theo lần tải, để thời gian quá hạn không nhảy mỗi lần vẽ lại.
  const [now, setNow] = useState(() => Date.now());
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  useEffect(() => {
    if (!departmentId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setDetail(null);
    setTab(0);
    departmentApi.getPerformanceDetail(departmentId, { from: fromIso, to: toIso })
      .then(({ data }) => {
        if (cancelled) return;
        setDetail(data.data);
        setNow(Date.now());
      })
      .catch((e) => { if (!cancelled) setError(getErrorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [departmentId, fromIso, toIso, reloadKey]);

  // Lịch sử quyết định của lãnh đạo (mọi kỳ) — tải riêng để ghi/huỷ xong chỉ tải lại phần này.
  const [evaluations, setEvaluations] = useState<DepartmentEvaluation[]>([]);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState('');
  const [evalKey, setEvalKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (!departmentId) return undefined;
    let cancelled = false;
    setEvalLoading(true);
    setEvalError('');
    setEvaluations([]);
    departmentApi.getEvaluations(departmentId)
      .then(({ data }) => { if (!cancelled) setEvaluations(data.data.evaluations); })
      .catch(() => { if (!cancelled) setEvalError('Không tải được lịch sử quyết định.'); })
      .finally(() => { if (!cancelled) setEvalLoading(false); });
    return () => { cancelled = true; };
  }, [departmentId, evalKey]);

  const refreshEvaluations = () => {
    setEvalKey((k) => k + 1);
    onEvaluationsChanged?.();
  };
  // Quyết định còn hiệu lực cho ĐÚNG kỳ đang xem — có rồi thì phải huỷ trước khi ghi lại.
  const currentDecision = evaluations.find((e) => e.status === 'active' && e.period.from === fromIso && e.period.to === toIso) || null;

  const trendData = useMemo(() => (detail?.trend.buckets || []).map((b) => ({
    label: bucketLabel(b.start, detail?.trend.unit || 'week'),
    assigned: b.assigned,
    closed: b.closed,
    onTimeRate: b.resolvedWithDue ? Math.round((b.onTime / b.resolvedWithDue) * 100) : null,
  })), [detail]);

  const attentionCount = detail
    ? EVIDENCE_GROUPS.filter((g) => g.tone === 'attention').reduce((s, g) => s + detail.evidence[g.key].length, 0)
    : 0;

  const handleExport = async () => {
    if (!detail) return;
    setExporting(true);
    try {
      await exportDetailWorkbook(detail, evaluations);
    } catch {
      toast.error('Không xuất được file Excel');
    } finally {
      setExporting(false);
    }
  };

  const d = detail;
  const m = d?.metrics;
  const style = d ? DEPARTMENT_SCORE_LABEL_STYLE[d.score.label] : null;
  const periodText = formatPeriod(d ? { from: new Date(d.period.from), to: new Date(d.period.to) } : range);

  return (
    <Dialog open={Boolean(departmentId)} onClose={onClose} fullWidth maxWidth="lg" fullScreen={fullScreen} scroll="paper">
      <DialogTitle sx={{ pr: 7 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
          <Box>
            <Typography variant="h6" fontWeight={700}>{d?.department.name || fallbackName || 'Chi tiết đơn vị'}</Typography>
            <Typography variant="caption" color="text.secondary">
              {[d?.department.code, `Kỳ ${periodText}`, d?.department.email, d?.department.phone].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {currentDecision ? (
              <Tooltip title="Đã có quyết định cho kỳ này. Muốn đổi: huỷ quyết định ở tab Quyết định rồi ghi lại.">
                <span><DecisionChip decision={currentDecision.decision} prefix="Đã quyết:" /></span>
              </Tooltip>
            ) : (
              <Button
                size="small" variant="contained" startIcon={<Gavel />}
                onClick={() => setFormOpen(true)} disabled={!d}
              >
                Ghi quyết định
              </Button>
            )}
            <Button
              size="small" variant="outlined" startIcon={exporting ? <CircularProgress size={14} /> : <FileDownload />}
              onClick={handleExport} disabled={!d || exporting}
            >
              Xuất Excel
            </Button>
          </Stack>
        </Stack>
        <IconButton aria-label="Đóng" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setReloadKey((k) => k + 1)}>Thử lại</Button>}>
            {error}
          </Alert>
        )}
        {loading && (
          <Stack spacing={1.5}>
            <Skeleton variant="rounded" height={120} />
            <Skeleton variant="rounded" height={80} />
            <Skeleton variant="rounded" height={240} />
          </Stack>
        )}

        {d && m && style && (
          <Stack spacing={2.5}>
            {/* Điểm và từng thành phần */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '210px 1fr' }, gap: 2 }}>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: style.bg, color: style.text, textAlign: 'center' }}>
                <Typography variant="caption" fontWeight={600}>Điểm gợi ý</Typography>
                <Typography sx={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>{d.score.score ?? dash}</Typography>
                <Typography variant="caption">/ 100</Typography>
                <Box mt={1}><ScoreChip score={d.score} size="medium" /></Box>
              </Box>
              <Stack spacing={1.25}>
                {d.score.score === null && (
                  <Typography variant="caption" color="text.secondary">
                    Chưa xếp hạng — các thành phần dưới đây chỉ để tham khảo.
                  </Typography>
                )}
                {d.score.components.map((c) => (
                  <Box key={c.key}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.5}>
                      <Typography variant="body2" fontWeight={600}>{c.label}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {c.value === null
                          ? 'Chưa tính — thiếu dữ liệu'
                          : `đạt ${Math.round(c.value * 100)}% × trọng số ${Math.round(c.weight * 100)}% = ${c.points.toLocaleString('vi-VN')} điểm`}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate" value={c.value === null ? 0 : c.value * 100}
                      aria-label={`${c.label}: ${c.value === null ? 'chưa tính' : `${Math.round(c.value * 100)}%`}`}
                      sx={{ height: 6, borderRadius: 3, bgcolor: '#E6EBEF', '& .MuiLinearProgress-bar': { bgcolor: style.text } }}
                    />
                  </Box>
                ))}
                {d.score.attention.length > 0 && (
                  <Alert severity="warning" sx={{ py: 0 }}>
                    {d.score.attention.map((a) => <div key={a}>{a}</div>)}
                  </Alert>
                )}
                {d.score.reasons.length > 0 && (
                  <Alert severity="info" variant="outlined" sx={{ py: 0 }}>
                    {d.score.reasons.map((r) => <div key={r}>{r}</div>)}
                  </Alert>
                )}
              </Stack>
            </Box>

            {/* Số liệu trong kỳ */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }}>
              <Stat label="Được giao trong kỳ" value={fmt.format(m.assigned)} />
              <Stat label="Đã đóng trong kỳ" value={fmt.format(m.closed)} helper={`${m.resolved} xử lý xong · ${m.rejected} từ chối`} />
              <Stat
                label="Đúng hạn" value={m.onTimeRate === null ? dash : `${m.onTimeRate}%`}
                helper={m.resolvedWithDue ? `${m.onTime}/${m.resolvedWithDue} việc có hạn` : 'Chưa có việc xong nào có hạn'}
              />
              <Stat label="Xử lý trung bình" value={hours(m.avgResolutionHours)} helper="Từ lúc giao đến lúc xong" />
              <Stat
                label="Hài lòng" value={m.avgRating === null ? dash : `${m.avgRating.toLocaleString('vi-VN')} ★`}
                helper={`${m.ratingCount} lượt đánh giá · ${m.lowRatings} lượt ≤ 2 sao`}
              />
              <Stat
                label="Bị mở lại (khiếu nại)" value={fmt.format(m.reopened)} danger={m.reopened > 0}
                helper={m.complaintRate === null ? undefined : `Tỷ lệ ${m.complaintRate}% (${m.reopened}/${m.closed + m.reopened} việc đã đóng hoặc bị mở lại)`}
              />
              <Stat
                label="Quá hạn / đang mở" value={`${m.overdueNow} / ${m.openNow}`} danger={m.overdueNow > 0}
                helper={`Hiện tại · ${m.escalatedOpen} việc bị leo cấp`}
              />
              <Stat label="Bị lấy việc" value={fmt.format(m.revoked)} helper="Thu hồi / chuyển đơn vị (từ 02/10/2026)" />
            </Box>

            {/* Xu hướng */}
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                Xu hướng theo {d.trend.unit === 'week' ? 'tuần' : 'tháng'}
              </Typography>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#E3E9ED" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#627481', fontSize: 11 }} minTickGap={16} />
                  <YAxis yAxisId="count" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#627481', fontSize: 11 }} />
                  <YAxis
                    yAxisId="rate" orientation="right" domain={[0, 100]} unit="%"
                    axisLine={false} tickLine={false} tick={{ fill: '#627481', fontSize: 11 }}
                  />
                  <RTooltip content={<TrendTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="count" dataKey="assigned" name="Được giao" fill={CHART.assigned} radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Bar yAxisId="count" dataKey="closed" name="Đã đóng" fill={CHART.closed} radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Line
                    yAxisId="rate" dataKey="onTimeRate" name="Đúng hạn (%)" stroke={CHART.onTime} strokeWidth={2}
                    dot={{ r: 3, fill: CHART.onTime }} connectNulls={false} type="monotone"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>

            {/* Chi tiết theo loại / cán bộ / bằng chứng */}
            <Box>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tab label="Theo loại sự cố" />
                <Tab label={`Cán bộ (${d.staff.length})`} />
                <Tab label={`Cần chú ý (${attentionCount})`} />
                <Tab label={`Điểm sáng (${d.evidence.praised.length})`} />
                <Tab label={`Quyết định (${evaluations.length})`} />
              </Tabs>
              <Box sx={{ pt: 1.5 }}>
                {tab === 0 && (
                  <MetricsTable
                    head="Loại sự cố" empty="Không có việc nào trong kỳ."
                    rows={d.byCategory.map((c) => ({ key: c.category, label: CATEGORY_MAP[c.category]?.label || c.category, m: c.metrics }))}
                  />
                )}
                {tab === 1 && (
                  <Stack spacing={1}>
                    <Alert severity="info" variant="outlined" sx={{ py: 0 }}>
                      Số liệu cán bộ chỉ để tham khảo, hệ thống không chấm điểm cá nhân: độ khó từng việc khác nhau và
                      việc có thể được giao lại giữa các cán bộ.
                    </Alert>
                    <MetricsTable
                      head="Cán bộ" empty="Đơn vị chưa có cán bộ."
                      rows={d.staff.map((s) => ({
                        key: s.userId,
                        m: s.metrics,
                        label: (
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                              <Typography variant="caption" color="text.secondary">{s.email}</Typography>
                              {s.movedOut && <Chip size="small" label="Đã chuyển đơn vị" sx={{ height: 18, fontSize: '0.65rem' }} />}
                              {!s.isActive && <Chip size="small" label="Đã khoá" sx={{ height: 18, fontSize: '0.65rem' }} />}
                            </Stack>
                          </Box>
                        ),
                      }))}
                    />
                  </Stack>
                )}
                {tab === 2 && <EvidenceGroups d={d} tone="attention" now={now} />}
                {tab === 3 && <EvidenceGroups d={d} tone="bright" now={now} />}
                {tab === 4 && departmentId && (
                  <EvaluationHistory
                    departmentId={departmentId} evaluations={evaluations} loading={evalLoading} error={evalError}
                    canRevoke onChanged={refreshEvaluations}
                  />
                )}
              </Box>
            </Box>
          </Stack>
        )}
      </DialogContent>

      {d && departmentId && (
        <EvaluationFormDialog
          open={formOpen} departmentId={departmentId} departmentName={d.department.name}
          range={range} score={d.score}
          onClose={() => setFormOpen(false)}
          onSaved={() => { refreshEvaluations(); setTab(4); }}
        />
      )}
    </Dialog>
  );
};

export default DepartmentDetailDialog;
