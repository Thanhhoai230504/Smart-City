import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import {
  AddAPhotoRounded,
  ArrowForwardRounded,
  CheckCircleRounded,
  MapRounded,
} from '@mui/icons-material';
import { Issue } from '../../types';
import {
  C, EASE, FONT_DISPLAY, NO_MOTION, SHORT_DESKTOP,
  fadeUp, letterRise, pulseDot, sheen,
} from './homeStyle';
import { useFontReady } from './hooks';
import HeroBackdrop from './HeroBackdrop';
import LivePanel, { LoadState, Overview } from './LivePanel';

/** Màu chữ trên nền video đã phủ xanh biển (đo trên khung sáng nhất của video). */
const ON_VIDEO = {
  text: '#FFFFFF',
  body: '#DCE9EE', // ≥ 5,7:1 ở vùng chữ
  soft: '#D3E3EA',
  line: 'rgba(255,255,255,.22)',
} as const;

const WORD = 'ĐÀ NẴNG';
// Font chữ thương hiệu: Archivo đứng (62%) nét 900 — chỉ tải đúng 6 ký tự của
// "ĐÀ NẴNG" (index.html, ~4 KB) nên chữ cao mà không làm nặng trang. Cú pháp
// `font` rút gọn chỉ nhận từ khoá độ rộng: extra-condensed = 62,5%.
const WORD_FONT = `900 extra-condensed 100px ${FONT_DISPLAY.split(',')[0]}`;

/**
 * "ĐÀ NẴNG" cỡ lớn: từng chữ trồi lên (như bản cũ), sau đó một vệt sáng lướt qua lần
 * lượt từng chữ. Tông sáng (trắng → xanh nước nhạt) vì nằm trên nền video tối. Chữ chỉ
 * bắt đầu hiện khi font đã tải — không nhảy từ font dự phòng sang.
 */
const Wordmark: React.FC = () => {
  const ready = useFontReady(WORD_FONT, WORD);
  return (
    <Box
      role="img"
      aria-label="Đà Nẵng"
      sx={{
        display: 'flex', alignItems: 'flex-end', flexWrap: 'nowrap',
        fontFamily: FONT_DISPLAY, fontWeight: 900, fontStretch: '62%',
        // Cả chữ rộng ~3,28em nên 30,4cqi (theo bề ngang cột chứa nó) là vừa khít
        // cột trái; chặn theo chiều cao để nút Báo cáo luôn nằm trong màn đầu.
        fontSize: { xs: 'min(30.4cqi, 40vh)', md: 'min(30.4cqi, 38vh, 340px)' },
        [SHORT_DESKTOP]: { fontSize: 'min(30.4cqi, 31vh)' },
        lineHeight: 0.84,
        letterSpacing: '-0.012em',
        userSelect: 'none',
      }}
    >
      {WORD.split('').map((ch, i) => (ch === ' '
        ? <Box key={i} aria-hidden="true" sx={{ width: '0.2em', flexShrink: 0 }} />
        : (
          // Dấu chồng cao hơn dòng chữ: đỉnh dấu ngã của Ẵ cách chân chữ 1,05em, tức
          // ~0,3em trên đỉnh dòng (line-height 0,84). Phần đệm trên phải nằm ở CHÍNH
          // ô chữ: chữ tô bằng nền gradient cắt theo hình chữ (background-clip: text),
          // nền chỉ phủ trong khung ô — dấu nằm ngoài khung sẽ trong suốt, vô hình.
          // `flexShrink: 0` — ô bị bóp hẹp thì chữ bị cắt cả hai bên.
          // Dấu nằm trong khung của chính "ĐÀ NẴNG" (chỉ kéo lên phần đệm dư 0,06em)
          // để không đè lên dòng giới thiệu phía trên.
          <Box key={i} aria-hidden="true" sx={{ overflow: 'hidden', flexShrink: 0, mt: '-0.06em', pb: '0.04em' }}>
            <Box component="span" sx={{
              display: 'inline-block',
              pt: '0.36em',
              backgroundImage: 'linear-gradient(105deg, #BCE4EE 0%, #EAF7FA 38%, #FFFFFF 50%, #EAF7FA 62%, #BCE4EE 100%)',
              backgroundSize: '320% 100%',
              backgroundPosition: '100% 0',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              opacity: ready ? undefined : 0,
              animation: ready
                ? `${letterRise} 1100ms ${EASE} ${i * 75}ms both, ${sheen} 7s ease-in-out ${1500 + i * 120}ms infinite`
                : 'none',
              [NO_MOTION]: { opacity: 1, animation: 'none', backgroundPosition: '75% 0' },
            }}>
              {ch}
            </Box>
          </Box>
        )))}
    </Box>
  );
};

