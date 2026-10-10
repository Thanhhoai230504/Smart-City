import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Skeleton, Stack, Typography } from '@mui/material';
import {
  AccessTimeRounded, ApartmentRounded, ArrowForwardRounded, LocationOnOutlined, ThumbUpOutlined,
} from '@mui/icons-material';
import { Issue } from '../../types';
import { CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';
import { cloudinarySized, timeAgo } from '../../utils/helpers';
import SlaBadge from '../../components/SlaBadge';
import { C, EASE, mix } from '../Home/homeStyle';
import { categoryColor, categoryIcon } from '../Home/categoryIcons';

export type IssueView = 'grid' | 'list';

/**
 * Ảnh Cloudinary: xin bản thu nhỏ vừa thẻ (rộng tối đa 720 px, chất lượng và định dạng tự
 * chọn — trình duyệt nhận WebP/AVIF). Ảnh mẫu 90 KB còn khoảng 35 KB. Ảnh ở nơi khác giữ nguyên.
 */
const sized = (url: string) => cloudinarySized(url, 'c_limit,w_720,q_auto,f_auto');

const departmentName = (issue: Issue) => (
  !issue.departmentId || typeof issue.departmentId === 'string' ? null : issue.departmentId.name
);

/** Ảnh hiện trường, hoặc ô nhuốm màu loại sự cố kèm icon lớn khi chưa có ảnh / ảnh lỗi. */
const IssueMedia: React.FC<{ issue: Issue; list: boolean }> = ({ issue, list }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [issue.imageUrl]);
  const color = categoryColor(issue.category);
  const Icon = categoryIcon(issue.category);
  const label = (CATEGORY_MAP[issue.category] || CATEGORY_MAP.other).label;
  const showImage = Boolean(issue.imageUrl) && !failed;

  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden', flexShrink: 0,
      width: list ? { xs: '100%', sm: 260 } : '100%',
      aspectRatio: list ? { xs: '16 / 9', sm: 'auto' } : '16 / 10',
      minHeight: list ? { sm: 188 } : undefined,
      background: `linear-gradient(150deg, ${mix(color, '#FFFFFF', 0.82)} 0%, ${mix(color, '#FFFFFF', 0.94)} 100%)`,
    }}>
      {showImage ? (
        <Box
          component="img"
          className="issue-img"
          src={sized(issue.imageUrl as string)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          sx={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            transition: `scale 700ms ${EASE}`,
          }}
        />
      ) : (
        <Stack alignItems="center" justifyContent="center" spacing={0.75} sx={{ position: 'absolute', inset: 0, color: mix(color, '#0F2233', 0.35) }}>
          <Icon sx={{ fontSize: 46, opacity: 0.85 }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>Chưa có ảnh hiện trường</Typography>
        </Stack>
      )}

      {/* loại sự cố + hạn xử lý nằm trên ảnh */}
      <Box sx={{
        position: 'absolute', top: 12, left: 12, right: 12,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1,
      }}>
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.6, height: 28, px: 1.1, borderRadius: 999,
          bgcolor: 'rgba(255,255,255,.94)', color: mix(color, '#0F2233', 0.45),
          boxShadow: '0 6px 14px -8px rgba(15,34,51,.55)', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          <Icon sx={{ fontSize: 16, color }} />
          {label}
        </Box>
        <SlaBadge status={issue.slaStatus} dueAt={issue.dueAt} />
      </Box>
    </Box>
  );
};

/**
 * Thẻ một sự cố. `grid`: ảnh trên (16:10), chữ dưới; `list`: ảnh 260 px bên trái, có thêm mô
 * tả (màn < 600 px hai kiểu như nhau). Cả thẻ là một liên kết thật — mở được sang tab mới.
 * Hiệu ứng rê chuột dùng `translate`/`scale` riêng để không đụng `transform` của MUI.
 */
