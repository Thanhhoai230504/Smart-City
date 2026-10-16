import React, { useState } from 'react';
import { Box, Button, Collapse, Link, Stack, Typography } from '@mui/material';
import {
  AndroidRounded,
  AutoAwesomeRounded,
  CloudSyncRounded,
  DownloadRounded,
  ExpandMoreRounded,
  HelpOutlineRounded,
  NotificationsActiveRounded,
  PhoneIphoneRounded,
} from '@mui/icons-material';
import { C, EASE, NO_MOTION, floatY, gradientPan, revealSx } from './homeStyle';
import { useInView } from './hooks';
import { GradientText } from './SectionHeading';
import { categoryIcon } from './categoryIcons';
import appHomeShot from '../../assets/app/app-home.webp';
import appQr from '../../assets/app/app-download-qr.svg';

/**
 * APK nằm ngoài bản build web: Nginx phục vụ `/downloads/` từ `/srv/smartcity/downloads`
 * (bản mới đưa lên bằng `deploy-vps/upload-apk.sh`), nên deploy lại web không làm mất tệp.
 * Mã QR `assets/app/app-download-qr.svg` mã hoá đúng `https://smartcitydn.io.vn` + APK_URL —
 * đổi tên miền hay tên tệp thì phải tạo lại mã.
 */
const APK_URL = '/downloads/SmartCity-DaNang.apk';
const APK_32BIT_URL = '/downloads/SmartCity-DaNang-32bit.apk';

const FEATURES = [
  { icon: AutoAwesomeRounded, text: 'Chụp ảnh là AI gợi ý loại sự cố, bạn chỉ cần xác nhận' },
  { icon: CloudSyncRounded, text: 'Mất sóng vẫn gửi được: phản ánh chờ trong máy, có mạng lại thì tự gửi' },
  { icon: NotificationsActiveRounded, text: 'Theo dõi tiến độ xử lý và xem thông báo ngay trong app' },
];

const INSTALL_STEPS = [
  'Bấm "Tải app cho Android" (hoặc quét mã QR bằng camera điện thoại), rồi mở tệp SmartCity-DaNang.apk vừa tải.',
  'Nếu máy hỏi, cho phép cài ứng dụng từ nguồn này (trình duyệt hoặc Trình quản lý tệp).',
  'Nếu Google Play Protect cảnh báo, mở phần chi tiết và chọn "Vẫn cài đặt" — app chưa đăng lên CH Play nên máy chưa nhận ra.',
  'Mở app, đăng nhập bằng tài khoản trên web hoặc bấm "Đăng nhập bằng Google".',
];

// Các "ghim" sự cố trôi quanh điện thoại, giữ nét trang trí của thẻ kêu gọi cũ.
const PINS = [
  { key: 'pothole', left: '4%', top: '14%', size: 52, delay: 0 },
  { key: 'streetlight', right: '6%', top: '30%', size: 46, delay: -2 },
  { key: 'garbage', right: '14%', bottom: '8%', size: 54, delay: -3 },
];

const linkOnDark = {
  color: C.onDark, fontWeight: 700, textDecorationColor: 'rgba(244,248,250,.5)',
  '&:hover': { textDecorationColor: C.onDark },
};

/**
 * Cuối trang chủ: giới thiệu ứng dụng Android và cho tải APK. Thay thẻ "Thấy sự cố?
 * Báo ngay." trước đây — nút báo cáo đã có ở đầu trang, còn người xem trên máy tính
 * thì cần một đường đưa app sang điện thoại (mã QR).
 */
