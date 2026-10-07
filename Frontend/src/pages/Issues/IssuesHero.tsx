import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { AddAPhotoRounded, MapRounded } from '@mui/icons-material';
import { statisticsApi } from '../../api/statisticsApi';
import { STATUS_MAP } from '../../utils/constants';
import { CHROME } from '../../layout/chrome';
import PageHero, { HeroButton, HeroGlassCard } from '../../components/PageHero';
import { EASE, FONT_MONO, NO_MOTION } from '../Home/homeStyle';
import { GradientText } from '../Home/SectionHeading';

const ORDER = ['reported', 'processing', 'resolved', 'rejected'] as const;
type StatusKey = typeof ORDER[number];
type StatusCounts = Record<StatusKey, number>;

interface IssuesHeroProps {
  /** Khách mới thấy nút Báo cáo ở đây — người đã đăng nhập có sẵn nút trên thanh đầu trang. */
  showReportCta: boolean;
  activeStatus: string;
  onPickStatus: (status: string) => void;
}

/**
 * Phần đầu trang Sự cố (`PageHero`): tiêu đề + nút bên trái; bên phải là thẻ kính "Tình hình
 * toàn thành phố" — thanh chồng tỷ lệ bốn trạng thái từ `GET /statistics` (số toàn thành phố,
 * không theo bộ lọc). Bấm một trạng thái để lọc danh sách theo trạng thái đó, bấm lần nữa để
 * bỏ. Lỗi tải số liệu thì ẩn thẻ.
 */
const IssuesHero: React.FC<IssuesHeroProps> = ({ showReportCta, activeStatus, onPickStatus }) => {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<StatusCounts | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    statisticsApi.getPublicStatistics(ctrl.signal)
      .then(({ data }) => {
        const byStatus = data.data?.issuesByStatus;
        if (byStatus) setCounts(byStatus);
        else setFailed(true);
      })
      .catch(() => { if (!ctrl.signal.aborted) setFailed(true); });
    return () => ctrl.abort();
  }, []);

  const total = counts ? ORDER.reduce((sum, key) => sum + (counts[key] || 0), 0) : 0;
  const pct = (key: StatusKey) => (counts && total > 0 ? Math.round(((counts[key] || 0) / total) * 100) : 0);

  return (
    <PageHero
      eyebrow="DỮ LIỆU CÔNG KHAI · CẬP NHẬT LIÊN TỤC"
      title={<>Sự cố <GradientText dark>đô thị</GradientText></>}
      description="Theo dõi phản ánh, tiến độ xử lý và kết quả từ các đơn vị phụ trách trên toàn thành phố."
      actions={(
        <>
          {showReportCta && (
            <HeroButton tone="primary" startIcon={<AddAPhotoRounded />} onClick={() => navigate('/report')}>
              Báo cáo sự cố
            </HeroButton>
          )}
          <HeroButton startIcon={<MapRounded />} onClick={() => navigate('/map')}>
            Xem trên bản đồ
          </HeroButton>
        </>
      )}
      aside={failed ? undefined : (
        <HeroGlassCard>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2}>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Tình hình toàn thành phố</Typography>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: '.06em', color: CHROME.soft, whiteSpace: 'nowrap' }}>
              {counts ? `${total.toLocaleString('vi-VN')} PHẢN ÁNH` : 'ĐANG TẢI…'}
            </Typography>
          </Stack>

          {/* thanh chồng tỷ lệ trạng thái */}
          <Box
            role="img"
            aria-label={counts ? ORDER.map((key) => `${STATUS_MAP[key].label} ${pct(key)}%`).join(', ') : 'Đang tải tỷ lệ trạng thái'}
            sx={{ display: 'flex', gap: '3px', height: 12, my: 2, borderRadius: 999, overflow: 'hidden', bgcolor: 'rgba(255,255,255,.08)' }}
          >
            {counts && ORDER.map((key) => (counts[key] > 0 ? (
              <Box key={key} sx={{
                width: `${(counts[key] / total) * 100}%`, bgcolor: STATUS_MAP[key].color,
                transition: `width 900ms ${EASE}`, [NO_MOTION]: { transition: 'none' },
              }} />
            ) : null))}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
            {ORDER.map((key) => {
              const active = activeStatus === key;
              return (
                <ButtonBase
                  key={key}
                  onClick={() => onPickStatus(active ? '' : key)}
                  aria-pressed={active}
                  aria-label={`Lọc: ${STATUS_MAP[key].label}${counts ? `, ${counts[key]} phản ánh` : ''}`}
                  sx={{
                    justifyContent: 'flex-start', gap: 1.25, px: 1.5, py: { xs: 0.9, sm: 1.25 }, borderRadius: '14px', textAlign: 'left',
                    border: '1px solid', borderColor: active ? 'rgba(142,216,232,.65)' : CHROME.line,
                    bgcolor: active ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.04)',
                    transition: 'background-color 180ms ease, border-color 180ms ease',
                    '&:hover': { bgcolor: 'rgba(255,255,255,.1)' },
                  }}
                >
                  <Box sx={{
                    width: 10, height: 10, flexShrink: 0, borderRadius: '50%', bgcolor: STATUS_MAP[key].color,
                    boxShadow: '0 0 0 3px rgba(255,255,255,.08)',
                  }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12.5, color: CHROME.soft, whiteSpace: 'nowrap' }}>{STATUS_MAP[key].label}</Typography>
                    <Typography sx={{ fontSize: { xs: 17, sm: 20 }, fontWeight: 800, lineHeight: 1.15 }}>
                      {counts ? counts[key].toLocaleString('vi-VN') : '—'}
                    </Typography>
                  </Box>
                  <Typography sx={{ display: { xs: 'none', sm: 'block' }, ml: 'auto', fontFamily: FONT_MONO, fontSize: 12, color: CHROME.muted }}>
                    {counts ? `${pct(key)}%` : ''}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        </HeroGlassCard>
      )}
    />
  );
};

export default IssuesHero;
