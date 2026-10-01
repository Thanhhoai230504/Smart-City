import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Email } from '@mui/icons-material';
import { dashboardApi } from '../../api/dashboardApi';

type ReportType = 'weekly' | 'monthly';

interface ReportStats {
  total: number;
  resolved: number;
  avgResolveTime: number;
  dateRange: string;
}

interface ReportPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onSent: (message: string) => void;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<{ message?: string }>(error)) return fallback;
  return error.response?.data?.message || fallback;
};

/**
 * Xem trước báo cáo rồi mới gửi.
 *
 * Gửi báo cáo là thao tác KHÔNG hoàn tác được: email đi tới mọi quản trị viên
 * đang hoạt động. Trước đây nút "Gửi báo cáo" gửi thẳng mà không cho xem nội
 * dung, dù API xem trước đã có sẵn.
 *
 * HTML do server dựng từ dữ liệu người dùng, nên render trong iframe
 * `sandbox=""` — chặn script, chặn form, và tách khỏi origin của ứng dụng (không
 * đọc được localStorage nơi lưu access token). Không dùng dangerouslySetInnerHTML.
 */
const ReportPreviewDialog: React.FC<ReportPreviewDialogProps> = ({ open, onClose, onSent }) => {
  const [type, setType] = useState<ReportType>('weekly');
  const [html, setHtml] = useState('');
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Đổi loại báo cáo nhanh tạo hai request chồng nhau; chỉ nhận phản hồi mới nhất.
    let stale = false;
    setLoading(true);
    setError('');
    setHtml('');
    setStats(null);

    dashboardApi.previewReport(type)
      .then(({ data }) => {
        if (stale) return;
        setHtml(data.data.html);
        setStats(data.data.stats);
      })
      .catch((err) => {
        if (!stale) setError(getErrorMessage(err, 'Không thể tạo bản xem trước báo cáo.'));
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });

    return () => { stale = true; };
  }, [open, type]);

  const handleSend = async () => {
    setSending(true);
    setError('');
    try {
      const { data } = await dashboardApi.sendReport(type);
      onSent(data.message || 'Đã gửi báo cáo đến email quản trị.');
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể gửi báo cáo. Vui lòng thử lại.'));
    } finally {
      setSending(false);
    }
  };

  const label = type === 'weekly' ? 'tuần' : 'tháng';

  return (
    <Dialog
      open={open}
      onClose={sending ? undefined : onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: { bgcolor: '#FFFFFF', border: '1px solid #DCE7EB', borderRadius: '16px' } }}
    >
      <DialogTitle>Xem trước báo cáo</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={type}
            onChange={(_, value: ReportType | null) => value && setType(value)}
            disabled={sending}
            aria-label="Loại báo cáo"
          >
            <ToggleButton value="weekly">Báo cáo tuần</ToggleButton>
            <ToggleButton value="monthly">Báo cáo tháng</ToggleButton>
          </ToggleButtonGroup>

          {stats && (
            <Typography variant="body2" color="text.secondary">
              Kỳ {stats.dateRange} · {stats.total} sự cố mới · {stats.resolved} đã xử lý
              {stats.resolved > 0 && ` · trung bình ${stats.avgResolveTime} giờ`}
            </Typography>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <Box
            sx={{
              position: 'relative',
              height: { xs: 360, sm: 480 },
              borderRadius: '10px',
              border: '1px solid #DCE7EB',
              overflow: 'hidden',
              bgcolor: '#1a1a2e',
            }}
          >
            {loading && (
              <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0 }}>
                <CircularProgress size={28} />
              </Stack>
            )}
            {html && (
              <iframe
                title={`Xem trước báo cáo ${label}`}
                srcDoc={html}
                sandbox=""
                style={{ width: '100%', height: '100%', border: 0 }}
              />
            )}
          </Box>

          <Alert severity="warning" variant="outlined">
            Báo cáo sẽ được gửi tới <strong>tất cả quản trị viên đang hoạt động</strong>. Email đã gửi không thu hồi được.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={sending} sx={{ color: 'text.secondary' }}>
          Huỷ
        </Button>
        <Button
          variant="contained"
          startIcon={sending ? <CircularProgress size={14} color="inherit" /> : <Email />}
          disabled={sending || loading || !html}
          onClick={handleSend}
        >
          {sending ? 'Đang gửi...' : `Gửi báo cáo ${label}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReportPreviewDialog;
