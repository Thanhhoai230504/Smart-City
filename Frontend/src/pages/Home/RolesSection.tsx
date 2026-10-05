import React from 'react';
import { Box, Container, Stack, Typography } from '@mui/material';
import {
  AdminPanelSettingsRounded,
  CheckRounded,
  EngineeringRounded,
  GroupsRounded,
} from '@mui/icons-material';
import { C, EASE, revealSx } from './homeStyle';
import { useInView } from './hooks';
import { SectionHeading } from './HowItWorks';

const ROLES = [
  {
    icon: GroupsRounded,
    title: 'Người dân',
    color: C.blue,
    points: [
      'Gửi phản ánh có ảnh và vị trí',
      'Theo dõi tiến độ, nhận thông báo',
      'Đánh giá kết quả, yêu cầu mở lại',
      'Theo dõi sự cố trong khu vực của mình',
    ],
  },
  {
    icon: EngineeringRounded,
    title: 'Cán bộ đơn vị',
    color: C.teal,
    points: [
      'Nhận việc đúng lĩnh vực phụ trách',
      'Cập nhật tiến độ ngay tại hiện trường',
      'Hoàn tất kèm ảnh minh chứng',
      'Được nhắc khi sắp đến hạn xử lý',
    ],
  },
  {
    icon: AdminPanelSettingsRounded,
    title: 'Quản trị viên',
    color: C.sea,
    points: [
      'Phân công và điều phối đơn vị',
      'Gộp các phản ánh trùng lặp',
      'Đo hiệu quả xử lý từng đơn vị',
      'Xuất báo cáo định kỳ',
    ],
  },
];

const RolesSection: React.FC = () => {
  const [ref, shown] = useInView<HTMLDivElement>({ threshold: 0.15 });

  return (
    <Box component="section" ref={ref} sx={{ bgcolor: C.white, py: { xs: 9, md: 13 }, borderTop: `1px solid ${C.line}` }}>
      <Container maxWidth="lg">
        <SectionHeading
          shown={shown}
          eyebrow="MỘT HỆ THỐNG · BA VAI TRÒ"
          title="Người dân, cán bộ và quản trị cùng làm việc trên một nền tảng."
          text="Phản ánh không dừng ở việc gửi đi: mỗi vai trò có công cụ riêng để sự cố được xử lý đến nơi đến chốn."
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 2, md: 3 } }}>
          {ROLES.map((role, i) => {
            const Icon = role.icon;
            return (
              <Box key={role.title} sx={{
                position: 'relative', overflow: 'hidden',
                p: { xs: 3, md: 3.5 }, borderRadius: '24px',
                bgcolor: C.bg, border: `1px solid ${C.line}`,
                transition: `transform 350ms ${EASE}, box-shadow 350ms ${EASE}`,
                '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 28px 46px -32px rgba(15,34,51,.45)' },
                '&::before': {
                  content: '""', position: 'absolute', left: 0, right: 0, top: 0, height: 4,
                  background: `linear-gradient(90deg, ${role.color}, ${C.aqua})`,
                },
                ...revealSx(shown, 150 + i * 140),
              }}>
                <Stack direction="row" spacing={1.75} alignItems="center" sx={{ mb: 2.5 }}>
                  <Box sx={{
                    width: 52, height: 52, borderRadius: '16px', display: 'grid', placeItems: 'center',
                    bgcolor: role.color, color: '#FFFFFF',
                  }}>
                    <Icon sx={{ fontSize: 28 }} />
                  </Box>
                  <Typography component="h3" sx={{ fontSize: 21, fontWeight: 800, color: C.ink, letterSpacing: '-0.015em' }}>
                    {role.title}
                  </Typography>
                </Stack>
                <Stack component="ul" spacing={1.25} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {role.points.map((p) => (
                    <Stack component="li" key={p} direction="row" spacing={1.25} alignItems="flex-start">
                      <CheckRounded sx={{ fontSize: 19, mt: '2px', color: role.color }} />
                      <Typography sx={{ fontSize: 15, lineHeight: 1.55, color: C.body }}>{p}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
};

export default RolesSection;
