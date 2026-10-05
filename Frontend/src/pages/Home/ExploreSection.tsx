import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, ButtonBase, Container, Stack, Typography } from '@mui/material';
import {
  InsightsRounded,
  MapRounded,
  SensorsRounded,
  TrafficRounded,
  VideocamRounded,
  NorthEastRounded,
} from '@mui/icons-material';
import { C, EASE, FONT_MONO, NO_MOTION, prefersReducedMotion, revealSx } from './homeStyle';
import { useInView, useSandTransition } from './hooks';
import { SectionHeading } from './HowItWorks';
import {
  CameraVisual, EnvVisual, IncidentVisual, MapVisual, SandLayer, TrafficVisual,
} from './visuals';

const MODULES = [
  { icon: MapRounded, name: 'Bản đồ sự cố', note: 'Mọi phản ánh đang mở, lọc theo loại và khu vực', path: '/map', visual: MapVisual },
  { icon: TrafficRounded, name: 'Giao thông', note: 'Mức độ ùn tắc trên các tuyến đường, gợi ý lộ trình', path: '/map', visual: TrafficVisual },
  { icon: SensorsRounded, name: 'Môi trường', note: 'Nhiệt độ, độ ẩm và thời tiết theo khu vực', path: '/map', visual: EnvVisual },
  { icon: VideocamRounded, name: 'Camera công cộng', note: 'Hình ảnh trực tiếp tại các nút giao', path: '/cameras', visual: CameraVisual },
  { icon: InsightsRounded, name: 'Thống kê', note: 'Số liệu xử lý theo thời gian, khu vực và đơn vị', path: '/statistics', visual: IncidentVisual },
];

/**
 * Năm lớp dữ liệu ai cũng xem được. Hình bên trái tự chuyển (hiệu ứng "tan cát")
 * khi khối đang hiện trên màn hình; rê chuột vào một phân hệ thì hình đổi theo và
 * dừng tự chuyển, bấm vào thì mở trang tương ứng.
 */
