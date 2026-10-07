import React from 'react';
import { Box, Container, Stack, Typography } from '@mui/material';
import {
  AdminPanelSettingsRounded,
  CheckRounded,
  EngineeringRounded,
  GroupsRounded,
  LanguageRounded,
  PhoneAndroidRounded,
  SpaceDashboardRounded,
} from '@mui/icons-material';
import { C, EASE, NO_MOTION, mix, revealSx } from './homeStyle';
import { useInView } from './hooks';
import { GradientText, SectionHeading } from './SectionHeading';

const WEB = { icon: LanguageRounded, label: 'Web' };
const ANDROID = { icon: PhoneAndroidRounded, label: 'Ứng dụng Android' };

/**
 * Ba vai trò. Màu đầu thẻ đi từ đậm tới nhạt nhưng đầu nhạt vẫn giữ chữ trắng ≥ 5:1
 * (#0E7490 5,4:1, #0E7C66 5,1:1). Nền tảng theo đúng hệ thống: app Android có giao diện
 * người dân và cán bộ, phần quản trị chỉ có trên web.
 */
const ROLES = [
  {
    icon: GroupsRounded,
    title: 'Người dân',
    tagline: 'Phản ánh và theo dõi đến khi xử lý xong',
    from: C.blue,
    to: '#0E7490',
    points: [
      'Gửi phản ánh có ảnh và vị trí',
      'Theo dõi tiến độ, nhận thông báo',
      'Đánh giá kết quả, yêu cầu mở lại',
      'Theo dõi sự cố trong khu vực của mình',
    ],
    platforms: [WEB, ANDROID],
  },
  {
    icon: EngineeringRounded,
    title: 'Cán bộ đơn vị',
    tagline: 'Nhận việc, xử lý tại hiện trường, báo kết quả',
    from: C.teal,
    to: '#0E7C66',
    points: [
      'Nhận việc đúng lĩnh vực phụ trách',
      'Cập nhật tiến độ ngay tại hiện trường',
      'Hoàn tất kèm ảnh minh chứng',
      'Được nhắc khi sắp đến hạn xử lý',
    ],
    platforms: [WEB, ANDROID],
  },
  {
    icon: AdminPanelSettingsRounded,
    title: 'Quản trị viên',
    tagline: 'Điều phối và đo hiệu quả toàn thành phố',
    from: C.seaDark,
    to: '#0B4A6E',
    points: [
      'Phân công và điều phối đơn vị',
      'Gộp các phản ánh trùng lặp',
      'Đo hiệu quả xử lý từng đơn vị',
      'Xuất báo cáo định kỳ',
    ],
    platforms: [{ icon: SpaceDashboardRounded, label: 'Bảng điều hành web' }],
  },
];

/**
 * Ba thẻ vai trò: đầu thẻ là dải màu riêng của vai trò (vòng tròn đồng tâm và icon lớn mờ
 * làm hoạ tiết), thân thẻ là bốn việc chính, chân thẻ ghi nền tảng sử dụng.
 */
