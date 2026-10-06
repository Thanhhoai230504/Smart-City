import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, ButtonBase, Skeleton, Stack, Typography } from '@mui/material';
import { NorthEastRounded } from '@mui/icons-material';
import { Issue } from '../../types';
import { STATUS_MAP } from '../../utils/constants';
import { timeAgo } from '../../utils/helpers';
import { C, EASE, FONT_MONO, NO_MOTION, mix, pulseDot, slideInRight } from './homeStyle';
import { useCountUp } from './hooks';
import { categoryColor, categoryIcon } from './categoryIcons';

export interface Overview {
  totalIssues: number;
  resolvedCount: number;
  resolutionRate: number;
  avgResolutionHours: number;
}

export type LoadState = 'loading' | 'ready' | 'error';

interface LivePanelProps {
  overview: Overview | null;
  statsState: LoadState;
  /** Đã quá 6 giây mà chưa có số liệu — Render đang thức dậy. */
  statsSlow: boolean;
  statsAt: Date | null;
  onRetry: () => void;
  /** `null` khi đang tải; mảng rỗng khi lỗi hoặc chưa có phản ánh. */
  recent: Issue[] | null;
}

const fmtCount = (v: number) => Math.round(v).toLocaleString('vi-VN');
const fmtHours = (h: number) => (h < 24
  ? `${Math.max(1, Math.round(h))} giờ`
  : `${(h / 24).toFixed(1).replace('.', ',')} ngày`);

const StatTile: React.FC<{
  label: string;
  target: number | null;
  format: (v: number) => string;
  state: LoadState;
}> = ({ label, target, format, state }) => {
  const value = useCountUp(target, state === 'ready');
  return (
    <Box sx={{
      p: { xs: 1.6, lg: 2 }, borderRadius: '18px',
      bgcolor: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.09)',
      minWidth: 0,
    }}>
      <Typography sx={{ fontSize: 12.5, color: C.onDarkMuted, lineHeight: 1.35, mb: 0.6 }}>{label}</Typography>
      {state === 'loading' ? (
        <Skeleton variant="rounded" width="60%" height={30} sx={{ bgcolor: 'rgba(244,248,250,.14)', my: '3px' }} />
      ) : (
        <Typography sx={{
          fontSize: { xs: 24, lg: 28 }, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em',
          color: C.onDark, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        }}>
          {target == null ? '—' : format(value)}
        </Typography>
      )}
    </Box>
  );
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const s = STATUS_MAP[status];
  if (!s) return null;
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.75, flexShrink: 0,
      px: 1, py: 0.35, borderRadius: 999, bgcolor: 'rgba(255,255,255,.08)',
      fontSize: 11.5, fontWeight: 600, color: C.onDark, whiteSpace: 'nowrap',
    }}>
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: s.color }} />
      {s.label}
    </Box>
  );
};

/**
 * Bảng "Tình hình xử lý" ở phần đầu trang chủ: số liệu thật (đếm lên khi có) và
 * ba phản ánh mới nhất — người xem thấy ngay hệ thống đang chạy, xử lý thật.
 * Nền kính mờ nằm trên video: cộng với lớp phủ phía sau, độ tối ≥ 0,78 nên chữ phụ
 * #B9CDD6 vẫn ≥ 4,5:1; trình duyệt không hỗ trợ backdrop-filter thì dùng nền đặc hơn.
 */
