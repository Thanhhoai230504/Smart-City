import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { Replay } from '@mui/icons-material';
import { REOPENED_BADGE } from '../utils/constants';
import { formatDate } from '../utils/helpers';

interface Props {
  reopenCount?: number;
  lastReopenedAt?: string | null;
}

/**
 * Đánh dấu phiếu người dân đã MỞ LẠI vì không đồng ý kết quả xử lý (G8).
 *
 * Không có badge này, phiếu bị mở lại trên cổng cán bộ trông y hệt mọi phiếu
 * "Đang xử lý" khác — cán bộ phải mở từng phiếu ra đọc lịch sử mới biết người dân
 * đang phản đối. Đủ ba kênh: chữ + icon + màu, không chỉ dựa vào màu.
 */
const ReopenedBadge: React.FC<Props> = ({ reopenCount, lastReopenedAt }) => {
  if (!reopenCount || reopenCount < 1) return null;

  const label = `Bị mở lại · ${reopenCount} lần`;
  const tooltip = lastReopenedAt
    ? `Người dân không đồng ý kết quả xử lý. Lần gần nhất: ${formatDate(lastReopenedAt)}`
    : 'Người dân không đồng ý kết quả xử lý';

  return (
    <Tooltip title={tooltip} arrow>
      <Chip
        size="small"
        icon={<Replay />}
        label={label}
        sx={{
          bgcolor: REOPENED_BADGE.bg,
          color: REOPENED_BADGE.text,
          border: `1px solid ${REOPENED_BADGE.text}33`,
          fontWeight: 600,
          height: 22,
          '& .MuiChip-icon': { color: 'inherit', fontSize: 15 },
        }}
      />
    </Tooltip>
  );
};

export default ReopenedBadge;
