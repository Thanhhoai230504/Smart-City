import React from 'react';
import { Box, Card, Chip, Divider, Rating, Stack, Typography } from '@mui/material';
import { History } from '@mui/icons-material';
import { formatDate } from '../../utils/helpers';
import type { PreviousRound } from '../../types';

/**
 * Các lượt xử lý đã khép lại rồi bị mở lại (backend: Issue.previousRounds,
 * utils/issueRounds.js). Mỗi lần mở lại, ảnh minh chứng + đánh giá của lượt cũ
 * được cất vào đây để đơn vị phải chụp minh chứng MỚI và người dân đánh giá lại
 * kết quả lượt mới — nhưng người xem vẫn đối chiếu được lượt trước.
 */
interface Props {
  rounds?: PreviousRound[] | null;
}

const CLOSED_LABEL: Record<string, { label: string; color: 'success' | 'default' }> = {
  resolved: { label: 'Đã báo xử lý xong', color: 'success' },
  rejected: { label: 'Đã từ chối', color: 'default' },
};

const PreviousRounds: React.FC<Props> = ({ rounds }) => {
  if (!rounds?.length) return null;

  return (
    <Card sx={{ mb: 3, p: { xs: 1.5, md: 2 }, border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
        <History color="primary" />
        <Typography variant="h6" fontWeight={700}>
          Các lượt xử lý trước ({rounds.length})
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Phiếu đã được mở lại vì kết quả chưa đạt. Minh chứng và đánh giá của lượt cũ được lưu ở đây để đối chiếu;
        đơn vị phải gửi minh chứng mới cho lượt hiện tại.
      </Typography>

      <Stack spacing={2} divider={<Divider flexItem />}>
        {rounds.map((round, index) => {
          const closed = CLOSED_LABEL[round.closedStatus || ''] || null;
          const reopenedBy = typeof round.reopenedBy === 'object' && round.reopenedBy ? round.reopenedBy.name : null;
          const images = round.resolutionImages || [];
          return (
            <Box key={`${round.reopenedAt || ''}-${index}`}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap mb={1}>
                <Typography variant="subtitle2" fontWeight={700}>Lượt {index + 1}</Typography>
                {closed && <Chip size="small" variant="outlined" color={closed.color} label={closed.label} />}
                {round.closedAt && (
                  <Typography variant="caption" color="text.secondary">đóng lúc {formatDate(round.closedAt)}</Typography>
                )}
              </Stack>

              {round.rating?.score ? (
                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <Rating value={round.rating.score} readOnly size="small" />
                  {round.rating.comment && (
                    <Typography variant="body2" color="text.secondary">“{round.rating.comment}”</Typography>
                  )}
                </Stack>
              ) : null}

              {images.length > 0 && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
                    gap: 0.75,
                    mb: 1,
                    maxWidth: 520,
                  }}
                >
                  {images.map((image, imageIndex) => (
                    <Box
                      key={`${image.url}-${imageIndex}`}
                      component="a"
                      href={image.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Mở ảnh minh chứng ${imageIndex + 1} của lượt ${index + 1}`}
                      sx={{ display: 'block', height: 72, borderRadius: 1.25, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}
                    >
                      <Box
                        component="img"
                        src={image.url}
                        alt={`Minh chứng lượt ${index + 1} — ảnh ${imageIndex + 1}`}
                        loading="lazy"
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </Box>
                  ))}
                </Box>
              )}

              {round.reopenedAt && (
                <Typography variant="body2">
                  <strong>Mở lại</strong> {formatDate(round.reopenedAt)}
                  {reopenedBy ? ` bởi ${reopenedBy}` : ''}
                  {round.reopenReason ? `: ${round.reopenReason}` : ''}
                </Typography>
              )}
            </Box>
          );
        })}
      </Stack>
    </Card>
  );
};

export default PreviousRounds;
