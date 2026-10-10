import React, { useEffect, useId, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, IconButton, Stack, Typography, keyframes } from '@mui/material';
import { useForkRef } from '@mui/material/utils';
import {
  AccessTimeRounded, ArrowForwardRounded, CloseRounded, DirectionsRounded, LocationOnOutlined, ThumbUpOutlined,
} from '@mui/icons-material';
import { MapIssue } from '../../types';
import { CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';
import { cloudinarySized, timeAgo } from '../../utils/helpers';
import { C, EASE, NO_MOTION, mix } from '../Home/homeStyle';
import { categoryColor, categoryIcon } from '../Home/categoryIcons';

const cardIn = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
`;

const clamp = (lines: number) => ({
  display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines, overflow: 'hidden',
} as const);

interface IssuePreviewCardProps {
  issue: MapIssue;
  /** `restoreFocus`: đóng bằng nút × hoặc phím Esc thì trả tiêu điểm về ghim vừa chọn. */
  onClose: (restoreFocus: boolean) => void;
  onDirections: () => void;
}

/**
 * Thẻ xem nhanh khi bấm một ghim sự cố — bản web của bottom sheet trên app (`_IssuePreview`
 * trong `map_screen.dart`): ảnh, loại, tiêu đề, địa chỉ, trạng thái, lượt ủng hộ, thời gian, và
 * hai nút "Chỉ đường" (điền sẵn điểm đến) và "Xem chi tiết" (liên kết thật tới `/issues/:id`, mở
 * được sang tab mới). Thẻ nổi giữa đáy bản đồ, trên các bảng điều khiển; mở ra thì nhận tiêu điểm
 * để người dùng bàn phím đi tiếp bằng Tab.
 */
const IssuePreviewCard = React.forwardRef<HTMLDivElement, IssuePreviewCardProps>(({ issue, onClose, onDirections }, ref) => {
  const ownRef = useRef<HTMLDivElement>(null);
  const handleRef = useForkRef(ownRef, ref);
  const titleId = useId();
  const [imageFailed, setImageFailed] = useState(false);

  const category = CATEGORY_MAP[issue.category] || CATEGORY_MAP.other;
  const status = STATUS_MAP[issue.status] || STATUS_MAP.reported;
  const color = categoryColor(issue.category);
  const Icon = categoryIcon(issue.category);
  const showImage = Boolean(issue.imageUrl) && !imageFailed;

  // Cha gắn `key` theo sự cố nên mỗi lần chọn ghim khác là một lần mount: nhận tiêu điểm ngay.
  useEffect(() => {
    ownRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Box
      ref={handleRef}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      sx={{
        // Trên các bảng điều khiển bản đồ (1000), dưới thanh đầu trang, menu và hộp thoại của MUI.
        position: 'absolute', zIndex: 1050, left: 0, right: 0, mx: 'auto',
        // Dưới 600 px, nút trợ lý ảo (ChatbotWidget: cách đáy 75 px, cao 56 px) nằm ở góc phải
        // dưới, nên thẻ đặt cao hơn nút. Từ 600 px thẻ ở giữa, không chạm nút.
        bottom: { xs: 143, sm: 24 }, width: { xs: 'calc(100% - 24px)', sm: 440 },
        p: { xs: 1.75, sm: 2 }, borderRadius: '20px', outline: 'none',
        bgcolor: C.white, border: `1px solid ${C.line}`,
        boxShadow: '0 1px 2px rgba(15,34,51,.06), 0 28px 56px -24px rgba(8,40,60,.55)',
        animation: `${cardIn} 280ms ${EASE} both`,
        [NO_MOTION]: { animation: 'none' },
      }}
    >
      <IconButton
        aria-label="Đóng"
        size="small"
        onClick={() => onClose(true)}
        sx={{ position: 'absolute', top: 8, right: 8, color: C.muted, '&:hover': { color: C.ink, bgcolor: C.bg } }}
      >
        <CloseRounded fontSize="small" />
      </IconButton>

      <Stack direction="row" spacing={1.75}>
        {/* ảnh hiện trường, hoặc ô nhuốm màu loại kèm icon khi chưa có ảnh / ảnh lỗi */}
        <Box sx={{
          position: 'relative', flexShrink: 0, overflow: 'hidden', borderRadius: '14px',
          width: { xs: 76, sm: 92 }, height: { xs: 76, sm: 92 }, display: 'grid', placeItems: 'center',
          background: `linear-gradient(150deg, ${mix(color, '#FFFFFF', 0.8)} 0%, ${mix(color, '#FFFFFF', 0.93)} 100%)`,
        }}>
          {showImage ? (
            <Box
              component="img"
              src={cloudinarySized(issue.imageUrl as string, 'c_fill,w_200,h_200,q_auto,f_auto')}
              alt=""
              decoding="async"
              onError={() => setImageFailed(true)}
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Icon sx={{ fontSize: 34, color: mix(color, '#0F2233', 0.35) }} />
          )}
        </Box>

        <Box sx={{ minWidth: 0, flex: 1, pr: 4 }}>
          <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.5, color: mix(color, '#0F2233', 0.45) }}>
            <Icon sx={{ fontSize: 16, color }} />
            <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {category.label}
            </Typography>
          </Stack>
          <Typography id={titleId} component="h2" sx={{
            fontSize: 16, fontWeight: 800, lineHeight: 1.35, letterSpacing: '-0.01em', color: C.ink, ...clamp(2),
          }}>
            {issue.title}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, color: C.body }}>
            <LocationOnOutlined sx={{ fontSize: 16, mt: '2px', color: C.muted, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 13, lineHeight: 1.45, ...clamp(2) }}>{issue.location}</Typography>
          </Stack>
        </Box>
      </Stack>

      <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap columnGap={1.75} rowGap={0.75} sx={{ mt: 1.5 }}>
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 24, px: 1, borderRadius: 999,
          bgcolor: status.bg, color: status.text, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: status.color }} />
          {status.label}
        </Box>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: C.body }}>
          <ThumbUpOutlined sx={{ fontSize: 15, color: C.muted }} />
          <Typography component="span" sx={{ fontSize: 13 }}>{issue.voteCount || 0} ủng hộ</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: C.body }}>
          <AccessTimeRounded sx={{ fontSize: 15, color: C.muted }} />
          <Typography component="span" sx={{ fontSize: 13 }}>{timeAgo(issue.createdAt)}</Typography>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 1.75 }}>
        <Button
          variant="outlined"
          startIcon={<DirectionsRounded />}
          onClick={onDirections}
          sx={{ flex: 1, height: 42, borderRadius: '12px', fontWeight: 700, color: C.blue }}
        >
          Chỉ đường
        </Button>
        <Button
          variant="contained"
          component={RouterLink}
          to={`/issues/${issue._id}`}
          endIcon={<ArrowForwardRounded />}
          sx={{
            flex: 1, height: 42, borderRadius: '12px', fontWeight: 700,
            '& .MuiButton-endIcon': { transition: `translate 300ms ${EASE}` },
            '&:hover .MuiButton-endIcon': { translate: '2px 0' },
          }}
        >
          Xem chi tiết
        </Button>
      </Stack>
    </Box>
  );
});

IssuePreviewCard.displayName = 'IssuePreviewCard';

export default IssuePreviewCard;
