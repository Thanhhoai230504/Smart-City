import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  Chip,
  Dialog,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircleOutline,
  Close,
  Compare,
  NavigateBefore,
  NavigateNext,
  PhotoCamera,
} from '@mui/icons-material';
import { Issue } from '../../types';
import { formatDate } from '../../utils/helpers';

interface Props {
  issue: Issue;
}

interface GalleryImage {
  url: string;
  label: string;
  caption?: string;
}

const uniqueByUrl = (images: GalleryImage[]) => (
  images.filter((image, index, all) => (
    all.findIndex((candidate) => candidate.url === image.url) === index
  ))
);

const IssuePhotoComparison: React.FC<Props> = ({ issue }) => {
  const originalImages = useMemo(() => uniqueByUrl([
    ...(issue.images || []).map((image, index) => ({
      url: image.url,
      label: `Ảnh hiện trường ${index + 1}`,
    })),
    ...(issue.imageUrl ? [{
      url: issue.imageUrl,
      label: 'Ảnh hiện trường',
    }] : []),
  ]), [issue.imageUrl, issue.images]);

  const resolutionImages = useMemo(() => (
    (issue.resolutionImages || []).map((image, index) => ({
      url: image.url,
      label: `Ảnh sau xử lý ${index + 1}`,
      caption: image.uploadedAt ? `Tải lên ${formatDate(image.uploadedAt)}` : undefined,
    }))
  ), [issue.resolutionImages]);

  const [beforeIndex, setBeforeIndex] = useState(0);
  const [afterIndex, setAfterIndex] = useState(0);
  const [viewer, setViewer] = useState<{ group: 'before' | 'after'; index: number } | null>(null);

  useEffect(() => {
    setBeforeIndex(0);
    setAfterIndex(0);
    setViewer(null);
  }, [issue._id]);

  if (originalImages.length === 0 && resolutionImages.length === 0) return null;

  const viewerImages = viewer?.group === 'after' ? resolutionImages : originalImages;
  const viewerImage = viewer ? viewerImages[viewer.index] : null;

  const moveViewer = (direction: -1 | 1) => {
    if (!viewer || viewerImages.length < 2) return;
    setViewer({
      ...viewer,
      index: (viewer.index + direction + viewerImages.length) % viewerImages.length,
    });
  };

  const renderGallery = (
    images: GalleryImage[],
    selectedIndex: number,
    onSelect: (index: number) => void,
    group: 'before' | 'after',
    emptyMessage: string,
  ) => {
    if (images.length === 0) {
      return (
        <Box
          sx={{
            minHeight: 270,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 2.5,
            border: '1px dashed rgba(255,255,255,0.13)',
            bgcolor: 'rgba(255,255,255,0.018)',
          }}
        >
          <Stack alignItems="center" spacing={1}>
            <PhotoCamera sx={{ fontSize: 42, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary">
              {emptyMessage}
            </Typography>
          </Stack>
        </Box>
      );
    }

    const selected = images[Math.min(selectedIndex, images.length - 1)];
    return (
      <Stack spacing={1}>
        <Box
          component="button"
          type="button"
          onClick={() => setViewer({ group, index: selectedIndex })}
          aria-label={`Mở ${selected.label}`}
          sx={{
            p: 0,
            width: '100%',
            height: { xs: 250, md: 330 },
            overflow: 'hidden',
            borderRadius: 2.5,
            border: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(0,0,0,0.25)',
            cursor: 'zoom-in',
          }}
        >
          <Box
            component="img"
            src={selected.url}
            alt={selected.label}
            sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </Box>

        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="caption" color="text.secondary">
            {selected.caption || selected.label}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            {selectedIndex + 1}/{images.length}
          </Typography>
        </Stack>

        {images.length > 1 && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))',
              gap: 0.75,
            }}
          >
            {images.map((image, index) => (
              <Box
                component="button"
                type="button"
                key={`${image.url}-${index}`}
                onClick={() => onSelect(index)}
                aria-label={`Chọn ${image.label}`}
                sx={{
                  p: 0,
                  height: 62,
                  overflow: 'hidden',
                  borderRadius: 1.25,
                  border: index === selectedIndex
                    ? '2px solid #0EA5E9'
                    : '1px solid rgba(255,255,255,0.08)',
                  bgcolor: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <Box
                  component="img"
                  src={image.url}
                  alt={image.label}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </Box>
            ))}
          </Box>
        )}
      </Stack>
    );
  };

  return (
    <>
      <Card
        sx={{
          mb: 3,
          p: { xs: 1.5, md: 2 },
          bgcolor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
          mb={2}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Compare color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Hình ảnh trước và sau xử lý
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Đối chiếu hiện trạng người dân báo cáo với minh chứng của đơn vị xử lý.
              </Typography>
            </Box>
          </Stack>
          {resolutionImages.length > 0 && (
            <Chip
              icon={<CheckCircleOutline />}
              label="Có minh chứng hoàn tất"
              color="success"
              variant="outlined"
              size="small"
            />
          )}
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <Box>
            <Chip
              label="TRƯỚC XỬ LÝ"
              size="small"
              sx={{ mb: 1, fontWeight: 800, letterSpacing: '0.06em' }}
            />
            {renderGallery(
              originalImages,
              beforeIndex,
              setBeforeIndex,
              'before',
              'Không có ảnh hiện trường.',
            )}
          </Box>

          <Box>
            <Chip
              label="SAU XỬ LÝ"
              size="small"
              color={resolutionImages.length > 0 ? 'success' : 'default'}
              sx={{ mb: 1, fontWeight: 800, letterSpacing: '0.06em' }}
            />
            {renderGallery(
              resolutionImages,
              afterIndex,
              setAfterIndex,
              'after',
              issue.status === 'resolved'
                ? 'Chưa có ảnh minh chứng.'
                : 'Ảnh minh chứng sẽ xuất hiện khi đơn vị hoàn tất xử lý.',
            )}
          </Box>
        </Box>
      </Card>

      <Dialog
        open={Boolean(viewerImage)}
        onClose={() => setViewer(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(7,12,24,0.97)',
            backgroundImage: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      >
        {viewerImage && (
          <Box sx={{ position: 'relative', p: { xs: 1, md: 2 } }}>
            <Tooltip title="Đóng">
              <IconButton
                onClick={() => setViewer(null)}
                sx={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  zIndex: 2,
                  bgcolor: 'rgba(0,0,0,0.55)',
                }}
              >
                <Close />
              </IconButton>
            </Tooltip>

            {viewerImages.length > 1 && (
              <>
                <IconButton
                  aria-label="Ảnh trước"
                  onClick={() => moveViewer(-1)}
                  sx={{
                    position: 'absolute',
                    left: 16,
                    top: '50%',
                    zIndex: 2,
                    bgcolor: 'rgba(0,0,0,0.55)',
                  }}
                >
                  <NavigateBefore />
                </IconButton>
                <IconButton
                  aria-label="Ảnh tiếp theo"
                  onClick={() => moveViewer(1)}
                  sx={{
                    position: 'absolute',
                    right: 16,
                    top: '50%',
                    zIndex: 2,
                    bgcolor: 'rgba(0,0,0,0.55)',
                  }}
                >
                  <NavigateNext />
                </IconButton>
              </>
            )}

            <Box
              component="img"
              src={viewerImage.url}
              alt={viewerImage.label}
              sx={{
                display: 'block',
                width: '100%',
                height: { xs: '65vh', md: '78vh' },
                objectFit: 'contain',
              }}
            />
            <Typography textAlign="center" color="text.secondary" mt={1}>
              {viewerImage.caption || viewerImage.label} · {(viewer?.index ?? 0) + 1}/{viewerImages.length}
            </Typography>
          </Box>
        )}
      </Dialog>
    </>
  );
};

export default IssuePhotoComparison;