const RolesSection: React.FC = () => {
  const [ref, shown] = useInView<HTMLDivElement>({ threshold: 0.15 });

  return (
    <Box component="section" ref={ref} sx={{
      py: { xs: 9, md: 13 },
      background: 'linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 62%, #EEF4F7 100%)',
    }}>
      <Container maxWidth="lg">
        <SectionHeading
          shown={shown}
          eyebrow="MỘT HỆ THỐNG · BA VAI TRÒ"
          title={<>Người dân, cán bộ và quản trị <GradientText>cùng làm việc trên một nền tảng.</GradientText></>}
          text="Phản ánh không dừng ở việc gửi đi: mỗi vai trò có công cụ riêng để sự cố được xử lý đến nơi đến chốn."
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }, gap: { xs: 2.5, md: 3 } }}>
          {ROLES.map((role, i) => {
            const Icon = role.icon;
            return (
              <Box key={role.title} sx={{
                position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0,
                borderRadius: '26px', overflow: 'hidden', bgcolor: C.white,
                border: `1px solid ${C.line}`,
                boxShadow: '0 1px 2px rgba(15,34,51,.04), 0 16px 36px -30px rgba(15,34,51,.35)',
                transition: `translate 350ms ${EASE}, box-shadow 350ms ${EASE}`,
                '&:hover': {
                  translate: '0 -6px',
                  boxShadow: `0 36px 60px -40px ${mix(role.from, '#000000', 0.1)}`,
                },
                '&:hover .role-rings': { scale: '1.12', rotate: '10deg' },
                '&:hover .role-icon': { rotate: '-6deg' },
                ...revealSx(shown, 150 + i * 140),
              }}>
                {/* đầu thẻ */}
                <Box sx={{
                  position: 'relative', overflow: 'hidden', px: 3, pt: 3, pb: 3.25, color: '#FFFFFF',
                  background: `linear-gradient(135deg, ${role.from} 0%, ${role.to} 100%)`,
                }}>
                  <Box className="role-rings" aria-hidden="true" sx={{
                    position: 'absolute', right: -70, top: -80, width: 240, height: 240, borderRadius: '50%',
                    background: 'repeating-radial-gradient(circle, rgba(255,255,255,.16) 0 1px, rgba(255,255,255,0) 1px 22px)',
                    transition: `scale 600ms ${EASE}, rotate 600ms ${EASE}`,
                    [NO_MOTION]: { transition: 'none' },
                  }} />
                  <Icon aria-hidden="true" sx={{
                    position: 'absolute', right: 22, top: 20, fontSize: 88, color: 'rgba(255,255,255,.12)',
                  }} />
                  <Box className="role-icon" sx={{
                    position: 'relative', width: 52, height: 52, mb: 2, borderRadius: '16px',
                    display: 'grid', placeItems: 'center',
                    bgcolor: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.2)',
                    transition: `rotate 400ms ${EASE}`,
                  }}>
                    <Icon sx={{ fontSize: 28 }} />
                  </Box>
                  <Typography component="h3" sx={{ position: 'relative', fontSize: 22, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.2 }}>
                    {role.title}
                  </Typography>
                  <Typography sx={{ position: 'relative', mt: 0.5, fontSize: 14.5, lineHeight: 1.5, color: 'rgba(255,255,255,.94)' }}>
                    {role.tagline}
                  </Typography>
                </Box>

                {/* thân thẻ */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3, pt: 2.75 }}>
                  <Stack component="ul" spacing={1.4} sx={{ listStyle: 'none', m: 0, p: 0, mb: 3 }}>
                    {role.points.map((p) => (
                      <Stack component="li" key={p} direction="row" spacing={1.25} alignItems="flex-start">
                        <Box sx={{
                          width: 22, height: 22, mt: '1px', flexShrink: 0, borderRadius: '50%',
                          display: 'grid', placeItems: 'center',
                          bgcolor: mix(role.from, '#FFFFFF', 0.88), color: role.from,
                        }}>
                          <CheckRounded sx={{ fontSize: 15 }} />
                        </Box>
                        <Typography sx={{ fontSize: 15, lineHeight: 1.55, color: C.body }}>{p}</Typography>
                      </Stack>
                    ))}
                  </Stack>

                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{
                    mt: 'auto', pt: 2.25, rowGap: 1, borderTop: `1px dashed ${C.line}`,
                  }}>
                    {role.platforms.map(({ icon: PIcon, label }) => (
                      <Box key={label} sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 30, px: 1.25, borderRadius: 999,
                        bgcolor: C.bg, border: `1px solid ${C.line}`,
                        fontSize: 13, fontWeight: 600, color: C.body,
                        '& svg': { fontSize: 16, color: role.from },
                      }}>
                        <PIcon /> {label}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
};

export default RolesSection;
