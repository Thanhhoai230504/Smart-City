import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { SlaStatus } from '../types';
import { formatDate } from '../utils/helpers';

const SLA_MAP: Record<Exclude<SlaStatus, 'none'>, { label: string; color: string; icon: string }> = {
  on_time: { label: 'Trong hạn', color: '#10B981', icon: '⏱️' },
  due_soon: { label: 'Sắp đến hạn', color: '#F59E0B', icon: '⏳' },
  overdue: { label: 'Quá hạn', color: '#EF4444', icon: '🔥' },
  met: { label: 'Đúng hạn', color: '#10B981', icon: '✅' },
  breached: { label: 'Trễ hạn', color: '#EF4444', icon: '⚠️' },
};

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
          bgcolor: `${sla.color}20`,
          color: sla.color,
          fontWeight: 600,
          fontSize: '0.7rem',
          border: `1px solid ${sla.color}40`,
        }}
      />
    </Tooltip>
  );
};

export default SlaBadge;
