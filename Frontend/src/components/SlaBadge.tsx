import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { SlaStatus } from '../types';
import { formatDate } from '../utils/helpers';
import { SLA_STATUS_MAP } from '../utils/constants';

const SLA_MAP: Record<Exclude<SlaStatus, 'none'>, { label: string; text: string; bg: string; icon: string }> = SLA_STATUS_MAP;

/** Khoảng cách tới hạn, dạng "còn 5 giờ" / "quá 2 ngày" */
const distanceToDue = (dueAt: string): string => {
  const diffH = (new Date(dueAt).getTime() - Date.now()) / 3600000;
  const abs = Math.abs(diffH);
  const amount = abs < 1
    ? `${Math.max(1, Math.round(abs * 60))} phút`
    : abs < 48 ? `${Math.round(abs)} giờ` : `${Math.round(abs / 24)} ngày`;
  return diffH >= 0 ? `còn ${amount}` : `quá ${amount}`;
};

interface Props {
  status?: SlaStatus;
  /** Hạn xử lý — dùng cho tooltip và phần thời gian còn lại */
  dueAt?: string | null;
  /** Hiện thêm thời gian còn lại/quá hạn bên cạnh nhãn */
  showRemaining?: boolean;
}

/**
 * Badge trạng thái SLA. `slaStatus` là virtual do backend tính lúc đọc.
 * Không hiện gì khi chưa phân công (`none`) vì lúc đó chưa có hạn xử lý.
 */
const SlaBadge: React.FC<Props> = ({ status, dueAt, showRemaining = false }) => {
  if (!status || status === 'none') return null;
  const sla = SLA_MAP[status];
  if (!sla) return null;

  const isOpen = status === 'on_time' || status === 'due_soon' || status === 'overdue';
  const label = showRemaining && dueAt && isOpen
    ? `${sla.icon} ${sla.label} — ${distanceToDue(dueAt)}`
    : `${sla.icon} ${sla.label}`;

  return (
    <Tooltip title={dueAt ? `Hạn xử lý: ${formatDate(dueAt)}` : ''}>
      <Chip
        label={label}
        size="small"
        sx={{
          bgcolor: sla.bg,
          color: sla.text,
          fontWeight: 600,
          fontSize: '0.7rem',
          border: `1px solid ${sla.text}33`,
        }}
      />
    </Tooltip>
  );
};

export default SlaBadge;
