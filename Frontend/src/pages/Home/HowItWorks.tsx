import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import { C, EASE, FONT_MONO, NO_MOTION, drawX, flowAlong, popIn, revealSx } from './homeStyle';
import { useInView } from './hooks';
import { SectionHeading } from './SectionHeading';
import { ProgressVisual, RateVisual, RouteVisual, SnapVisual } from './stepVisuals';

const STEPS = [
  {
    visual: SnapVisual,
    title: 'Chụp ảnh & gửi',
    text: 'Chụp ảnh hiện trường. AI gợi ý loại sự cố, vị trí lấy tự động từ GPS — gửi trong khoảng một phút, trên web hoặc ứng dụng Android.',
  },
  {
    visual: RouteVisual,
    title: 'Chuyển đúng đơn vị',
    text: 'Phản ánh được giao cho đơn vị phụ trách — môi trường, chiếu sáng, giao thông… — kèm hạn xử lý theo mức độ khẩn cấp.',
  },
  {
    visual: ProgressVisual,
    title: 'Xử lý & cập nhật',
    text: 'Cán bộ nhận việc, cập nhật tiến độ và hoàn tất kèm ảnh minh chứng. Bạn nhận thông báo ở từng bước.',
  },
  {
    visual: RateVisual,
    title: 'Đánh giá kết quả',
    text: 'Bạn chấm điểm chất lượng xử lý. Chưa hài lòng? Yêu cầu mở lại để đơn vị xử lý tiếp.',
  },
];

const TRACK = `linear-gradient(90deg, ${C.blue} 0%, ${C.teal} 50%, ${C.mint} 78%, ${C.accent} 100%)`;
/** Chấm số: 40 px kể cả viền trắng 4 px. Khi xếp dọc, chấm cách đỉnh bước 20 px (= khe giữa các bước). */
const DOT = 40;
const GAP = 20;

/**
 * Bốn bước xử lý một phản ánh, mỗi bước một thẻ có hình giao diện thu nhỏ (`stepVisuals.tsx`).
 * Màn ≥ 1200 px: bốn thẻ một hàng, chấm số nằm trên đường ray ngang tự vẽ khi cuộn tới và có
 * vệt sáng chạy dọc. Màn hẹp hơn: dòng thời gian dọc — chấm bên trái, thẻ bên phải (từ
 * 600 px hình minh hoạ nằm cạnh chữ).
 *
 * Hiệu ứng rê chuột dùng thuộc tính `translate`/`scale` riêng: hiệu ứng xuất hiện chạy trên
 * `transform` và giữ giá trị cuối (fill `both`), nên đặt `transform` khi rê sẽ không có tác dụng.
 */
