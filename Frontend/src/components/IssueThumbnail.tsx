import React, { useState } from 'react';
import { Box, ButtonBase, Dialog, DialogContent, DialogTitle, IconButton, Tooltip, Typography } from '@mui/material';
import { Close } from '@mui/icons-material';
import { CATEGORY_MAP } from '../utils/constants';
import { cloudinarySized, getIssueCoverUrl, issueThumbnailUrl } from '../utils/helpers';
import type { Issue } from '../types';

interface Props {
  issue: Pick<Issue, 'imageUrl' | 'images' | 'category' | 'title'>;
  /** Cạnh ảnh vuông, px. */
  size?: number;
}

/**
 * Ảnh hiện trường thu nhỏ cho các bảng quản lý (bàn làm việc của cán bộ, Quản lý sự cố
 * của quản trị viên): nhìn ảnh là nhận ra sự cố nhanh hơn đọc tiêu đề. Xin đúng cỡ ô từ
 * Cloudinary thay vì tải ảnh gốc; bấm vào thì xem ảnh lớn ngay tại chỗ. Phiếu không có
 * ảnh (hoặc ảnh lỗi) hiện ô màu theo loại sự cố.
 */
const IssueThumbnail: React.FC<Props> = ({ issue, size = 64 }) => {
  const [open, setOpen] = useState(false);
  // Nhớ đúng URL bị lỗi: danh sách cập nhật realtime đổi sang ảnh khác thì thử tải lại.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const category = CATEGORY_MAP[issue.category] || CATEGORY_MAP.other;
  const url = getIssueCoverUrl(issue);
  const broken = url !== null && url === brokenUrl;

  const frameSx = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: 1.5,
    overflow: 'hidden',
    border: '1px solid #DCE7EB',
  } as const;

  if (!url || broken) {
    const reason = url ? 'Không tải được ảnh' : 'Phản ánh không kèm ảnh';
    return (
      <Tooltip title={reason}>
        <Box
          role="img"
          aria-label={`${category.label} — ${reason.toLowerCase()}`}
          sx={{
            ...frameSx,
            display: 'grid',
            placeItems: 'center',
            bgcolor: `${category.color}1F`,
            fontSize: Math.round(size * 0.42),
          }}
        >
          {category.icon}
        </Box>
      </Tooltip>
    );
  }

  return (
    <>
      <Tooltip title="Xem ảnh lớn">
        <ButtonBase
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
          aria-label={`Xem ảnh lớn: ${issue.title}`}
          sx={{
            ...frameSx,
            '&:hover img': { transform: 'scale(1.06)' },
            '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
          }}
        >
          <Box
            component="img"
            src={issueThumbnailUrl(url, size)}
            alt={`Ảnh hiện trường: ${issue.title}`}
            loading="lazy"
            onError={() => setBrokenUrl(url)}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.2s' }}
          />
        </ButtonBase>
      </Tooltip>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        onClick={(event) => event.stopPropagation()}
      >
        <DialogTitle sx={{ pr: 7 }}>
          {/* span: DialogTitle đã là thẻ h2, không lồng thêm thẻ tiêu đề. */}
          <Typography component="span" variant="subtitle1" fontWeight={700} display="block" noWrap>
            {issue.title}
          </Typography>
          <IconButton
            aria-label="Đóng"
            onClick={() => setOpen(false)}
            sx={{ position: 'absolute', top: 10, right: 10 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#0F2233', display: 'grid', placeItems: 'center' }}>
          <Box
            component="img"
            src={cloudinarySized(url, 'c_limit,w_1200,q_auto,f_auto')}
            alt={`Ảnh hiện trường: ${issue.title}`}
            sx={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block' }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IssueThumbnail;
