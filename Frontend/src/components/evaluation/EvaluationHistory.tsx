import React, { useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import { History, Undo } from '@mui/icons-material';
import { departmentApi } from '../../api/departmentApi';
import { DepartmentEvaluation } from '../../types';
import { DEPARTMENT_SCORE_LABEL_STYLE } from '../../utils/constants';
import { DECISION_LABEL, EVALUATION_LIMITS } from '../../utils/evaluation';
import { formatPeriod } from '../../utils/period';
import { formatDateTime } from '../../utils/performanceExport';
import DecisionChip from './DecisionChip';
import { getApiErrorMessage } from '../../utils/apiError';

const nameOf = (u: DepartmentEvaluation['decidedBy'] | null) => (u && typeof u === 'object' ? u.name : 'Không rõ');
const periodText = (p: DepartmentEvaluation['period']) => formatPeriod({ from: new Date(p.from), to: new Date(p.to) });

/** Số liệu đã chụp lúc quyết — đọc lại để biết vì sao hồi đó quyết như vậy. */
const SnapshotLine: React.FC<{ e: DepartmentEvaluation }> = ({ e }) => {
  const m = e.snapshot?.metrics;
  if (!m) return null;
  const parts = [
    `đóng ${m.closed} việc`,
    m.onTimeRate === null ? null : `đúng hạn ${m.onTimeRate}%`,
    m.avgRating === null ? null : `hài lòng ${m.avgRating.toLocaleString('vi-VN')}★`,
    `bị mở lại ${m.reopened}`,
    `quá hạn ${m.overdueNow}/${m.openNow}`,
  ].filter(Boolean);
  return (
    <Typography variant="caption" color="text.secondary" display="block">
      Số liệu lúc quyết: {parts.join(' · ')}
    </Typography>
  );
};

const EvaluationItem: React.FC<{ e: DepartmentEvaluation; canRevoke: boolean; onRevoke: (e: DepartmentEvaluation) => void }> = ({
  e, canRevoke, onRevoke,
}) => {
  const revoked = e.status === 'revoked';
  const sugStyle = DEPARTMENT_SCORE_LABEL_STYLE[e.suggestion.label];
  return (
    <Box sx={{ p: 1.75, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: revoked ? '#F7F9FA' : 'background.paper' }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <DecisionChip decision={e.decision} struck={revoked} />
        <Typography variant="body2" fontWeight={650}>Kỳ {periodText(e.period)}</Typography>
        {revoked && <Chip size="small" label="Đã huỷ" sx={{ height: 20, fontSize: '0.7rem' }} />}
        <Box sx={{ flexGrow: 1 }} />
        {canRevoke && !revoked && (
          <Button size="small" color="inherit" startIcon={<Undo />} onClick={() => onRevoke(e)}>
            Huỷ quyết định
          </Button>
        )}
      </Stack>
      <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-line', color: revoked ? 'text.secondary' : 'text.primary' }}>
        {e.content}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
        {nameOf(e.decidedBy)} · {formatDateTime(e.createdAt)}{e.documentNumber ? ` · Số văn bản: ${e.documentNumber}` : ''}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        Gợi ý của hệ thống lúc quyết:{' '}
        <Box component="span" sx={{ color: sugStyle.text, fontWeight: 650 }}>{e.suggestion.labelText}</Box>
        {e.suggestion.score !== null ? ` (${e.suggestion.score} điểm)` : ''}
        {e.deviatesFromSuggestion ? ' — quyết định khác gợi ý' : ' — quyết định theo gợi ý'}
      </Typography>
      {e.deviatesFromSuggestion && e.deviationReason && (
        <Typography variant="caption" display="block" sx={{ mt: 0.25 }}>
          <strong>Lý do:</strong> {e.deviationReason}
        </Typography>
      )}
      <SnapshotLine e={e} />
      {revoked && (
        <Alert severity="info" variant="outlined" sx={{ mt: 1, py: 0 }}>
          Đã huỷ bởi {nameOf(e.revokedBy)} lúc {formatDateTime(e.revokedAt)}. Lý do: {e.revokeReason}
        </Alert>
      )}
    </Box>
  );
};

/**
 * Lịch sử quyết định khen thưởng / phê bình của một đơn vị — dùng ở hộp thoại chi tiết
 * (quản trị viên, có nút huỷ) và màn hình cán bộ (chỉ xem). Không có nút sửa hay xoá.
 */
const EvaluationHistory: React.FC<{
  departmentId: string;
  evaluations: DepartmentEvaluation[];
  loading: boolean;
  error?: string;
  canRevoke: boolean;
  onChanged?: () => void;
}> = ({ departmentId, evaluations, loading, error, canRevoke, onChanged }) => {
  const [target, setTarget] = useState<DepartmentEvaluation | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [revokeError, setRevokeError] = useState('');
  const L = EVALUATION_LIMITS;
  const reasonOk = reason.trim().length >= L.revokeMin && reason.trim().length <= L.revokeMax;

  const openRevoke = (e: DepartmentEvaluation) => {
    setTarget(e);
    setReason('');
    setRevokeError('');
  };

  const submitRevoke = async () => {
    if (!target || !reasonOk) return;
    setSaving(true);
    setRevokeError('');
    try {
      await departmentApi.revokeEvaluation(departmentId, target._id, reason.trim());
      // Phản hồi tại chỗ: mục vừa huỷ hiện nhãn "Đã huỷ" (không dùng toast — xem EvaluationFormDialog).
      setTarget(null);
      onChanged?.();
    } catch (err) {
      setRevokeError(getApiErrorMessage(err, 'Không huỷ được quyết định.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Stack spacing={1}><Skeleton variant="rounded" height={90} /><Skeleton variant="rounded" height={90} /></Stack>;
  if (error) return <Alert severity="warning">{error}</Alert>;
  if (evaluations.length === 0) {
    return (
      <Stack alignItems="center" spacing={0.5} sx={{ py: 3, color: 'text.secondary' }}>
        <History />
        <Typography variant="body2">Chưa có quyết định khen thưởng hay phê bình nào.</Typography>
      </Stack>
    );
  }

  return (
    <>
      <Stack spacing={1.25}>
        {evaluations.map((e) => <EvaluationItem key={e._id} e={e} canRevoke={canRevoke} onRevoke={openRevoke} />)}
      </Stack>

      <Dialog open={Boolean(target)} onClose={() => !saving && setTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Huỷ quyết định</DialogTitle>
        <DialogContent>
          {target && (
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Huỷ quyết định <strong>{DECISION_LABEL[target.decision]}</strong> kỳ {periodText(target.period)}. Quyết định
              không bị xoá — vẫn nằm trong lịch sử kèm lý do huỷ. Sau khi huỷ có thể ghi quyết định mới cho kỳ này.
            </Typography>
          )}
          {revokeError && <Alert severity="error" sx={{ mb: 1.5 }}>{revokeError}</Alert>}
          <TextField
            autoFocus fullWidth multiline minRows={2} label="Lý do huỷ" value={reason}
            onChange={(ev) => setReason(ev.target.value)}
            helperText={`${reason.trim().length}/${L.revokeMax} ký tự — tối thiểu ${L.revokeMin}`}
            error={reason.length > 0 && !reasonOk}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarget(null)} disabled={saving}>Đóng</Button>
          <Button
            variant="contained" color="error" onClick={submitRevoke} disabled={!reasonOk || saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Undo />}
          >
            Huỷ quyết định
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EvaluationHistory;