const HowItWorks: React.FC = () => {
  const [ref, shown] = useInView<HTMLDivElement>({ threshold: 0.2 });

  return (
    <Box component="section" ref={ref} sx={{
      position: 'relative', overflow: 'hidden', py: { xs: 9, md: 13 },
      bgcolor: C.white,
      backgroundImage: 'radial-gradient(60% 50% at 50% 0%, rgba(63,184,201,.11) 0%, rgba(63,184,201,0) 70%)',
    }}>
      {/* lưới chấm mờ, tan dần ra mép */}
      <Box aria-hidden="true" sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(11,94,142,.13) 1px, transparent 1.4px)',
        backgroundSize: '22px 22px',
        maskImage: 'radial-gradient(70% 55% at 50% 20%, #000 0%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(70% 55% at 50% 20%, #000 0%, transparent 75%)',
      }} />

      <Container maxWidth="lg" sx={{ position: 'relative' }}>
        <SectionHeading
          shown={shown}
          eyebrow="CÁCH HỆ THỐNG HOẠT ĐỘNG"
          title="Từ một bức ảnh đến kết quả xử lý — minh bạch ở từng bước."
          text="Mọi phản ánh đều có người nhận, có hạn xử lý và được cập nhật công khai, để người dân biết chính xác sự cố của mình đang ở đâu."
        />

        <Box component="ol" sx={{
          position: 'relative', listStyle: 'none', m: 0, p: 0,
          display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(4, minmax(0, 1fr))' },
          gap: { xs: `${GAP}px`, lg: 3 },
        }}>
          {/* đường ray ngang (≥ 1200 px) nối tâm bốn chấm số */}
          <Box aria-hidden="true" sx={{
            display: { xs: 'none', lg: 'block' },
            position: 'absolute', top: DOT / 2 - 1, left: '12.5%', right: '12.5%', height: 2,
            borderRadius: 2, bgcolor: '#DCE7EB', overflow: 'hidden',
          }}>
            <Box sx={{
              position: 'absolute', inset: 0, background: TRACK, transformOrigin: 'left',
              transform: shown ? undefined : 'scaleX(0)',
              animation: shown ? `${drawX} 1400ms ${EASE} 300ms both` : 'none',
              [NO_MOTION]: { transform: 'none', animation: 'none' },
            }} />
            <Box sx={{
              position: 'absolute', top: 0, bottom: 0, left: 0, width: '18%',
              background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.95), rgba(255,255,255,0))',
              transform: 'translateX(-100%)',
              animation: shown ? `${flowAlong} 3.2s ease-in-out 1.8s infinite` : 'none',
              [NO_MOTION]: { display: 'none' },
            }} />
          </Box>

          {STEPS.map((step, i) => {
            const Visual = step.visual;
            const last = i === STEPS.length - 1;
            return (
              <Box component="li" key={step.title} sx={{
                position: 'relative', minWidth: 0,
                display: 'grid', columnGap: { xs: 1.75, sm: 2.5 },
                gridTemplateColumns: { xs: `${DOT}px minmax(0, 1fr)`, lg: 'minmax(0, 1fr)' },
                // hàng ngang: thẻ lấp phần còn lại để bốn thẻ cao bằng nhau, đỉnh thẳng hàng
                gridTemplateRows: { lg: 'auto 1fr' },
                // dòng thời gian dọc: đoạn nối từ tâm chấm này tới tâm chấm kế tiếp
                '&::before': last ? undefined : {
                  content: '""', display: { xs: 'block', lg: 'none' },
                  position: 'absolute', left: DOT / 2 - 1, top: GAP + DOT / 2, width: 2,
                  height: `calc(100% + ${GAP}px)`, borderRadius: 2,
                  background: `linear-gradient(180deg, ${C.blue}, ${C.teal})`, opacity: 0.35,
                },
                '&:hover .step-dot': {
                  scale: '1.12',
                  boxShadow: '0 0 0 6px rgba(63,184,201,.18), 0 12px 22px -10px rgba(11,94,142,.8)',
                },
                '&:hover .step-card': {
                  translate: '0 -6px',
                  borderColor: 'rgba(63,184,201,.55)',
                  boxShadow: '0 28px 46px -30px rgba(11,94,142,.55)',
                },
              }}>
                <Box className="step-dot" sx={{
                  position: 'relative', zIndex: 1, width: DOT, height: DOT,
                  mt: { xs: `${GAP}px`, lg: 0 }, mx: { lg: 'auto' }, mb: { lg: 2.5 },
                  borderRadius: '50%', display: 'grid', placeItems: 'center',
                  fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700, color: '#FFFFFF',
                  background: `linear-gradient(140deg, ${C.blue}, ${C.teal})`,
                  border: '4px solid #FFFFFF',
                  boxShadow: '0 10px 20px -10px rgba(11,94,142,.75)',
                  transition: `scale 300ms ${EASE}, box-shadow 300ms ${EASE}`,
                  opacity: shown ? undefined : 0,
                  animation: shown ? `${popIn} 650ms ${EASE} ${350 + i * 220}ms both` : 'none',
                  [NO_MOTION]: { opacity: 1, animation: 'none' },
                }}>
                  {i + 1}
                </Box>

                <Box className="step-card" sx={{
                  minWidth: 0, p: { xs: 2, sm: 2.5 }, borderRadius: '22px',
                  bgcolor: C.white, border: `1px solid ${C.line}`,
                  boxShadow: '0 1px 2px rgba(15,34,51,.04), 0 10px 30px -24px rgba(15,34,51,.3)',
                  display: 'grid', alignItems: 'center', alignContent: 'start',
                  gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '240px minmax(0, 1fr)', lg: 'minmax(0, 1fr)' },
                  columnGap: 3, rowGap: 2.25,
                  transition: `translate 350ms ${EASE}, box-shadow 350ms ${EASE}, border-color 250ms ease`,
                  ...revealSx(shown, 420 + i * 160),
                }}>
                  <Visual />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component="h3" sx={{
                      fontSize: { xs: 18, md: 19 }, fontWeight: 800, color: C.ink, letterSpacing: '-0.01em', mb: 0.75,
                    }}>
                      {step.title}
                    </Typography>
                    <Typography sx={{ fontSize: 15, lineHeight: 1.65, color: C.body }}>
                      {step.text}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
};

export default HowItWorks;
