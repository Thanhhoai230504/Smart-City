import React from 'react';
import {
  Box,
  Chip,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { Bolt, InfoOutlined } from '@mui/icons-material';
import { Issue } from '../types';
import { PRIORITY_FACTOR_LABELS, PRIORITY_MAP } from '../utils/constants';

interface PriorityBadgeProps {
  issue: Pick<Issue,
    | 'priorityScore'
    | 'priorityLevel'
    | 'priorityFactors'
    | 'priorityVersion'
    | 'priorityCalculatedAt'>;
  showEmpty?: boolean;
}

const PriorityBadge: React.FC<PriorityBadgeProps> = ({ issue, showEmpty = true }) => {
  const { priorityScore, priorityLevel, priorityFactors = [] } = issue;

  if (priorityScore == null || !priorityLevel) {
    if (!showEmpty) return null;
    return (
      <Tooltip title="Điểm sẽ được hệ thống tính trong lượt cập nhật kế tiếp">
        <Chip size="small" variant="outlined" label="Chưa tính điểm" />
      </Tooltip>
    );
  }

  const appearance = PRIORITY_MAP[priorityLevel];
  const detail = (
    <Box sx={{ minWidth: 300, maxWidth: 380, p: 0.75 }}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={2}>
        <Typography variant="subtitle2" fontWeight={800}>Giải thích điểm ưu tiên</Typography>
        <Typography variant="subtitle2" sx={{ color: appearance.color }}>
          {priorityScore.toFixed(1)}/100
        </Typography>
      </Stack>
      <Typography variant="caption" sx={{ opacity: 0.76 }}>
        Điểm hỗ trợ sắp xếp, không tự quyết định phân công hay trạng thái.
      </Typography>
      <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.16)' }} />
      <Stack spacing={0.8}>
        {priorityFactors.map((factor) => (
          <Box key={factor.code}>
            <Stack direction="row" justifyContent="space-between" spacing={1}>
              <Typography variant="caption" fontWeight={700}>
                {PRIORITY_FACTOR_LABELS[factor.code]}
              </Typography>
              <Typography variant="caption" fontWeight={800}>+{factor.points.toFixed(1)}</Typography>
            </Stack>
            <Typography variant="caption" display="block" sx={{ opacity: 0.76 }}>
              {factor.message} · trọng số {Math.round(factor.weight * 100)}%
            </Typography>
          </Box>
        ))}
      </Stack>
      {issue.priorityCalculatedAt && (
        <Typography variant="caption" display="block" sx={{ opacity: 0.58, mt: 1 }}>
          Cập nhật {new Date(issue.priorityCalculatedAt).toLocaleString('vi-VN')}
          {issue.priorityVersion ? ` · ${issue.priorityVersion}` : ''}
        </Typography>
      )}
    </Box>
  );

  return (
    <Tooltip title={detail} arrow enterTouchDelay={0} placement="top">
      <Chip
        size="small"
        icon={priorityLevel === 'critical' ? <Bolt /> : <InfoOutlined />}
        label={`${appearance.label} · ${priorityScore.toFixed(1)}`}
        aria-label={`Ưu tiên ${appearance.label}, ${priorityScore.toFixed(1)} trên 100`}
        tabIndex={0}
        sx={{
          bgcolor: appearance.background,
          color: appearance.color,
          border: `1px solid ${appearance.color}55`,
          fontWeight: 800,
          '& .MuiChip-icon': { color: 'inherit' },
        }}
      />
    </Tooltip>
  );
};

export default PriorityBadge;
