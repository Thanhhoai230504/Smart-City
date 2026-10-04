import React, { useEffect, useState } from 'react';
import { Box, Button, Collapse, Paper, Stack, Typography } from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { departmentApi } from '../../api/departmentApi';
import { DepartmentEvaluation } from '../../types';
import { formatPeriod } from '../../utils/period';
import { formatDateTime } from '../../utils/performanceExport';
import DecisionChip from '../../components/evaluation/DecisionChip';
import EvaluationHistory from '../../components/evaluation/EvaluationHistory';

/**
 * Cán bộ xem quyết định khen thưởng / phê bình của lãnh đạo về đơn vị mình (chỉ xem).
 * Ẩn hẳn khi chưa có quyết định nào — không chiếm chỗ của danh sách công việc.
 */
const DepartmentEvaluationsPanel: React.FC<{ departmentId: string }> = ({ departmentId }) => {
  const [evaluations, setEvaluations] = useState<DepartmentEvaluation[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    departmentApi.getEvaluations(departmentId)
      .then(({ data }) => { if (!cancelled) setEvaluations(data.data.evaluations); })
      .catch(() => { /* không chặn màn hình công việc nếu phần này lỗi */ });
    return () => { cancelled = true; };
  }, [departmentId]);

  if (evaluations.length === 0) return null;
  const latest = evaluations.find((e) => e.status === 'active') || null;
  const by = (e: DepartmentEvaluation) => (typeof e.decidedBy === 'object' ? e.decidedBy.name : '');

  return (
    <Paper variant="outlined" component="section" aria-label="Đánh giá của lãnh đạo" sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
        <Typography variant="subtitle1" fontWeight={700}>Đánh giá của lãnh đạo về đơn vị</Typography>
        <Button size="small" onClick={() => setOpen((v) => !v)} endIcon={open ? <ExpandLess /> : <ExpandMore />}>
          {open ? 'Thu gọn' : `Xem lịch sử (${evaluations.length})`}
        </Button>
      </Stack>
      {latest ? (
        <Box mt={1}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <DecisionChip decision={latest.decision} />
            <Typography variant="body2" color="text.secondary">
              Kỳ {formatPeriod({ from: new Date(latest.period.from), to: new Date(latest.period.to) })} · {by(latest)} · {formatDateTime(latest.createdAt)}
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-line' }}>{latest.content}</Typography>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" mt={1}>Không có quyết định nào còn hiệu lực.</Typography>
      )}
      <Collapse in={open} unmountOnExit>
        <Box mt={1.5}>
          <EvaluationHistory departmentId={departmentId} evaluations={evaluations} loading={false} canRevoke={false} />
        </Box>
      </Collapse>
    </Paper>
  );
};

export default DepartmentEvaluationsPanel;
