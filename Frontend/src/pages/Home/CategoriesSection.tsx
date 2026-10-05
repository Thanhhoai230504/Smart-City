import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, ButtonBase, Container, Stack, Typography } from '@mui/material';
import { AutoAwesomeRounded, ArrowForwardRounded } from '@mui/icons-material';
import { C, EASE, mix, revealSx } from './homeStyle';
import { useInView } from './hooks';
import { categoryColor, categoryIcon } from './categoryIcons';
import { SectionHeading } from './HowItWorks';

const CATEGORIES = [
  { key: 'pothole', title: 'Ổ gà, hư hỏng mặt đường', text: 'Mặt đường lún, nứt, sụt; nắp cống hở hoặc vỡ.' },
  { key: 'garbage', title: 'Rác thải tồn đọng', text: 'Rác để sai chỗ, điểm tập kết quá tải, xả thải bừa bãi.' },
  { key: 'streetlight', title: 'Đèn đường hỏng', text: 'Đèn tắt, chập chờn, cột đèn nghiêng hoặc hở điện.' },
  { key: 'flooding', title: 'Ngập nước', text: 'Ngập sau mưa, cống thoát nước tắc, nước tràn lên đường.' },
  { key: 'tree', title: 'Cây đổ, gãy cành', text: 'Cây nghiêng, cành gãy chắn đường, nguy cơ đổ khi mưa bão.' },
  { key: 'other', title: 'Sự cố khác', text: 'Biển báo hỏng, vỉa hè xuống cấp… bất cứ điều gì thành phố cần biết.' },
];

const CategoriesSection: React.FC = () => {
  const navigate = useNavigate();
  const [ref, shown] = useInView<HTMLDivElement>({ threshold: 0.15 });

  return (
    <Box component="section" ref={ref} sx={{ bgcolor: C.bg, py: { xs: 9, md: 13 } }}>
      <Container maxWidth="lg">
        <SectionHeading
          shown={shown}
          eyebrow="BẠN CÓ THỂ PHẢN ÁNH"
          title="Những sự cố bạn gặp hằng ngày trên đường phố."
          text="Chọn đúng loại giúp đơn vị phụ trách nhận việc nhanh hơn — nhưng nếu không chắc, cứ chụp ảnh và gửi."
        />

        <Box sx={{
          display: 'grid', gap: { xs: 1.5, md: 2.5 },
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
        }}>
          {CATEGORIES.map((cat, i) => {
            const Icon = categoryIcon(cat.key);
            const color = categoryColor(cat.key);
            return (
              <ButtonBase
                key={cat.key}
                onClick={() => navigate('/report')}
                aria-label={`Phản ánh: ${cat.title}`}
                sx={{
                  display: 'block', textAlign: 'left', width: '100%',
                  p: { xs: 2, md: 3 }, borderRadius: '22px',
                  bgcolor: C.white, border: `1px solid ${C.line}`,
                  transition: `transform 350ms ${EASE}, box-shadow 350ms ${EASE}, border-color 250ms ease`,
                  '&:hover, &:focus-visible': {
                    transform: 'translateY(-6px)',
                    borderColor: mix(color, '#FFFFFF', 0.45),
                    boxShadow: `0 26px 40px -26px ${mix(color, '#0F2233', 0.4)}`,
                  },
                  '&:hover .cat-icon': { transform: 'rotate(-8deg) scale(1.08)' },
                  '&:hover .cat-go': { opacity: 1, transform: 'none' },
                  ...revealSx(shown, 150 + i * 90),
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: { xs: 1.5, md: 2.25 } }}>
                  <Box className="cat-icon" sx={{
                    width: { xs: 46, md: 54 }, height: { xs: 46, md: 54 }, borderRadius: '16px',
                    display: 'grid', placeItems: 'center',
                    bgcolor: mix(color, '#FFFFFF', 0.86), color: mix(color, '#0F2233', 0.35),
                    transition: `transform 400ms ${EASE}`,
                  }}>
                    <Icon sx={{ fontSize: { xs: 25, md: 29 } }} />
                  </Box>
                  <ArrowForwardRounded className="cat-go" sx={{
                    display: { xs: 'none', md: 'block' }, color: C.accent, opacity: 0, transform: 'translateX(-6px)',
                    transition: `opacity 250ms ease, transform 300ms ${EASE}`,
                  }} />
                </Stack>
                <Typography component="h3" sx={{ fontSize: { xs: 15.5, md: 18 }, fontWeight: 800, color: C.ink, letterSpacing: '-0.01em', mb: 0.75 }}>
                  {cat.title}
                </Typography>
                <Typography sx={{ fontSize: { xs: 13.5, md: 15 }, lineHeight: 1.6, color: C.body }}>
                  {cat.text}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mt: { xs: 4, md: 5 }, ...revealSx(shown, 700) }}>
          <AutoAwesomeRounded sx={{ fontSize: 20, color: C.teal }} />
          <Typography sx={{ fontSize: 15, color: C.body, textAlign: 'center' }}>
            Không chắc thuộc loại nào? AI đọc ảnh và gợi ý giúp bạn trước khi gửi.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
};

export default CategoriesSection;