const IssueCard: React.FC<{ issue: Issue; view: IssueView }> = ({ issue, view }) => {
  const list = view === 'list';
  const status = STATUS_MAP[issue.status] || STATUS_MAP.reported;
  const dept = departmentName(issue);

  return (
    <Box
      component={RouterLink}
      to={`/issues/${issue._id}`}
      aria-label={`Xem chi tiết sự cố ${issue.title}`}
      sx={{
        display: 'flex', flexDirection: list ? { xs: 'column', sm: 'row' } : 'column', minWidth: 0,
        color: 'inherit', textDecoration: 'none',
        bgcolor: C.white, border: `1px solid ${C.line}`, borderRadius: '20px', overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(15,34,51,.04), 0 12px 30px -26px rgba(15,34,51,.35)',
        contentVisibility: 'auto', containIntrinsicSize: list ? '190px' : '400px',
        transition: `translate 300ms ${EASE}, box-shadow 300ms ${EASE}, border-color 200ms ease`,
        '&:hover, &:focus-visible': {
          translate: '0 -4px',
          borderColor: 'rgba(63,184,201,.55)',
          boxShadow: '0 28px 46px -30px rgba(11,94,142,.55)',
        },
        '&:focus-visible': { outline: `2px solid ${C.blue}`, outlineOffset: 2 },
        '&:hover .issue-img, &:focus-visible .issue-img': { scale: '1.05' },
        '&:hover .issue-go, &:focus-visible .issue-go': { bgcolor: C.blue, color: '#FFFFFF', translate: '2px 0' },
      }}
    >
      <IssueMedia issue={issue} list={list} />

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', p: { xs: 2, sm: 2.25 } }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.1 }}>
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 24, px: 1, borderRadius: 999,
            bgcolor: status.bg, color: status.text, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
          }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: status.color }} />
            {status.label}
          </Box>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ ml: 'auto !important', color: C.muted, flexShrink: 0 }}>
            <AccessTimeRounded sx={{ fontSize: 15 }} />
            <Typography component="span" sx={{ fontSize: 12.5 }}>{timeAgo(issue.createdAt)}</Typography>
          </Stack>
        </Stack>

        <Typography component="h3" sx={{
          fontSize: 16.5, fontWeight: 800, lineHeight: 1.35, letterSpacing: '-0.01em', color: C.ink,
          display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
        }}>
          {issue.title}
        </Typography>

        {list && issue.description && (
          <Typography sx={{
            mt: 0.75, fontSize: 14, lineHeight: 1.6, color: C.body,
            display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
          }}>
            {issue.description}
          </Typography>
        )}

        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1, color: C.body, minWidth: 0 }}>
          <LocationOnOutlined sx={{ fontSize: 17, color: C.muted, flexShrink: 0 }} />
          <Typography component="span" sx={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {issue.location}
          </Typography>
        </Stack>

        {/* chân thẻ luôn nằm đáy (thẻ cùng hàng cao bằng nhau) */}
        <Box sx={{ mt: 'auto', pt: 1.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pt: 1.5, borderTop: `1px dashed ${C.line}` }}>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: C.body, flexShrink: 0 }}>
              <ThumbUpOutlined sx={{ fontSize: 16, color: C.muted }} />
              <Typography component="span" sx={{ fontSize: 13 }}>{issue.voteCount || 0} ủng hộ</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0, color: dept ? C.body : '#7A8C97' }}>
              <ApartmentRounded sx={{ fontSize: 16, color: C.muted, flexShrink: 0 }} />
              <Typography component="span" sx={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {dept ?? 'Chưa phân công'}
              </Typography>
            </Stack>
            <Box className="issue-go" aria-hidden="true" sx={{
              ml: 'auto', width: 32, height: 32, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center',
              bgcolor: C.bg, color: C.blue,
              transition: `background-color 200ms ease, color 200ms ease, translate 300ms ${EASE}`,
            }}>
              <ArrowForwardRounded sx={{ fontSize: 18 }} />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default IssueCard;

/** Khung xám đúng dáng thẻ trong lúc tải. */
export const IssueCardSkeleton: React.FC<{ view: IssueView }> = ({ view }) => {
  const list = view === 'list';
  return (
    <Box sx={{
      display: 'flex', flexDirection: list ? { xs: 'column', sm: 'row' } : 'column',
      bgcolor: C.white, border: `1px solid ${C.line}`, borderRadius: '20px', overflow: 'hidden',
    }}>
      <Skeleton variant="rectangular" sx={{
        width: list ? { xs: '100%', sm: 260 } : '100%', flexShrink: 0,
        height: list ? { xs: 180, sm: 188 } : 'auto', aspectRatio: list ? undefined : '16 / 10',
      }} />
      <Box sx={{ flex: 1, p: 2.25 }}>
        <Skeleton width={110} height={26} sx={{ borderRadius: 999 }} />
        <Skeleton height={28} width="88%" />
        <Skeleton height={28} width="60%" />
        <Skeleton width="70%" sx={{ mt: 1 }} />
        <Skeleton width="45%" sx={{ mt: 2 }} />
      </Box>
    </Box>
  );
};
