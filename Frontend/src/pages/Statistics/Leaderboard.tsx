import React, { useEffect, useState } from 'react';
import { Avatar, Box, Skeleton, Stack, Typography } from '@mui/material';
import { EmojiEventsRounded } from '@mui/icons-material';
import { badgeApi } from '../../api/badgeApi';
import { LeaderboardEntry } from '../../types';
import { C } from '../Home/homeStyle';
import StatCard from './StatCard';

const numberFormatter = new Intl.NumberFormat('vi-VN');

// Số thứ hạng là CHỮ trắng trên nền huy chương nên phải ≥ 4.5:1. Vàng #B8860B
// và bạc #7A8794 quen thuộc chỉ đạt 3.25:1 và 3.67:1 — dùng tông đậm hơn.
const MEDAL = ['#8A6508', '#5F6B76', '#A0522D'];

/**
 * Người dân tích cực — đọc `GET /api/badges/leaderboard`.
 *
 * Backend chỉ đếm phiếu KHÔNG bị từ chối và ẩn tài khoản đã xoá/bị khoá, nên bảng này không
 * thưởng cho phiếu rác. Đây là phần phụ của trang thống kê: lỗi tải hoặc chưa có dữ liệu thì
 * ẩn đi thay vì làm hỏng cả trang (khối đánh giá bên cạnh tự chiếm trọn hàng).
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
    <StatCard
      icon={EmojiEventsRounded}
      tone="#B7791F"
      title="Người dân tích cực"
      subtitle="Xếp theo số phản ánh hợp lệ — phản ánh bị từ chối không được tính"
    >
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, mt: 0.5 }}>
        {leaders === null
          ? Array.from({ length: 5 }).map((_, i) => (
            <Box component="li" key={i} sx={{ py: 1 }}>
              <Skeleton variant="rounded" height={40} sx={{ borderRadius: '12px' }} />
            </Box>
          ))
          : leaders.map((leader, index) => {
            const top = index < 3;
            return (
              <Stack
                component="li"
                key={leader.userId}
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{
                  px: 1.25, py: 1.1, borderRadius: '12px',
                  bgcolor: index === 0 ? '#FFF8EC' : 'transparent',
                  borderTop: index === 0 ? 'none' : `1px solid ${index === 1 ? 'transparent' : C.line}`,
                }}
              >
                <Box
                  aria-label={`Hạng ${leader.rank}`}
                  sx={{
                    width: 30, height: 30, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center',
                    fontWeight: 800, fontSize: 13.5,
                    color: top ? '#FFFFFF' : C.muted,
                    bgcolor: top ? MEDAL[index] : '#EEF3F6',
                    boxShadow: top ? `0 0 0 3px ${index === 0 ? '#FBE3B8' : '#EEF3F6'}` : 'none',
                  }}
                >
                  {leader.rank}
                </Box>
                <Avatar src={leader.avatar || undefined} alt="" sx={{
                  width: 36, height: 36, fontSize: 15, fontWeight: 800,
                  color: '#06263A', background: 'linear-gradient(135deg, #8ED8E8, #A3E8C8)',
                }}>
                  {leader.name?.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 14.5, fontWeight: top ? 700 : 600, color: C.ink }}>{leader.name}</Typography>
                  {leader.topBadge && (
                    <Typography noWrap component="p" sx={{ fontSize: 12.5, color: C.muted }}>
                      {leader.topBadge.icon} {leader.topBadge.label}
                    </Typography>
                  )}
                </Box>
                <Box sx={{
                  flexShrink: 0, px: 1.25, py: 0.4, borderRadius: 999, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
                  color: C.blue, bgcolor: 'rgba(11,94,142,.07)',
                }}>
                  {numberFormatter.format(leader.issueCount)} phản ánh
                </Box>
              </Stack>
            );
          })}
      </Box>
    </StatCard>
  );
};

export default Leaderboard;