const AppSection: React.FC = () => {
  const [ref, shown] = useInView<HTMLDivElement>({ threshold: 0.25 });
  const [showSteps, setShowSteps] = useState(false);

  return (
    <Box component="section" ref={ref} aria-labelledby="app-section-title" sx={{ bgcolor: C.bg, py: { xs: 6, md: 10 }, px: { xs: 2, md: 3 } }}>
      <Box sx={{
        position: 'relative', overflow: 'hidden', maxWidth: 1240, mx: 'auto',
        borderRadius: { xs: '28px', md: '40px' }, py: { xs: 7, md: 9 }, px: { xs: 2.5, sm: 4, md: 7 },
        background: `linear-gradient(120deg, ${C.blueDeep}, ${C.blue}, ${C.teal}, ${C.blue})`,
        backgroundSize: '300% 300%',
        boxShadow: '0 50px 90px -50px rgba(7,59,92,.7)',
        animation: `${gradientPan} 18s ease infinite`,
        [NO_MOTION]: { animation: 'none' },
      }}>
        <Box sx={{
          position: 'relative', display: 'grid', alignItems: 'center',
          gridTemplateColumns: { xs: '1fr', md: '1.15fr 1fr' }, gap: { xs: 5, md: 6 },
        }}>
          <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 32, px: 1.5, mb: 2.5, borderRadius: 999,
              bgcolor: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.24)', color: C.onDark,
              fontSize: 13.5, fontWeight: 700,
              ...revealSx(shown),
            }}>
              <AndroidRounded sx={{ fontSize: 18 }} /> Ứng dụng Android
            </Box>
            <Typography id="app-section-title" component="h2" sx={{
              color: '#FFFFFF', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.08,
              fontSize: { xs: '2.1rem', md: '3.1rem' }, mb: 2,
              ...revealSx(shown, 60),
            }}>
              Báo sự cố ngay{' '}
              {/* Từ md xuống dòng trọn cụm, tránh để "thoại." rơi một mình sang dòng sau. */}
              <Box component="span" sx={{ display: { md: 'block' } }}>
                <GradientText dark>trên điện thoại.</GradientText>
              </Box>
            </Typography>
            <Typography sx={{
              color: 'rgba(244,248,250,.88)', fontSize: { xs: 16, md: 18 }, lineHeight: 1.65,
              maxWidth: 560, mx: { xs: 'auto', md: 0 }, mb: 3,
              ...revealSx(shown, 120),
            }}>
              Smart City ĐN dùng chung tài khoản với trang web: thấy sự cố ở đâu thì chụp và gửi ngay tại chỗ.
            </Typography>

            <Stack component="ul" spacing={1.5} sx={{
              listStyle: 'none', p: 0, m: 0, mb: 4, maxWidth: 560, mx: { xs: 'auto', md: 0 }, textAlign: 'left',
              ...revealSx(shown, 180),
            }}>
              {FEATURES.map(({ icon: Icon, text }) => (
                <Box component="li" key={text} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box aria-hidden="true" sx={{
                    width: 38, height: 38, flexShrink: 0, borderRadius: '12px', display: 'grid', placeItems: 'center',
                    bgcolor: 'rgba(255,255,255,.12)', color: '#A3E8C8',
                  }}>
                    <Icon sx={{ fontSize: 20 }} />
                  </Box>
                  <Typography sx={{ color: C.onDark, fontSize: { xs: 15, md: 16 }, lineHeight: 1.5 }}>{text}</Typography>
                </Box>
              ))}
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent={{ xs: 'center', md: 'flex-start' }} sx={{ ...revealSx(shown, 240) }}>
              <Button
                size="large"
                component="a"
                href={APK_URL}
                download
                startIcon={<DownloadRounded />}
                sx={{
                  px: 3.5, py: 1.6, borderRadius: '14px', fontSize: 16, fontWeight: 700, textTransform: 'none',
                  bgcolor: C.accent, color: '#FFFFFF', boxShadow: '0 18px 34px -16px rgba(0,0,0,.55)',
                  transition: `transform 250ms ${EASE}, background-color 200ms ease`,
                  '&:hover': { bgcolor: C.accentHover, transform: 'translateY(-2px)' },
                }}
              >
                Tải app cho Android
              </Button>
              <Button
                size="large"
                variant="outlined"
                startIcon={<HelpOutlineRounded />}
                endIcon={<ExpandMoreRounded sx={{ transition: 'transform 200ms ease', transform: showSteps ? 'rotate(180deg)' : 'none' }} />}
                aria-expanded={showSteps}
                aria-controls="app-install-steps"
                onClick={() => setShowSteps((open) => !open)}
                sx={{
                  px: 3, py: 1.6, borderRadius: '14px', fontSize: 16, fontWeight: 700, textTransform: 'none',
                  color: '#FFFFFF', borderColor: 'rgba(255,255,255,.55)', borderWidth: 1.5,
                  '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,.1)', borderWidth: 1.5 },
                }}
              >
                Cách cài đặt
              </Button>
            </Stack>

            <Collapse in={showSteps} id="app-install-steps">
              <Box component="ol" sx={{
                mt: 2.5, mb: 0, mx: { xs: 'auto', md: 0 }, maxWidth: 560, py: 2, pr: 2.5, pl: 4.5, textAlign: 'left',
                borderRadius: '16px', bgcolor: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)',
                color: C.onDark, fontSize: 15, lineHeight: 1.6,
                '& li + li': { mt: 0.75 },
              }}>
                {INSTALL_STEPS.map((step) => <li key={step}>{step}</li>)}
              </Box>
            </Collapse>

            <Typography sx={{ mt: 2.5, color: C.onDarkMuted, fontSize: 14, lineHeight: 1.6, ...revealSx(shown, 300) }}>
              Android 7.0 trở lên · khoảng 24 MB · bản thử nghiệm, chưa có trên CH Play.
              {' '}Máy đời cũ không cài được? <Link href={APK_32BIT_URL} download sx={linkOnDark}>Tải bản 32-bit</Link>.
            </Typography>
            <Typography sx={{
              mt: 1, color: C.onDarkMuted, fontSize: 14, lineHeight: 1.6,
              display: 'flex', alignItems: 'flex-start', justifyContent: { xs: 'center', md: 'flex-start' }, gap: 0.75,
              ...revealSx(shown, 300),
            }}>
              <PhoneIphoneRounded aria-hidden="true" sx={{ fontSize: 18, mt: '2px' }} />
              <span>Dùng iPhone? Mở trang này bằng Safari, bấm Chia sẻ rồi "Thêm vào Màn hình chính".</span>
            </Typography>
          </Box>

          <Box aria-hidden="true" sx={{
            position: 'relative', display: { xs: 'none', sm: 'block' }, minHeight: { sm: 520, md: 560 },
            ...revealSx(shown, 200),
          }}>
            {PINS.map((pin) => {
              const Icon = categoryIcon(pin.key);
              return (
                <Box key={pin.key} sx={{
                  display: { xs: 'none', md: 'grid' }, placeItems: 'center',
                  position: 'absolute', left: pin.left, right: pin.right, top: pin.top, bottom: pin.bottom,
                  width: pin.size, height: pin.size, borderRadius: '50%',
                  bgcolor: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.22)',
                  color: 'rgba(255,255,255,.85)',
                  animation: `${floatY} 6s ease-in-out ${pin.delay}s infinite`,
                  [NO_MOTION]: { animation: 'none' },
                }}>
                  <Icon sx={{ fontSize: pin.size * 0.48 }} />
                </Box>
              );
            })}

            <Box sx={{
              position: 'relative', width: { sm: 230, md: 240 }, mx: 'auto', p: '9px', borderRadius: '40px',
              bgcolor: '#0B1620', boxShadow: '0 40px 70px -30px rgba(0,0,0,.65), inset 0 0 0 1.5px rgba(255,255,255,.14)',
              animation: `${floatY} 7s ease-in-out infinite`,
              [NO_MOTION]: { animation: 'none' },
            }}>
              <Box component="img" src={appHomeShot} alt="" width={480} height={1077} loading="lazy" decoding="async"
                sx={{ display: 'block', width: '100%', height: 'auto', borderRadius: '31px' }} />
            </Box>

            <Box sx={{
              // Neo theo mép trái điện thoại (giữa cột − nửa máy − bề rộng thẻ + phần chồng lên).
              position: 'absolute', left: 'calc(50% - 250px)', bottom: { sm: 24, md: 40 },
              width: 150, p: 1.5, borderRadius: '18px', bgcolor: C.white, textAlign: 'center',
              boxShadow: '0 24px 48px -20px rgba(4,30,46,.55)',
            }}>
              <Box component="img" src={appQr} alt="" width={120} height={120}
                sx={{ display: 'block', width: 120, height: 120, mx: 'auto' }} />
              <Typography sx={{ mt: 1, color: C.ink, fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>
                Quét để tải app
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default AppSection;
