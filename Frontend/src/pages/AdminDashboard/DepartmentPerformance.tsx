import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Business,
  CheckCircle,
  FileDownload,
  Groups,
  Refresh,
  TaskAlt,
  WarningAmber,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { departmentApi } from '../../api/departmentApi';
import { DepartmentPerformanceResponse, DepartmentPerformanceRow } from '../../types';
import { formatPeriod, getPeriodRange, PeriodRange, PeriodValue } from '../../utils/period';
import { GlassCard } from './types';
import DepartmentRankingTable from './performance/DepartmentRankingTable';
import DepartmentDetailDialog from './performance/DepartmentDetailDialog';
import PeriodPicker from './performance/PeriodPicker';
import ScoreCriteria from './performance/ScoreCriteria';
import { exportRankingWorkbook } from './performance/exportDepartmentPerformance';

interface ApiErrorResponse {
  message?: string;
}

const numberFormatter = new Intl.NumberFormat('vi-VN');

const getErrorMessage = (error: unknown) => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return 'Không thể tải bảng hiệu suất đơn vị.';
  }
  return error.response?.data?.message || 'Không thể tải bảng hiệu suất đơn vị.';
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

// "30 ngày qua" thay vì "Tháng này": những ngày đầu tháng, kỳ "Tháng này" gần như
// chưa có việc nào đóng nên mọi đơn vị đều "Chưa đủ dữ liệu".
const DEFAULT_PERIOD: PeriodValue = { preset: 'last30' };

/**
 * Đánh giá hiệu quả đơn vị THEO KỲ: xếp hạng, gợi ý khen thưởng / nhắc nhở và căn cứ
 * từng phiếu. Điểm chỉ là gợi ý — tiêu chí hiển thị ngay trên trang (ScoreCriteria),
 * quyết định do lãnh đạo.
 */
const DepartmentPerformance: React.FC = () => {
  const [period, setPeriod] = useState<PeriodValue>(DEFAULT_PERIOD);
  // Kỳ chốt thành mốc thời gian cụ thể mỗi lần đổi kỳ hoặc bấm làm mới ("tháng này"
  // kết thúc ở "bây giờ" — tính lại mỗi lần vẽ thì sẽ gọi API liên tục).
  const [range, setRange] = useState<PeriodRange>(() => getPeriodRange(DEFAULT_PERIOD));
  const [data, setData] = useState<DepartmentPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<DepartmentPerformanceRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: response } = await departmentApi.getPerformance({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      });
      setData(response.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const changePeriod = (next: PeriodValue) => {
    setPeriod(next);
    setRange(getPeriodRange(next));
  };

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportRankingWorkbook(data);
    } catch {
      toast.error('Không xuất được file Excel');
    } finally {
      setExporting(false);
    }
  };

  const stats = useMemo(() => data?.rows ?? [], [data]);
  const ranked = stats.filter((item) => item.rank !== null).length;

  // Được giao và hoàn tất tính TRONG KỲ; đang xử lý và quá hạn là số HIỆN TẠI.
  const totals = useMemo(() => stats.reduce(
    (result, item) => ({
      activeUnits: result.activeUnits + (item.isActive ? 1 : 0),
      total: result.total + item.metrics.assigned,
      processing: result.processing + item.metrics.openNow,
      resolved: result.resolved + item.metrics.resolved,
      overdue: result.overdue + item.metrics.overdueNow,
    }),
    { activeUnits: 0, total: 0, processing: 0, resolved: 0, overdue: 0 },
  ), [stats]);

  const periodText = formatPeriod(data ? { from: new Date(data.period.from), to: new Date(data.period.to) } : range);

  return (
    <Stack spacing={2.5}>
      {/* Tiêu đề trang do khung quản trị hiển thị (TAB_HEADINGS) — ở đây chỉ còn thanh công cụ. */}
      <Stack spacing={1}>
        <Stack
          direction="row"
          spacing={1.5}
          useFlexGap
          flexWrap="wrap"
          alignItems="flex-start"
          justifyContent="space-between"
        >
          <Box sx={{ flexGrow: { xs: 1, sm: 0 } }}>
            <PeriodPicker value={period} onChange={changePeriod} disabled={loading} />
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Tải lại số liệu">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => setRange(getPeriodRange(period))}
                  disabled={loading}
                  sx={{ height: 40, whiteSpace: 'nowrap' }}
                >
                  Làm mới
                </Button>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <FileDownload />}
              onClick={handleExport}
              disabled={!data || exporting}
              sx={{ height: 40, whiteSpace: 'nowrap' }}
            >
              Xuất Excel
            </Button>
          </Stack>
        </Stack>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Xếp hạng kỳ {periodText}, kèm danh sách phiếu làm căn cứ để xem xét khen thưởng hoặc nhắc nhở.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            “Tổng việc” và “Đã hoàn tất” tính trong kỳ; “Đang xử lý” và “Đang quá hạn” là số hiện tại.
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))',
            lg: 'repeat(5, minmax(0, 1fr))',
          },
          gap: 2,
        }}
      >
        <SummaryCard
          icon={<Business />}
          label="Đơn vị hoạt động"
          value={totals.activeUnits}
          color="#0B5E8E"
          helper={`${numberFormatter.format(stats.length)} đơn vị tổng cộng`}
        />
        <SummaryCard
          icon={<TaskAlt />}
          label="Tổng việc"
          value={totals.total}
          color="#397DA5"
          helper="Đã giao cho các đơn vị"
        />
        <SummaryCard
          icon={<Groups />}
          label="Đang xử lý"
          value={totals.processing}
          color="#B26A00"
          helper="Gồm việc mới và đang làm"
        />
        <SummaryCard
          icon={<CheckCircle />}
          label="Đã hoàn tất"
          value={totals.resolved}
          color="#2F7D64"
          helper="Đã xử lý xong"
        />
        <SummaryCard
          icon={<WarningAmber />}
          label="Đang quá hạn"
          value={totals.overdue}
          color="#C62828"
          helper="Việc mở đã quá SLA"
        />
      </Box>

      <ScoreCriteria config={data?.config ?? null} />

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
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #DCE7EB' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={0.5}
            justifyContent="space-between"
          >
            <Typography variant="h6" fontWeight={700}>
              Bảng xếp hạng
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {ranked}/{stats.length} đơn vị đủ dữ liệu để xếp hạng
            </Typography>
          </Stack>
        </Box>

        <DepartmentRankingTable rows={stats} loading={loading} onOpen={setSelected} />

        <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#F7FAFA' }}>
          <Typography variant="caption" color="text.secondary">
            Đúng hạn tính trên các việc đã xong có hạn xử lý. Thời gian xử lý tính từ lúc phân công đến khi
            hoàn tất. Dấu “—” là chưa có dữ liệu, không phải 0. Bấm vào một đơn vị để xem chi tiết và danh sách
            phiếu làm căn cứ.
          </Typography>
        </Box>
      </GlassCard>

      <DepartmentDetailDialog
        departmentId={selected ? String(selected.departmentId) : null}
        fallbackName={selected?.name}
        range={range}
        onClose={() => setSelected(null)}
        onEvaluationsChanged={loadStats}
      />
    </Stack>
  );
};

export default DepartmentPerformance;
