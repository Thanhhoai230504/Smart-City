import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, ButtonBase, Container, Stack, Typography } from '@mui/material';
import { AutoAwesomeRounded, ArrowForwardRounded } from '@mui/icons-material';
import { C, EASE, NO_MOTION, mix, revealSx } from './homeStyle';
import { useInView } from './hooks';
import { categoryColor, categoryIcon } from './categoryIcons';
import { GradientText, SectionHeading } from './SectionHeading';
import type { LoadState } from './LivePanel';

const CATEGORIES = [
  { key: 'pothole', title: 'Ổ gà, hư hỏng mặt đường', text: 'Mặt đường lún, nứt, sụt; nắp cống hở hoặc vỡ.' },
  { key: 'garbage', title: 'Rác thải tồn đọng', text: 'Rác để sai chỗ, điểm tập kết quá tải, xả thải bừa bãi.' },
  { key: 'streetlight', title: 'Đèn đường hỏng', text: 'Đèn tắt, chập chờn, cột đèn nghiêng hoặc hở điện.' },
  { key: 'flooding', title: 'Ngập nước', text: 'Ngập sau mưa, cống thoát nước tắc, nước tràn lên đường.' },
  { key: 'tree', title: 'Cây đổ, gãy cành', text: 'Cây nghiêng, cành gãy chắn đường, nguy cơ đổ khi mưa bão.' },
  { key: 'other', title: 'Sự cố khác', text: 'Biển báo hỏng, vỉa hè xuống cấp… bất cứ điều gì thành phố cần biết.' },
];

/** Hai thẻ rộng gấp đôi để lưới có nhịp (kiểu "bento"); thứ tự đọc vẫn theo danh sách trên. */
const WIDE = new Set(['pothole', 'other']);

const tint = (color: string, t: number) => mix(color, '#FFFFFF', t);
/** Chữ mang màu loại sự cố: trộn 45% màu chữ chính — mọi loại đều ≥ 5:1 trên nền gần trắng. */
const ink = (color: string) => mix(color, '#0F2233', 0.45);

interface CategoriesProps {
  /** Số phản ánh theo loại từ `GET /statistics` (`issuesByCategory`); `null` khi chưa có. */
  counts: Record<string, number> | null;
  state: LoadState;
}

/**
 * Sáu loại sự cố người dân có thể phản ánh, xếp lưới bento: màn ≥ 900 px bốn cột (ổ gà và
 * "khác" rộng gấp đôi), màn hẹp hai cột. Mỗi thẻ nhuốm màu của loại, có icon lớn mờ ở góc,
 * số phản ánh thật và thanh so với loại nhiều nhất; bấm thẻ để mở form báo cáo.
 */
