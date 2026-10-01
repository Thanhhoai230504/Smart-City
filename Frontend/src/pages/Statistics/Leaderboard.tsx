import React, { useEffect, useState } from 'react';
import { Avatar, Box, Skeleton, Stack, Typography } from '@mui/material';
import { EmojiEventsOutlined } from '@mui/icons-material';
import { badgeApi } from '../../api/badgeApi';
import { LeaderboardEntry } from '../../types';

const numberFormatter = new Intl.NumberFormat('vi-VN');

// Số thứ hạng là CHỮ trắng trên nền huy chương nên phải ≥ 4.5:1. Vàng #B8860B
// và bạc #7A8794 quen thuộc chỉ đạt 3.25:1 và 3.67:1 — dùng tông đậm hơn.
const MEDAL = ['#8A6508', '#5F6B76', '#A0522D'];

/**
 * Người dân tích cực — đọc `GET /api/badges/leaderboard`.
 *
 * API có từ lâu nhưng web chưa có giao diện nào. Backend chỉ đếm phiếu KHÔNG bị
 * từ chối và ẩn tài khoản đã xoá/bị khoá, nên bảng này không thưởng cho phiếu rác.
 *
 * Đây là phần phụ của trang thống kê: lỗi tải hoặc chưa có dữ liệu thì ẩn đi
 * thay vì làm hỏng cả trang.
 */
const Leaderboard: React.FC = () => {
  const [leaders, setLeaders] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    let stale = false;
    badgeApi.getLeaderboard(10)
      .then(({ data }) => { if (!stale) setLeaders(Array.isArray(data.data) ? data.data : []); })
      .catch(() => { if (!stale) setLeaders([]); });
    return () => { stale = true; };
  }, []);

  if (leaders !== null && leaders.length === 0) return null;

  return (
    <Box
      component="section"
      aria-labelledby="leaderboard-title"
      sx={{
        mb: 2.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <EmojiEventsOutlined sx={{ color: '#8A6508' }} />
          <Typography id="leaderboard-title" variant="h6" component="h2">Người dân tích cực</Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Xếp theo số phản ánh hợp lệ — phản ánh bị từ chối không được tính
        </Typography>
      </Box>

      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {leaders === null
          ? Array.from({ length: 5 }).map((_, i) => (
            <Box component="li" key={i} sx={{ px: 2.5, py: 1.25 }}>
              <Skeleton variant="rounded" height={36} />
            </Box>
          ))
          : leaders.map((leader, index) => (
            <Stack
              component="li"
              key={leader.userId}
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{
                px: 2.5,
                py: 1.25,
                borderTop: index === 0 ? 'none' : '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                aria-label={`Hạng ${leader.rank}`}
                sx={{
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: index < 3 ? '#FFFFFF' : 'text.secondary',
                  bgcolor: index < 3 ? MEDAL[index] : 'action.hover',
                }}
              >
                {leader.rank}
              </Box>
              <Avatar src={leader.avatar || undefined} alt="" sx={{ width: 32, height: 32 }}>
                {leader.name?.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap fontWeight={index < 3 ? 600 : 400}>{leader.name}</Typography>
                {leader.topBadge && (
                  <Typography variant="caption" color="text.secondary" noWrap component="p">
                    {leader.topBadge.icon} {leader.topBadge.label}
                  </Typography>
                )}
              </Box>
              <Typography variant="body2" color="text.secondary" whiteSpace="nowrap">
                {numberFormatter.format(leader.issueCount)} phản ánh
              </Typography>
            </Stack>
          ))}
      </Box>
    </Box>
  );
};

export default Leaderboard;
