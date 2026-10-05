import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl,
  FormControlLabel, FormHelperText, FormLabel, Radio, RadioGroup, Stack, TextField, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import { Gavel } from '@mui/icons-material';
import { departmentApi } from '../../../api/departmentApi';
import { DepartmentScore, EvaluationDecision } from '../../../types';
import {
  EVALUATION_DECISIONS,
  EVALUATION_LIMITS,
  EvaluationFormErrors,
  EvaluationFormValue,
  deviationHint,
  isDeviation,
  isOpenPeriod,
  suggestedDecision,
  validateEvaluationForm,
} from '../../../utils/evaluation';
import { formatPeriod, PeriodRange } from '../../../utils/period';
import ScoreChip from './ScoreChip';
import { getApiErrorMessage } from '../../../utils/apiError';

const emptyForm = (score: DepartmentScore): EvaluationFormValue => ({
  decision: suggestedDecision(score.label),
  content: '',
  documentNumber: '',
  deviationReason: '',
});

/**
 * Lãnh đạo ghi quyết định khen thưởng / phê bình cho một đơn vị trong kỳ đang xem.
 * Gợi ý của hệ thống được chọn sẵn; chọn khác thì phải nêu lý do. Số liệu được server
 * tự chụp lại lúc ghi — form này không gửi con số nào.
 */
const EvaluationFormDialog: React.FC<{
  open: boolean;
  departmentId: string;
  departmentName: string;
  range: PeriodRange;
  score: DepartmentScore;
  onClose: () => void;
  onSaved: () => void;
}> = ({ open, departmentId, departmentName, range, score, onClose, onSaved }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [form, setForm] = useState<EvaluationFormValue>(() => emptyForm(score));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const L = EVALUATION_LIMITS;

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(score));
    setSubmitted(false);
    setServerError('');
  }, [open, score]);

  const errors: EvaluationFormErrors = validateEvaluationForm(form, score.label);
  const shown = (field: keyof EvaluationFormValue) => (submitted ? errors[field] : undefined);
  const deviates = form.decision ? isDeviation(form.decision, score.label) : false;
  const hint = form.decision ? deviationHint(form.decision, score.label, score.labelText) : null;
  const set = (patch: Partial<EvaluationFormValue>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setSubmitted(true);
    if (Object.keys(errors).length || !form.decision) return;
    setSaving(true);
    setServerError('');
    try {
      await departmentApi.createEvaluation(departmentId, {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        decision: form.decision,
        content: form.content.trim(),
        documentNumber: form.documentNumber.trim() || undefined,
        deviationReason: deviates ? form.deviationReason.trim() : undefined,
      });
      // Không dùng toast: toast góc trên bên phải che nút đóng và nút xuất Excel của hộp
      // thoại chi tiết. Phản hồi hiện tại chỗ — hộp thoại cha chuyển sang tab Quyết định.
      onSaved();
      onClose();
    } catch (err) {
      setServerError(getApiErrorMessage(err, 'Không ghi được quyết định.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm" fullScreen={fullScreen} scroll="paper">
      <DialogTitle>
        Ghi quyết định
        <Typography variant="body2" color="text.secondary">{departmentName} · Kỳ {formatPeriod(range)}</Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#F4F7F9' }}>
            <Typography variant="caption" color="text.secondary">Gợi ý của hệ thống cho kỳ này</Typography>
            <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
              <ScoreChip score={score} />
              <Typography variant="body2" fontWeight={650}>
                {score.score === null ? 'Chưa đủ dữ liệu để chấm điểm' : `${score.score}/100 điểm`}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" mt={0.75}>
              Điểm, các chỉ số và danh sách phiếu căn cứ sẽ được chụp lại cùng quyết định.
            </Typography>
          </Box>

          {isOpenPeriod(range.to) && (
            <Alert severity="warning">
              Kỳ đang xem kéo dài đến hiện tại nên số liệu còn thay đổi. Nên ghi quyết định cho kỳ đã khép
              (Tháng trước, Quý trước hoặc kỳ tùy chọn đã kết thúc).
            </Alert>
          )}
          {serverError && <Alert severity="error">{serverError}</Alert>}

          <FormControl error={Boolean(shown('decision'))}>
            <FormLabel id="eval-decision-label">Quyết định</FormLabel>
            <RadioGroup
              aria-labelledby="eval-decision-label"
              value={form.decision ?? ''}
              onChange={(e) => set({ decision: e.target.value as EvaluationDecision })}
            >
              {EVALUATION_DECISIONS.map((d) => (
                <FormControlLabel
                  key={d.value}
                  value={d.value}
                  control={<Radio size="small" />}
                  label={(
                    <Box>
                      <Typography variant="body2" fontWeight={650} component="span">{d.label}</Typography>
                      <Typography variant="caption" color="text.secondary" component="span"> — {d.description}</Typography>
                      {suggestedDecision(score.label) === d.value && (
                        <Typography variant="caption" color="primary.main" fontWeight={700} component="span"> · theo gợi ý</Typography>
                      )}
                    </Box>
                  )}
                />
              ))}
            </RadioGroup>
            {shown('decision') && <FormHelperText>{shown('decision')}</FormHelperText>}
          </FormControl>

          {deviates && (
            <Box>
              <Alert severity="info" sx={{ mb: 1 }}>{hint}</Alert>
              <TextField
                fullWidth multiline minRows={2} required label="Lý do quyết định khác gợi ý"
                value={form.deviationReason} onChange={(e) => set({ deviationReason: e.target.value })}
                error={Boolean(shown('deviationReason'))}
                helperText={shown('deviationReason') || `${form.deviationReason.trim().length}/${L.reasonMax} ký tự`}
              />
            </Box>
          )}

          <TextField
            fullWidth multiline minRows={3} required label="Nội dung quyết định / nhận xét"
            placeholder="Ví dụ: Biểu dương đơn vị xử lý 100% sự cố đúng hạn trong tháng 9, đặc biệt các vụ cây đổ sau mưa lớn."
            value={form.content} onChange={(e) => set({ content: e.target.value })}
            error={Boolean(shown('content'))}
            helperText={shown('content') || `${form.content.trim().length}/${L.contentMax} ký tự`}
          />
          <TextField
            fullWidth label="Số văn bản (nếu có)" placeholder="Ví dụ: 125/QĐ-UBND"
            value={form.documentNumber} onChange={(e) => set({ documentNumber: e.target.value })}
            error={Boolean(shown('documentNumber'))} helperText={shown('documentNumber')}
          />

          <Typography variant="caption" color="text.secondary">
            Đây là bản ghi nội bộ, không thay quyết định chính thức theo quy trình thi đua – khen thưởng. Quyết
            định đã ghi không sửa được; muốn đổi thì huỷ (kèm lý do) rồi ghi lại. Cán bộ của đơn vị sẽ nhận
            thông báo trong ứng dụng.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Đóng</Button>
        <Button
          variant="contained" onClick={submit} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Gavel />}
        >
          Ghi quyết định
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EvaluationFormDialog;
