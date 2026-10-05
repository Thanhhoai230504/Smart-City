import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import {
  AltRouteRounded,
  HandymanRounded,
  PhotoCameraRounded,
  StarRateRounded,
} from '@mui/icons-material';
import { C, EASE, FONT_MONO, NO_MOTION, drawX, popIn, revealSx } from './homeStyle';
import { useInView } from './hooks';

const STEPS = [
  {
    icon: PhotoCameraRounded,
    title: 'Chụp ảnh & gửi',
    text: 'Chụp ảnh hiện trường. AI gợi ý loại sự cố, vị trí lấy tự động từ GPS — gửi trong khoảng một phút, trên web hoặc ứng dụng Android.',
  },
  {
    icon: AltRouteRounded,
    title: 'Chuyển đúng đơn vị',
    text: 'Phản ánh được giao cho đơn vị phụ trách — môi trường, chiếu sáng, giao thông… — kèm hạn xử lý theo mức độ khẩn cấp.',
  },
  {
    icon: HandymanRounded,
    title: 'Xử lý & cập nhật',
    text: 'Cán bộ nhận việc, cập nhật tiến độ và hoàn tất kèm ảnh minh chứng. Bạn nhận thông báo ở từng bước.',
  },
  {
    icon: StarRateRounded,
    title: 'Đánh giá kết quả',
    text: 'Bạn chấm điểm chất lượng xử lý. Chưa hài lòng? Yêu cầu mở lại để đơn vị xử lý tiếp.',
  },
];

export const SectionHeading: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  text?: string;
  shown: boolean;
  dark?: boolean;
  align?: 'left' | 'center';
}> = ({ eyebrow, title, text, shown, dark = false, align = 'left' }) => (
  <Box sx={{ maxWidth: 760, mx: align === 'center' ? 'auto' : 0, textAlign: align, mb: { xs: 5, md: 7 } }}>
    <Typography sx={{
      fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 700, letterSpacing: '.12em',
      color: dark ? C.accentOnDark : C.blue, mb: 1.5,
      ...revealSx(shown),
    }}>
      {eyebrow}
    </Typography>
    <Typography component="h2" sx={{
      fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.12,
      fontSize: { xs: '1.85rem', md: '2.6rem' },
      color: dark ? C.onDark : C.ink, mb: text ? 2 : 0,
      ...revealSx(shown, 100),
    }}>
      {title}
    </Typography>
    {text && (
      <Typography sx={{
        fontSize: { xs: 15.5, md: 17 }, lineHeight: 1.65,
        color: dark ? C.onDarkMuted : C.body,
        ...revealSx(shown, 200),
      }}>
        {text}
      </Typography>
    )}
  </Box>
);

const HowItWorks: React.FC = () => {
  const [ref, shown] = useInView<HTMLDivElement>({ threshold: 0.2 });

  return (
    <Box component="section" ref={ref} sx={{ bgcolor: C.white, py: { xs: 9, md: 13 }, borderTop: `1px solid ${C.line}` }}>
      <Container maxWidth="lg">
        <SectionHeading
          shown={shown}
          eyebrow="CÁCH HỆ THỐNG HOẠT ĐỘNG"
          title="Từ một bức ảnh đến kết quả xử lý — minh bạch ở từng bước."
          text="Mọi phản ánh đều có người nhận, có hạn xử lý và được cập nhật công khai, để người dân biết chính xác sự cố của mình đang ở đâu."
        />

        <Box sx={{ position: 'relative' }}>
          {/* đường nối các bước — tự vẽ khi cuộn tới */}
          <Box aria-hidden="true" sx={{
            display: { xs: 'none', md: 'block' },
            position: 'absolute', top: 31, left: '12.5%', right: '12.5%', height: 2,
            background: `linear-gradient(90deg, ${C.blue}, ${C.teal} 60%, ${C.accent})`,
            opacity: 0.35, transformOrigin: 'left',
            transform: shown ? undefined : 'scaleX(0)',
            animation: shown ? `${drawX} 1400ms ${EASE} 300ms both` : 'none',
            [NO_MOTION]: { transform: 'none', animation: 'none' },
          }} />

          <Box component="ol" sx={{
            listStyle: 'none', m: 0, p: 0,
            display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: { xs: 4, md: 3 },
          }}>
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <Box component="li" key={step.title} sx={{ position: 'relative', textAlign: { md: 'center' } }}>
                  <Box sx={{
                    position: 'relative', width: 64, height: 64, mx: { md: 'auto' }, mb: 2.5,
                    borderRadius: '20px', display: 'grid', placeItems: 'center',
                    color: '#FFFFFF',
                    background: `linear-gradient(140deg, ${C.blue}, ${C.teal})`,
                    boxShadow: '0 18px 30px -16px rgba(11,94,142,.7)',
                    opacity: shown ? undefined : 0,
                    animation: shown ? `${popIn} 700ms ${EASE} ${350 + i * 180}ms both` : 'none',
                    [NO_MOTION]: { opacity: 1, animation: 'none' },
                  }}>
                    <Icon sx={{ fontSize: 30 }} />
                    <Box sx={{
                      position: 'absolute', top: -8, right: -8, width: 26, height: 26, borderRadius: '50%',
                      display: 'grid', placeItems: 'center', bgcolor: C.accent, color: '#FFFFFF',
                      fontSize: 13, fontWeight: 800, border: '3px solid #FFFFFF',
                    }}>
                      {i + 1}
                    </Box>
                  </Box>
                  <Box sx={{ ...revealSx(shown, 450 + i * 180) }}>
                    <Typography component="h3" sx={{ fontSize: 19, fontWeight: 800, color: C.ink, letterSpacing: '-0.01em', mb: 1 }}>
                      {step.title}
                    </Typography>
                    <Typography sx={{ fontSize: 15, lineHeight: 1.65, color: C.body, maxWidth: 300, mx: { md: 'auto' } }}>
                      {step.text}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default HowItWorks;