const LivePanel: React.FC<LivePanelProps> = ({ overview, statsState, statsSlow, statsAt, onRetry, recent }) => {
  const navigate = useNavigate();
  const items = recent ?? [];

  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden',
      borderRadius: '28px', p: { xs: 2.25, md: 2.5, lg: 3 },
      background: 'rgba(6,30,46,.62)',
      backdropFilter: 'blur(16px) saturate(140%)',
      WebkitBackdropFilter: 'blur(16px) saturate(140%)',
      '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))': {
        background: 'rgba(6,30,46,.9)',
      },
      color: C.onDark,
      border: '1px solid rgba(255,255,255,.16)',
      boxShadow: '0 30px 70px -34px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.1)',
    }}>

      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ position: 'relative', mb: 2.25 }}>
        <Box>
          <Typography sx={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>Tình hình xử lý</Typography>
          <Typography sx={{ fontSize: 13, color: C.onDarkMuted }}>Toàn thành phố Đà Nẵng</Typography>
        </Box>
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.9, flexShrink: 0,
          px: 1.2, py: 0.5, borderRadius: 999, bgcolor: 'rgba(255,255,255,.08)',
          fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: '.04em', color: C.onDark,
        }}>
          <Box sx={{
            width: 8, height: 8, borderRadius: '50%',
            bgcolor: statsState === 'error' ? C.accentOnDark : C.mint,
            animation: statsState === 'ready' ? `${pulseDot} 2.4s ease-out infinite` : 'none',
            [NO_MOTION]: { animation: 'none' },
          }} />
          {statsState === 'ready' && statsAt
            ? `CẬP NHẬT ${statsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
            : statsState === 'error' ? 'CHƯA KẾT NỐI' : 'ĐANG TẢI'}
        </Box>
      </Stack>

      {/* Bảng nằm ở cột phải của phần đầu trang (màn hẹp: dưới nút) nên xếp dọc:
          số liệu 2×2 rồi đến các phản ánh mới nhất. */}
      <Box sx={{ position: 'relative' }}>
        <Box>
          <Box
            aria-busy={statsState === 'loading'}
            sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.25 }}
          >
            <StatTile label="Phản ánh đã tiếp nhận" target={overview?.totalIssues ?? null} format={fmtCount} state={statsState} />
            <StatTile label="Đã xử lý xong" target={overview?.resolvedCount ?? null} format={fmtCount} state={statsState} />
            <StatTile label="Tỷ lệ xử lý" target={overview?.resolutionRate ?? null} format={(v) => `${Math.round(v)}%`} state={statsState} />
            <StatTile label="Thời gian xử lý trung bình" target={overview?.avgResolutionHours ?? null} format={fmtHours} state={statsState} />
          </Box>

          {((statsState === 'loading' && statsSlow) || statsState === 'error') && (
            <Stack role="status" direction="row" alignItems="center" spacing={1}
              sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 0.5, fontSize: 13, color: C.onDarkMuted }}>
              {statsState === 'error' ? (
                <>
                  <span>Chưa tải được số liệu.</span>
                  <Button size="small" onClick={onRetry}
                    sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 13, fontWeight: 700, color: C.accentOnDark, '&:hover': { bgcolor: 'rgba(253,186,140,.12)' } }}>
                    Thử lại
                  </Button>
                </>
              ) : (
                <span>Máy chủ đang khởi động — lần tải đầu có thể mất tới một phút.</span>
              )}
            </Stack>
          )}
        </Box>

        {/* phản ánh mới nhất */}
        <Box sx={{ mt: 2.5, pt: 2.25, borderTop: '1px solid rgba(255,255,255,.10)' }}>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: '.08em', color: C.onDarkMuted, mb: 1.25 }}>
            VỪA ĐƯỢC PHẢN ÁNH
          </Typography>
          {recent !== null && items.length === 0 && (
            <Typography sx={{ fontSize: 14, color: C.onDarkMuted, py: 1 }}>
              Các phản ánh mới nhất sẽ hiện ở đây.
            </Typography>
          )}
          <Stack spacing={0.75}>
            {recent === null
              ? [0, 1, 2].map((i) => (
                <Stack key={i} direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.75 }}>
                  <Skeleton variant="rounded" width={38} height={38} sx={{ bgcolor: 'rgba(244,248,250,.12)', borderRadius: '12px' }} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton width="70%" sx={{ bgcolor: 'rgba(244,248,250,.12)' }} />
                    <Skeleton width="45%" sx={{ bgcolor: 'rgba(244,248,250,.10)' }} />
                  </Box>
                </Stack>
              ))
              : items.map((issue, i) => {
                const Icon = categoryIcon(issue.category);
                const color = categoryColor(issue.category);
                return (
                  <ButtonBase
                    key={issue._id}
                    onClick={() => navigate(`/issues/${issue._id}`)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', textAlign: 'left',
                      px: 1, py: 0.9, mx: -1, borderRadius: '14px',
                      transition: 'background-color 200ms ease',
                      '&:hover, &:focus-visible': { bgcolor: 'rgba(255,255,255,.07)' },
                      animation: `${slideInRight} 650ms ${EASE} ${150 + i * 120}ms both`,
                      [NO_MOTION]: { animation: 'none' },
                    }}
                  >
                    <Box sx={{
                      width: 38, height: 38, borderRadius: '12px', flexShrink: 0,
                      display: 'grid', placeItems: 'center',
                      bgcolor: mix(color, C.sea, 0.72), color: mix(color, '#FFFFFF', 0.35),
                    }}>
                      <Icon sx={{ fontSize: 21 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 14, fontWeight: 600, color: C.onDark }}>{issue.title}</Typography>
                      <Typography noWrap sx={{ fontSize: 12.5, color: C.onDarkMuted }}>
                        {issue.district || issue.location} · {timeAgo(issue.createdAt)}
                      </Typography>
                    </Box>
                    <StatusPill status={issue.status} />
                  </ButtonBase>
                );
              })}
          </Stack>
        </Box>
      </Box>

      <Stack direction="row" spacing={1} sx={{ position: 'relative', mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
        {[
          { label: 'Tất cả sự cố', path: '/issues' },
          { label: 'Thống kê chi tiết', path: '/statistics' },
        ].map((link) => (
          <Button
            key={link.path}
            size="small"
            endIcon={<NorthEastRounded sx={{ fontSize: 15 }} />}
            onClick={() => navigate(link.path)}
            sx={{
              color: C.onDark, fontWeight: 600, fontSize: 13, px: 1.25, borderRadius: '10px',
              '& .MuiButton-endIcon': { color: C.accentOnDark, transition: `transform 250ms ${EASE}` },
              '&:hover': { bgcolor: 'rgba(255,255,255,.08)' },
              '&:hover .MuiButton-endIcon': { transform: 'translate(2px,-2px)' },
            }}
          >
            {link.label}
          </Button>
        ))}
      </Stack>
    </Box>
  );
};

export default LivePanel;
