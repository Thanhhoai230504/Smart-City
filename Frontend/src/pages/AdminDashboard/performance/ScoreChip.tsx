import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { EmojiEventsOutlined, HourglassEmpty, ThumbUpAltOutlined, WarningAmberRounded } from '@mui/icons-material';
import { DepartmentScore } from '../../../types';
import { DEPARTMENT_SCORE_LABEL_STYLE } from '../../../utils/constants';

const ICONS = {
  commend: <EmojiEventsOutlined />,
  meet: <ThumbUpAltOutlined />,
  improve: <WarningAmberRounded />,
  insufficient: <HourglassEmpty />,
};

/**
 * Nhãn GỢI Ý (khen thưởng / đạt / cần nhắc nhở / chưa đủ dữ liệu). Đủ ba kênh: chữ,
 * icon, màu. Tooltip nêu lý do và cờ cần chú ý để người xem biết vì sao.
 */
const ScoreChip: React.FC<{ score: DepartmentScore; size?: 'small' | 'medium' }> = ({ score, size = 'small' }) => {
  const style = DEPARTMENT_SCORE_LABEL_STYLE[score.label];
  const notes = [...score.attention, ...score.reasons];
  const chip = (
    <Chip
      size={size}
      icon={ICONS[score.label]}
      label={score.labelText}
      sx={{
        bgcolor: style.bg,
        color: style.text,
        border: `1px solid ${style.text}33`,
        fontWeight: 600,
        '& .MuiChip-icon': { color: 'inherit' },
      }}
    />
  );
  if (notes.length === 0) return chip;
  return (
    <Tooltip arrow title={<span style={{ whiteSpace: 'pre-line' }}>{notes.map((n) => `• ${n}`).join('\n')}</span>}>
      {chip}
    </Tooltip>
  );
};

export default ScoreChip;
