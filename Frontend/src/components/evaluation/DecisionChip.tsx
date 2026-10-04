import React from 'react';
import { Chip } from '@mui/material';
import { EmojiEventsOutlined, Gavel, ThumbUpAltOutlined, WarningAmberRounded } from '@mui/icons-material';
import { EvaluationDecision } from '../../types';
import { EVALUATION_DECISION_STYLE } from '../../utils/constants';
import { DECISION_LABEL } from '../../utils/evaluation';

const ICONS: Record<EvaluationDecision, React.ReactElement> = {
  commend: <EmojiEventsOutlined />,
  acknowledge: <ThumbUpAltOutlined />,
  remind: <WarningAmberRounded />,
  criticize: <Gavel />,
};

/**
 * Quyết định của LÃNH ĐẠO (khác nhãn gợi ý của hệ thống — ScoreChip). Viền liền, chữ
 * đậm, icon riêng để không nhầm hai thứ. `struck` gạch ngang khi quyết định đã huỷ.
 */
const DecisionChip: React.FC<{ decision: EvaluationDecision; size?: 'small' | 'medium'; prefix?: string; struck?: boolean }> = ({
  decision, size = 'small', prefix, struck,
}) => {
  const s = EVALUATION_DECISION_STYLE[decision];
  return (
    <Chip
      size={size}
      icon={ICONS[decision]}
      label={`${prefix ? `${prefix} ` : ''}${DECISION_LABEL[decision]}`}
      sx={{
        bgcolor: s.bg,
        color: s.text,
        border: `1.5px solid ${s.text}`,
        fontWeight: 700,
        textDecoration: struck ? 'line-through' : 'none',
        '& .MuiChip-icon': { color: 'inherit' },
      }}
    />
  );
};

export default DecisionChip;