const ExploreSection: React.FC = () => {
  const navigate = useNavigate();
  const [headRef, shown] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const [stageRef, onScreen] = useInView<HTMLDivElement>({ threshold: 0.25, once: false });
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);
  const phase = useSandTransition(active);

  useEffect(() => {
    if (prefersReducedMotion() || !onScreen || hovering) return;
    const t = window.setTimeout(() => setActive((p) => (p + 1) % MODULES.length), 3800);
    return () => window.clearTimeout(t);
  }, [active, onScreen, hovering]);

  const Current = MODULES[phase.current].visual;
  const Prev = phase.prev != null ? MODULES[phase.prev].visual : null;

  return (
    <Box component="section" sx={{
      position: 'relative', overflow: 'hidden', py: { xs: 9, md: 13 },
      background: `linear-gradient(150deg, ${C.seaDark} 0%, ${C.sea} 55%, #0B4A5A 100%)`,
    }}>
      <Box aria-hidden="true" sx={{
        position: 'absolute', inset: 0, opacity: 0.35, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(184,216,210,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(184,216,210,.06) 1px, transparent 1px)',
        backgroundSize: '72px 72px',
        maskImage: 'linear-gradient(115deg, black 15%, transparent 80%)',
      }} />

      <Container maxWidth="lg" sx={{ position: 'relative' }}>
        <Box ref={headRef}>
          <SectionHeading
            shown={shown}
            dark
            eyebrow="DỮ LIỆU ĐÔ THỊ CÔNG KHAI"
            title="Theo dõi thành phố mỗi ngày — không cần đăng nhập."
            text="Ngoài phản ánh, hệ thống tổng hợp bản đồ, giao thông, môi trường, camera và thống kê xử lý để mọi người cùng giám sát."
          />
        </Box>

        <Box ref={stageRef} sx={{
          display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, .9fr) minmax(0, 1.1fr)' },
          gap: { xs: 3, md: 6 }, alignItems: 'center',
        }}>
          {/* hình minh hoạ */}
          <Box sx={{ ...revealSx(shown, 200) }}>
            <Box sx={{
              position: 'relative', width: '100%', maxWidth: 460, mx: 'auto', aspectRatio: '360/300',
              borderRadius: '24px', overflow: 'hidden',
              bgcolor: 'rgba(255,255,255,.04)', border: '1px solid rgba(184,216,210,.18)',
              boxShadow: '0 40px 70px -40px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06)',
            }}>
              {Prev && (
                <SandLayer filterId="sand-out" mode="out" progress={phase.progress}>
                  <Box sx={{ width: '100%', height: '100%' }}><Prev /></Box>
                </SandLayer>
              )}
              <SandLayer filterId="sand-in" mode="in" progress={phase.progress}>
                <Box sx={{ width: '100%', height: '100%' }}><Current /></Box>
              </SandLayer>
            </Box>
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2.5 }} aria-hidden="true">
              {MODULES.map((m, i) => (
                <Box key={m.name} sx={{
                  height: 6, borderRadius: 3, width: i === active ? 28 : 6,
                  bgcolor: i === active ? C.accentOnDark : 'rgba(185,205,214,.35)',
                  transition: `width 400ms ${EASE}, background-color 300ms ease`,
                }} />
              ))}
            </Stack>
          </Box>

          {/* danh sách phân hệ */}
          <Box
            component="ul"
            onMouseLeave={() => setHovering(false)}
            sx={{ listStyle: 'none', m: 0, p: 0, borderTop: '1px solid rgba(230,240,242,.14)' }}
          >
            {MODULES.map((m, i) => {
              const Icon = m.icon;
              const isActive = i === active;
              return (
                <Box component="li" key={m.name} sx={{ borderBottom: '1px solid rgba(230,240,242,.14)', ...revealSx(shown, 260 + i * 90) }}>
                  <ButtonBase
                    onClick={() => navigate(m.path)}
                    onMouseEnter={() => { setHovering(true); setActive(i); }}
                    onFocus={() => { setHovering(true); setActive(i); }}
                    onBlur={() => setHovering(false)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: { xs: 1.75, md: 2.25 }, width: '100%', textAlign: 'left',
                      px: { xs: 1, md: 2 }, py: { xs: 2, md: 2.4 },
                      position: 'relative', transition: 'background-color 250ms ease',
                      '&::before': {
                        content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, bgcolor: C.accentOnDark,
                        transform: isActive ? 'scaleY(1)' : 'scaleY(0)', transition: `transform 350ms ${EASE}`,
                      },
                      '&:hover, &:focus-visible': { bgcolor: 'rgba(255,255,255,.05)' },
                    }}
                  >
                    <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, color: isActive ? C.accentOnDark : C.onDarkMuted, width: 22, flexShrink: 0 }}>
                      {String(i + 1).padStart(2, '0')}
                    </Typography>
                    <Box sx={{
                      width: 42, height: 42, borderRadius: '13px', flexShrink: 0, display: 'grid', placeItems: 'center',
                      bgcolor: isActive ? 'rgba(253,186,140,.16)' : 'rgba(255,255,255,.06)',
                      color: isActive ? C.accentOnDark : C.onDark,
                      transition: 'background-color 300ms ease, color 300ms ease',
                    }}>
                      <Icon sx={{ fontSize: 22 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: { xs: 16.5, md: 19 }, fontWeight: 700, color: C.onDark, letterSpacing: '-0.01em' }}>
                        {m.name}
                      </Typography>
                      <Typography sx={{ fontSize: { xs: 13, md: 14 }, color: C.onDarkMuted, lineHeight: 1.5 }}>
                        {m.note}
                      </Typography>
                    </Box>
                    <NorthEastRounded sx={{
                      flexShrink: 0, fontSize: 20,
                      color: isActive ? C.accentOnDark : 'rgba(185,205,214,.55)',
                      transform: isActive ? 'translate(2px,-2px)' : 'none',
                      transition: `transform 300ms ${EASE}, color 300ms ease`,
                      [NO_MOTION]: { transform: 'none' },
                    }} />
                  </ButtonBase>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default ExploreSection;