const CategoriesSection: React.FC<CategoriesProps> = ({ counts, state }) => {
  const navigate = useNavigate();
  const [ref, shown] = useInView<HTMLDivElement>({ threshold: 0.15 });
  const max = counts ? Math.max(1, ...CATEGORIES.map((c) => counts[c.key] ?? 0)) : 1;

  return (
    <Box component="section" ref={ref} sx={{ position: 'relative', overflow: 'hidden', bgcolor: C.bg, py: { xs: 9, md: 13 } }}>
      {/* quầng màu rất nhạt sau lưới thẻ */}
      <Box aria-hidden="true" sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: [
          'radial-gradient(40% 45% at 92% 18%, rgba(255,107,53,.07) 0%, rgba(255,107,53,0) 70%)',
          'radial-gradient(45% 50% at 6% 88%, rgba(59,130,246,.07) 0%, rgba(59,130,246,0) 70%)',
        ].join(', '),
      }} />

      <Container maxWidth="lg" sx={{ position: 'relative' }}>
        <SectionHeading
          shown={shown}
          eyebrow="BẠN CÓ THỂ PHẢN ÁNH"
          title={<>Những sự cố bạn gặp <GradientText>hằng ngày trên đường phố.</GradientText></>}
          text="Chọn đúng loại giúp đơn vị phụ trách nhận việc nhanh hơn — nhưng nếu không chắc, cứ chụp ảnh và gửi."
        />

        <Box sx={{
          display: 'grid', gap: { xs: 1.5, md: 2.5 },
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
        }}>
          {CATEGORIES.map((cat, i) => {
            const Icon = categoryIcon(cat.key);
            const color = categoryColor(cat.key);
            const wide = WIDE.has(cat.key);
            const count = counts?.[cat.key] ?? 0;
            return (
              <ButtonBase
                key={cat.key}
                onClick={() => navigate('/report')}
                aria-label={`Phản ánh: ${cat.title}`}
                sx={{
                  gridColumn: wide ? 'span 2' : undefined,
                  position: 'relative', overflow: 'hidden', isolation: 'isolate',
                  display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', textAlign: 'left',
                  minHeight: { md: 248 }, p: { xs: 2, md: 3 }, borderRadius: { xs: '20px', md: '26px' },
                  background: `linear-gradient(150deg, ${tint(color, 0.88)} 0%, #FFFFFF 62%)`,
                  border: `1px solid ${tint(color, 0.76)}`,
                  transition: `translate 350ms ${EASE}, box-shadow 350ms ${EASE}, border-color 250ms ease`,
                  '&:hover, &:focus-visible': {
                    translate: '0 -6px',
                    borderColor: tint(color, 0.45),
                    boxShadow: `0 30px 48px -32px ${mix(color, '#0F2233', 0.25)}`,
                  },
                  '&:hover .cat-deco, &:focus-visible .cat-deco': { rotate: '-4deg', scale: '1.08' },
                  '&:hover .cat-chip, &:focus-visible .cat-chip': { rotate: '-6deg' },
                  '&:hover .cat-go, &:focus-visible .cat-go': { opacity: 1, translate: '0 0' },
                  ...revealSx(shown, 150 + i * 90),
                }}
              >
                {/* icon lớn mờ ở góc — trang trí */}
                <Icon className="cat-deco" aria-hidden="true" sx={{
                  position: 'absolute', zIndex: -1,
                  // thẻ rộng trên màn ≥ 900 px: góc dưới phải (thanh số liệu chỉ rộng 360 px);
                  // còn lại: góc trên phải để không đè lên thanh số liệu
                  right: wide ? { xs: -22, md: 28 } : -22,
                  bottom: wide ? { xs: 'auto', md: -30 } : 'auto',
                  top: wide ? { xs: -24, md: 'auto' } : -24,
                  fontSize: wide ? { xs: 104, md: 190 } : { xs: 104, md: 136 },
                  color: tint(color, 0.8), opacity: 0.55, rotate: '-14deg',
                  transition: `rotate 500ms ${EASE}, scale 500ms ${EASE}`,
                  [NO_MOTION]: { transition: 'none' },
                }} />

                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: { xs: 1.5, md: 2.25 } }}>
                  <Box className="cat-chip" sx={{
                    width: { xs: 44, md: 52 }, height: { xs: 44, md: 52 }, borderRadius: '16px',
                    display: 'grid', placeItems: 'center', color: '#FFFFFF',
                    background: `linear-gradient(140deg, ${color}, ${mix(color, '#0F2233', 0.28)})`,
                    boxShadow: `0 12px 22px -12px ${mix(color, '#0F2233', 0.1)}`,
                    transition: `rotate 400ms ${EASE}`,
                  }}>
                    <Icon sx={{ fontSize: { xs: 24, md: 28 } }} />
                  </Box>
                  <Box className="cat-go" aria-hidden="true" sx={{
                    display: { xs: 'none', md: 'grid' }, placeItems: 'center', width: 38, height: 38, borderRadius: '50%',
                    bgcolor: '#FFFFFF', color: C.accent, boxShadow: '0 8px 18px -10px rgba(15,34,51,.45)',
                    opacity: 0, translate: '-8px 0',
                    transition: `opacity 250ms ease, translate 350ms ${EASE}`,
                  }}>
                    <ArrowForwardRounded sx={{ fontSize: 20 }} />
                  </Box>
                </Stack>

                <Typography component="h3" sx={{
                  fontSize: { xs: 15.5, md: wide ? 21 : 18 }, fontWeight: 800, color: C.ink, letterSpacing: '-0.015em', mb: 0.75,
                }}>
                  {cat.title}
                </Typography>
                <Typography sx={{ fontSize: { xs: 13.5, md: 15 }, lineHeight: 1.6, color: C.body, maxWidth: wide ? 360 : 'none' }}>
                  {cat.text}
                </Typography>

                {/* số phản ánh thật + thanh so với loại nhiều nhất; lỗi tải thì ẩn hẳn */}
                {state !== 'error' && (
                  <Box sx={{ mt: 'auto', pt: { xs: 1.75, md: 2.5 }, width: '100%', maxWidth: wide ? 360 : 'none' }}>
                    {state === 'ready' && counts ? (
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: ink(color), mb: 0.75 }}>
                        {count.toLocaleString('vi-VN')} phản ánh
                      </Typography>
                    ) : (
                      <Box sx={{ width: 76, height: 10, my: '4px', mb: 1, borderRadius: 6, bgcolor: tint(color, 0.8) }} />
                    )}
                    <Box sx={{ height: 6, borderRadius: 6, bgcolor: tint(color, 0.84), overflow: 'hidden' }}>
                      <Box sx={{
                        height: '100%', borderRadius: 6,
                        width: shown && counts ? `${Math.max(4, (count / max) * 100)}%` : 0,
                        background: `linear-gradient(90deg, ${tint(color, 0.35)}, ${color})`,
                        transition: `width 1200ms ${EASE} ${300 + i * 90}ms`,
                        [NO_MOTION]: { transition: 'none' },
                      }} />
                    </Box>
                  </Box>
                )}
              </ButtonBase>
            );
          })}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: { xs: 4, md: 5 }, ...revealSx(shown, 700) }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{
            px: { xs: 2, md: 2.5 }, py: 1.25, borderRadius: 999, maxWidth: '100%',
            bgcolor: C.white, border: '1px solid rgba(12,110,116,.22)',
            boxShadow: '0 12px 28px -22px rgba(12,110,116,.6)',
          }}>
            <Box sx={{
              width: 28, height: 28, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center',
              color: '#FFFFFF', background: `linear-gradient(135deg, ${C.teal}, ${C.aqua})`,
            }}>
              <AutoAwesomeRounded sx={{ fontSize: 16 }} />
            </Box>
            <Typography sx={{ fontSize: { xs: 13.5, md: 15 }, color: C.body }}>
              Không chắc thuộc loại nào? <Box component="span" sx={{ color: C.ink, fontWeight: 700 }}>AI đọc ảnh và gợi ý giúp bạn</Box> trước khi gửi.
            </Typography>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default CategoriesSection;
