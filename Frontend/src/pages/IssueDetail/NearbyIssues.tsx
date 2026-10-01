import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Card, Chip, Link, Stack, Typography } from '@mui/material';
import { ThumbUpOutlined } from '@mui/icons-material';
import { issueApi } from '../../api/issueApi';
import { NearbyIssue } from '../../types';
import { CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';

interface Props {
  issueId: string;
  latitude: number;
  longitude: number;
}

const RADIUS_METERS = 500;

const formatDistance = (meters: number) =>
  meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;

/**
 * Sự cố khác còn mở quanh vị trí này — `GET /api/issues/nearby`.
 *
 * API có từ lâu nhưng web chưa gọi ở đâu. Trên trang chi tiết nó trả lời câu hỏi
 * cán bộ hay hỏi trước khi cử người đi: "quanh đây còn việc gì gộp được một
 * chuyến không?", và giúp người dân thấy khu vực có nhiều vấn đề đang chờ.
 *
 * Backend chỉ trả sự cố đang mở và chưa gộp, tối đa 5 dòng, gồm cả chính sự cố
 * này (khoảng cách 0) nên phải tự loại ra. Rỗng là bình thường, không phải lỗi.
 */
const NearbyIssues: React.FC<Props> = ({ issueId, latitude, longitude }) => {
  const [issues, setIssues] = useState<NearbyIssue[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    issueApi.getNearbyIssues(latitude, longitude, RADIUS_METERS, controller.signal)
      .then(({ data }) => setIssues(data.data.issues.filter((item) => item._id !== issueId)))
      .catch(() => { if (!controller.signal.aborted) setIssues([]); });
    return () => controller.abort();
  }, [issueId, latitude, longitude]);

  if (issues.length === 0) return null;

  return (
    <Card component="section" aria-labelledby="nearby-issues-title" sx={{ mb: 3, p: 0, overflow: 'hidden' }}>
      <Typography id="nearby-issues-title" variant="subtitle1" fontWeight={600} sx={{ p: 2, pb: 0.5 }}>
        📍 Sự cố khác đang mở gần đây
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: 'block' }}>
        Trong bán kính {formatDistance(RADIUS_METERS)}
      </Typography>

      <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 1 }}>
        {issues.map((item) => {
          const category = CATEGORY_MAP[item.category] || CATEGORY_MAP.other;
          const status = STATUS_MAP[item.status] || STATUS_MAP.reported;
          return (
            <Box component="li" key={item._id} sx={{ p: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
              <Stack direction="row" spacing={1.25} alignItems="flex-start">
                <Box aria-hidden sx={{ fontSize: '1.25rem', lineHeight: 1.4 }}>{category.icon}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Link
                    component={RouterLink}
                    to={`/issues/${item._id}`}
                    underline="hover"
                    color="text.primary"
                    fontWeight={600}
                    sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {item.title}
                  </Link>
                  <Stack direction="row" spacing={1} alignItems="center" mt={0.5} flexWrap="wrap" useFlexGap>
                    <Chip
                      label={status.label}
                      size="small"
                      sx={{ bgcolor: status.bg, color: status.text, fontWeight: 600, height: 22 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      cách {formatDistance(item.distance)}
                    </Typography>
                    {item.voteCount > 0 && (
                      <Stack direction="row" spacing={0.25} alignItems="center" sx={{ color: 'text.secondary' }}>
                        <ThumbUpOutlined sx={{ fontSize: 14 }} aria-hidden />
                        <Typography variant="caption">{item.voteCount} ủng hộ</Typography>
                      </Stack>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Card>
  );
};

export default NearbyIssues;