const appear = (shown: boolean, delayMs: number) => ({
  opacity: shown ? undefined : 0,
  animation: shown ? `${fadeUp} 850ms ${EASE} ${delayMs}ms both` : 'none',
  [NO_MOTION]: { opacity: 1, animation: 'none' },
});

interface HeroProps {
  isAuthenticated: boolean;
  overview: Overview | null;
  statsState: LoadState;
  statsSlow: boolean;
  statsAt: Date | null;
  onRetryStats: () => void;
  recent: Issue[] | null;
}

/**
 * Phần đầu trang chủ, hai cột trên nền video Đà Nẵng (xem HeroBackdrop): bên trái
 * "ĐÀ NẴNG" chiếm trọn bề ngang cột → tiêu đề nói rõ hệ thống làm gì → hai nút hành
 * động; bên phải bảng "Tình hình xử lý" dạng kính mờ. Màn hẹp xếp một cột, bảng nằm dưới nút.
 */
const HeroSection: React.FC<HeroProps> = ({ isAuthenticated, ...panel }) => {
  const navigate = useNavigate();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 30);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <Box component="section" sx={{
      position: 'relative', overflow: 'hidden',
      pt: { xs: 4, md: 5 }, pb: { xs: 7, md: 8 },
      [SHORT_DESKTOP]: { pt: 3, pb: 5 },
      bgcolor: C.seaDark, color: ON_VIDEO.text,
    }}>
      <HeroBackdrop />

      <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) clamp(360px, 32vw, 480px)' },
          gridTemplateAreas: {
            xs: '"eyebrow" "word" "copy" "panel"',
            md: '"eyebrow eyebrow" "word panel" "copy panel"',
          },
          // Bảng bên phải thường cao hơn chữ + tiêu đề: phần dư dồn hết vào hàng cuối
          // (1fr) để tiêu đề vẫn sát ngay dưới "ĐÀ NẴNG" thay vì bị đẩy xuống.
          gridTemplateRows: { md: 'auto auto 1fr' },
          columnGap: { md: 5, lg: 6 },
          rowGap: { xs: 2.5, md: 2 },
          // Màn thấp thì cỡ "ĐÀ NẴNG" bị chặn theo chiều cao, chữ không còn phủ hết cột
          // trái: thu cả khối về đúng bề ngang chữ cần (3,3em + khe + bảng) và căn
          // giữa, để chữ luôn chạm sát mép cột và khoảng trống chia đều hai bên.
          maxWidth: {
            md: 'calc(3.3 * min(38vh, 340px) + 40px + clamp(360px, 32vw, 480px))',
            lg: 'calc(3.3 * min(38vh, 340px) + 48px + clamp(360px, 32vw, 480px))',
          },
          mx: 'auto',
          [SHORT_DESKTOP]: { rowGap: 1.5, maxWidth: 'calc(3.3 * 31vh + 48px + clamp(360px, 32vw, 480px))' },
        }}>
          {/* dòng giới thiệu — câu đầu tiên người xem đọc được */}
          <Box sx={{ gridArea: 'eyebrow', ...appear(shown, 0) }}>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
              px: 1.75, py: 0.8, borderRadius: 999,
              bgcolor: 'rgba(255,255,255,.1)', border: `1px solid ${ON_VIDEO.line}`,
              backdropFilter: 'blur(8px)',
            }}>
              <Box sx={{
                width: 8, height: 8, borderRadius: '50%', bgcolor: C.mint,
                animation: `${pulseDot} 2.4s ease-out infinite`, [NO_MOTION]: { animation: 'none' },
              }} />
              <Typography component="span" sx={{ fontSize: 13.5, fontWeight: 700, color: ON_VIDEO.text }}>
                Cổng phản ánh sự cố đô thị
              </Typography>
              {/* Màn hẹp bỏ vế này — ngay dưới đã là chữ ĐÀ NẴNG — để dòng không gãy đôi. */}
              <Typography component="span" sx={{ display: { xs: 'none', sm: 'inline' }, fontSize: 13.5, color: ON_VIDEO.soft }}>
                · Thành phố Đà Nẵng
              </Typography>
            </Box>
          </Box>

          {/* `containerType` để cỡ chữ "ĐÀ NẴNG" tính theo bề ngang cột trái (cqi). */}
          <Box sx={{ gridArea: 'word', minWidth: 0, containerType: 'inline-size' }}>
            <Wordmark />
          </Box>

          <Box sx={{ gridArea: 'copy', alignSelf: 'start', minWidth: 0, maxWidth: 660 }}>
            <Typography component="h1" sx={{
              fontWeight: 800, color: ON_VIDEO.text,
              fontSize: { xs: '1.7rem', sm: '2.1rem', md: '2.5rem' },
              [SHORT_DESKTOP]: { fontSize: '2.05rem' },
              lineHeight: 1.16, letterSpacing: '-0.03em',
              ...appear(shown, 350),
            }}>
              Báo sự cố đô thị trong 1 phút —{' '}
              <Box component="span" sx={{
                backgroundImage: 'linear-gradient(90deg, #8ED8E8, #A3E8C8)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}>
                theo dõi đến khi xử lý xong.
              </Box>
            </Typography>

            <Typography sx={{
              mt: { xs: 1.75, md: 2 },
              color: ON_VIDEO.body, fontSize: { xs: 15.5, md: 17 }, lineHeight: 1.65,
              [SHORT_DESKTOP]: { fontSize: 15.5, mt: 1.5 },
              ...appear(shown, 480),
            }}>
              Ổ gà, rác tồn đọng, đèn đường hỏng, ngập nước, cây đổ… Chụp ảnh và gửi: AI gợi ý loại sự cố,
              hệ thống chuyển đúng đơn vị phụ trách và báo cho bạn ở từng bước xử lý.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{
              mt: { xs: 3, md: 3.25 }, [SHORT_DESKTOP]: { mt: 2.25 },
              ...appear(shown, 600),
            }}>
              <Button
                size="large"
                // Khách cũng đi thẳng tới /report: ProtectedRoute chuyển sang đăng nhập kèm
                // `from`, đăng nhập xong quay lại đúng form báo cáo thay vì về trang chủ.
                onClick={() => navigate('/report')}
                startIcon={<AddAPhotoRounded />}
                endIcon={<ArrowForwardRounded className="cta-arrow" />}
                sx={{
                  position: 'relative', overflow: 'hidden',
                  px: 3.25, py: 1.6, borderRadius: '14px', fontSize: 16, fontWeight: 700, textTransform: 'none',
                  bgcolor: C.accent, color: '#FFFFFF',
                  boxShadow: '0 16px 30px -14px rgba(194,65,12,.75)',
                  transition: `transform 250ms ${EASE}, box-shadow 250ms ${EASE}, background-color 200ms ease`,
                  '& .cta-arrow': { transition: `transform 300ms ${EASE}` },
                  // vệt sáng lướt qua khi rê chuột
                  '&::after': {
                    content: '""', position: 'absolute', top: 0, bottom: 0, width: '40%', left: '-60%',
                    background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent)',
                    transform: 'skewX(-18deg)', transition: `left 700ms ${EASE}`,
                  },
                  '&:hover': {
                    bgcolor: C.accentHover, transform: 'translateY(-2px)',
                    boxShadow: '0 22px 36px -14px rgba(154,52,18,.8)',
                  },
                  '&:hover::after': { left: '120%' },
                  '&:hover .cta-arrow': { transform: 'translateX(4px)' },
                }}
              >
                {isAuthenticated ? 'Báo cáo sự cố' : 'Đăng nhập để báo cáo'}
              </Button>
              <Button
                size="large"
                variant="outlined"
                onClick={() => navigate('/map')}
                startIcon={<MapRounded />}
                sx={{
                  px: 3.25, py: 1.6, borderRadius: '14px', fontSize: 16, fontWeight: 700, textTransform: 'none',
                  color: ON_VIDEO.text, bgcolor: 'rgba(255,255,255,.08)', borderColor: 'rgba(255,255,255,.45)', borderWidth: 1.5,
                  backdropFilter: 'blur(6px)',
                  '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,.16)', borderWidth: 1.5 },
                }}
              >
                Xem bản đồ sự cố
              </Button>
            </Stack>

            <Stack direction="row" spacing={{ xs: 1.5, md: 2.5 }} useFlexGap flexWrap="wrap" sx={{
              mt: { xs: 2.5, md: 3 }, rowGap: 1, [SHORT_DESKTOP]: { mt: 2 },
              ...appear(shown, 720),
            }}>
              {['Miễn phí cho người dân', 'Chuyển đúng đơn vị, có hạn xử lý', 'Ảnh minh chứng khi hoàn tất'].map((t) => (
                <Stack key={t} direction="row" spacing={0.75} alignItems="center">
                  <CheckCircleRounded sx={{ fontSize: 18, color: C.mint }} />
                  <Typography sx={{ fontSize: 13.5, color: ON_VIDEO.soft, fontWeight: 500 }}>{t}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box sx={{ gridArea: 'panel', alignSelf: 'center', minWidth: 0, mt: { xs: 2.5, md: 0 }, ...appear(shown, 420) }}>
            <LivePanel
              overview={panel.overview}
              statsState={panel.statsState}
              statsSlow={panel.statsSlow}
              statsAt={panel.statsAt}
              onRetry={panel.onRetryStats}
              recent={panel.recent}
            />
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default HeroSection;
