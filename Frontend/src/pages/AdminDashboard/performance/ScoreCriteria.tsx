import React, { useState } from 'react';
import { Alert, Box, Button, Collapse, Stack, Typography } from '@mui/material';
import { ExpandLess, ExpandMore, GavelOutlined } from '@mui/icons-material';
import { DepartmentScoreConfig } from '../../../types';

/**
 * Tiêu chí chấm, đọc từ cấu hình THẬT backend trả về (không viết tay) — đổi trọng số ở
 * backend là phần giải thích đổi theo.
 */
const ScoreCriteria: React.FC<{ config: DepartmentScoreConfig | null }> = ({ config }) => {
  const [open, setOpen] = useState(false);
  return (
    <Alert severity="info" variant="outlined" icon={<GavelOutlined />}>
      <Typography variant="body2">
        Điểm và nhãn là <strong>gợi ý để tham khảo</strong>. Quyết định khen thưởng hay phê bình do lãnh đạo xem xét
        trên cơ sở danh sách sự cố cụ thể trong phần chi tiết của từng đơn vị.
      </Typography>
      {config && (
        <>
          <Button size="small" onClick={() => setOpen((v) => !v)} endIcon={open ? <ExpandLess /> : <ExpandMore />} sx={{ mt: 0.5, px: 0 }}>
            {open ? 'Ẩn tiêu chí chấm' : 'Xem tiêu chí chấm'}
          </Button>
          <Collapse in={open}>
            <Stack spacing={0.5} mt={0.5}>
              {Object.entries(config.weights).map(([key, w]) => (
                <Typography key={key} variant="body2">
                  • <strong>{config.componentLabels[key] || key}</strong>: {Math.round(w * 100)}%
                </Typography>
              ))}
              <Box mt={0.5}>
                <Typography variant="body2">
                  {config.labels.commend}: ≥ {config.thresholds.commend} điểm · {config.labels.meet}: {config.thresholds.meet}–{config.thresholds.commend - 1} ·{' '}
                  {config.labels.improve}: dưới {config.thresholds.meet}.
                </Typography>
                <Typography variant="body2">
                  Chỉ xếp hạng khi đơn vị đóng ít nhất <strong>{config.minClosedForScore} việc</strong> trong kỳ. Dưới{' '}
                  {config.minRatingsForSatisfaction} lượt đánh giá thì bỏ thành phần hài lòng và chia lại trọng số
                  (không coi là 0 điểm). Còn việc bị leo cấp hoặc ≥ {Math.round(config.attention.overdueShare * 100)}% việc đang mở
                  đã quá hạn thì không đề xuất khen thưởng.
                </Typography>
                <Typography variant="caption" color="text.secondary">Phiên bản tiêu chí: {config.version}</Typography>
              </Box>
            </Stack>
          </Collapse>
        </>
      )}
    </Alert>
  );
};

export default ScoreCriteria;
