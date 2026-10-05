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
  drift, fadeUp, letterRise, pulseDot, sheen,
} from './homeStyle';
import { useFontReady } from './hooks';
import LivePanel, { LoadState, Overview } from './LivePanel';

const WORD = 'ĐÀ NẴNG';
// Font chữ thương hiệu: Archivo đứng (62%) nét 900 — chỉ tải đúng 6 ký tự của
// "ĐÀ NẴNG" (index.html, ~4 KB) nên chữ cao mà không làm nặng trang. Cú pháp
// `font` rút gọn chỉ nhận từ khoá độ rộng: extra-condensed = 62,5%.
const WORD_FONT = `900 extra-condensed 100px ${FONT_DISPLAY.split(',')[0]}`;

/**
 * "ĐÀ NẴNG" cỡ lớn: từng chữ trồi lên (như bản cũ), sau đó một vệt sáng xanh biển
 * lướt qua lần lượt từng chữ. Chữ chỉ bắt đầu hiện khi font đã tải — không nhảy
 * từ font dự phòng sang.
 */
const Wordmark: React.FC = () => {
  const ready = useFontReady(WORD_FONT, WORD);
  return (
    <Box
      role="img"
      aria-label="Đà Nẵng"
      sx={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'nowrap',
        fontFamily: FONT_DISPLAY, fontWeight: 900, fontStretch: '62%',
        // Cả chữ rộng ~3,3em: 23vw vẫn vừa khung ở mọi bề ngang ≥ 900 px; chặn theo
        // chiều cao để nút Báo cáo luôn nằm trong màn đầu.
        fontSize: { xs: '27vw', sm: '25vw', md: 'clamp(150px, min(23vw, 38vh), 340px)' },
        [SHORT_DESKTOP]: { fontSize: 'clamp(130px, 31vh, 250px)' },
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
              backgroundImage: `linear-gradient(105deg, ${C.blueDeep} 0%, ${C.blue} 38%, ${C.aqua} 50%, ${C.blue} 62%, ${C.blueDeep} 100%)`,
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
 * Phần đầu trang chủ, căn giữa: dòng giới thiệu → "ĐÀ NẴNG" chiếm trọn bề ngang →
 * tiêu đề nói rõ hệ thống làm gì → hai nút hành động. Bảng "Tình hình xử lý" là
 * dải rộng ngay bên dưới (cuộn tới là số liệu đếm lên).
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
      pt: { xs: 4, md: 5 }, pb: { xs: 7, md: 10 },
      [SHORT_DESKTOP]: { pt: 3 },
      background: `linear-gradient(180deg, #FFFFFF 0%, ${C.bg} 70%)`,
    }}>
      {/* nền: hai quầng màu biển trôi chậm + lưới mờ. Kích thước theo bề ngang (vw) có
          trần — vmax trên điện thoại dựng đứng làm quầng phình phủ kín chữ. */}
      <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <Box sx={{
          position: 'absolute', width: 'min(70vw, 1100px)', height: 'min(70vw, 1100px)', left: 'max(-26vw, -400px)', top: 'max(-34vw, -520px)', borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(11,94,142,.15), transparent)',
          animation: `${drift} 24s ease-in-out infinite`, [NO_MOTION]: { animation: 'none' },
        }} />
        <Box sx={{
          position: 'absolute', width: 'min(62vw, 980px)', height: 'min(62vw, 980px)', right: 'max(-24vw, -380px)', top: 'max(-10vw, -160px)', borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(12,110,116,.13), transparent)',
          animation: `${drift} 30s ease-in-out -8s infinite reverse`, [NO_MOTION]: { animation: 'none' },
        }} />
        <Box sx={{
          position: 'absolute', width: 'min(50vw, 800px)', height: 'min(50vw, 800px)', left: '25%', top: '38%', borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(194,65,12,.06), transparent)',
        }} />
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.55,
          backgroundImage: 'linear-gradient(rgba(11,94,142,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(11,94,142,.07) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse at 50% 22%, black 15%, transparent 65%)',
        }} />
      </Box>

      <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        {/* dòng giới thiệu — câu đầu tiên người xem đọc được */}
        <Box sx={{ mb: { xs: 2, md: 2.5 }, [SHORT_DESKTOP]: { mb: 1.5 }, ...appear(shown, 0) }}>
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'center',
            px: 1.75, py: 0.8, borderRadius: 999,
            bgcolor: 'rgba(255,255,255,.85)', border: `1px solid ${C.line}`,
            boxShadow: '0 10px 26px -18px rgba(15,34,51,.5)',
          }}>
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%', bgcolor: C.mint,
              animation: `${pulseDot} 2.4s ease-out infinite`, [NO_MOTION]: { animation: 'none' },
            }} />
            <Typography component="span" sx={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>
              Cổng phản ánh sự cố đô thị
            </Typography>
            {/* Màn hẹp bỏ vế này — ngay dưới đã là chữ ĐÀ NẴNG — để dòng không gãy đôi. */}
            <Typography component="span" sx={{ display: { xs: 'none', sm: 'inline' }, fontSize: 13.5, color: C.muted }}>
              · Thành phố Đà Nẵng
            </Typography>
          </Box>
        </Box>

        <Wordmark />

        <Typography component="h1" sx={{
          mt: { xs: 2.5, md: 3 }, mx: 'auto', maxWidth: 980,
          fontWeight: 800, color: C.ink,
          fontSize: { xs: '1.7rem', sm: '2.1rem', md: '2.6rem' },
          [SHORT_DESKTOP]: { fontSize: '2.1rem', mt: 2 },
          lineHeight: 1.16, letterSpacing: '-0.03em',
          ...appear(shown, 380),
        }}>
          Báo sự cố đô thị trong 1 phút —{' '}
          <Box component="span" sx={{
            display: { md: 'block' },
            backgroundImage: `linear-gradient(90deg, ${C.blue}, ${C.teal})`,
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>
            theo dõi đến khi xử lý xong.
          </Box>
        </Typography>

        <Typography sx={{
          mt: { xs: 1.75, md: 2 }, mx: 'auto', maxWidth: 720,
          color: C.body, fontSize: { xs: 15.5, md: 17.5 }, lineHeight: 1.65,
          [SHORT_DESKTOP]: { fontSize: 15.5, mt: 1.5 },
          ...appear(shown, 500),
        }}>
          Ổ gà, rác tồn đọng, đèn đường hỏng, ngập nước, cây đổ… Chụp ảnh và gửi: AI gợi ý loại sự cố,
          hệ thống chuyển đúng đơn vị phụ trách và báo cho bạn ở từng bước xử lý.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{
          mt: { xs: 3, md: 3.5 }, [SHORT_DESKTOP]: { mt: 2.5 },
          ...appear(shown, 620),
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
              color: C.blue, bgcolor: 'rgba(255,255,255,.9)', borderColor: C.line, borderWidth: 1.5,
              '&:hover': { borderColor: C.blue, bgcolor: '#EEF5FA', borderWidth: 1.5 },
            }}
          >
            Xem bản đồ sự cố
          </Button>
        </Stack>

        <Stack direction="row" spacing={{ xs: 1.5, md: 3 }} useFlexGap flexWrap="wrap" justifyContent="center" sx={{
          mt: { xs: 2.5, md: 3 }, rowGap: 1, [SHORT_DESKTOP]: { mt: 2 },
          ...appear(shown, 740),
        }}>
          {['Miễn phí cho người dân', 'Chuyển đúng đơn vị, có hạn xử lý', 'Ảnh minh chứng khi hoàn tất'].map((t) => (
            <Stack key={t} direction="row" spacing={0.75} alignItems="center">
              <CheckCircleRounded sx={{ fontSize: 18, color: '#2F7D64' }} />
              <Typography sx={{ fontSize: 13.5, color: C.muted, fontWeight: 500 }}>{t}</Typography>
            </Stack>
          ))}
        </Stack>

        <Box sx={{ mt: { xs: 5, md: 7 }, mx: 'auto', maxWidth: 1120, textAlign: 'left', ...appear(shown, 860) }}>
          <LivePanel
            overview={panel.overview}
            statsState={panel.statsState}
            statsSlow={panel.statsSlow}
            statsAt={panel.statsAt}
            onRetry={panel.onRetryStats}
            recent={panel.recent}
          />
        </Box>
      </Container>
    </Box>
  );
};

export default HeroSection;
