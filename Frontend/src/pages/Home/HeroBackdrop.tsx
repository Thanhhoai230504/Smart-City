import React, { useEffect, useRef, useState } from 'react';
import { Box, IconButton } from '@mui/material';
import { PauseRounded, PlayArrowRounded } from '@mui/icons-material';
import { C } from './homeStyle';

// Video 30 giây ghép từ 5 cảnh Đà Nẵng (Bàn Cờ, Linh Ứng, Bảy Mẫu, Hải Vân, Cầu Vàng),
// 1080p, 2 Mbps, không tiếng; ảnh tĩnh là khung đầu tiên của video.
const VIDEO_SRC = '/videos/danang-hero.mp4';
const POSTER_SRC = '/videos/danang-hero.jpg';
const WIDE = '(min-width: 768px)';
const REDUCED = '(prefers-reduced-motion: reduce)';

/** Chỉ phát video trên màn ≥ 768 px, khi không bật giảm chuyển động hay tiết kiệm dữ liệu. */
const canPlay = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  return window.matchMedia(WIDE).matches && !window.matchMedia(REDUCED).matches && !saveData;
};

const useVideoAllowed = () => {
  const [allowed, setAllowed] = useState(canPlay);
  useEffect(() => {
    const queries = [window.matchMedia(WIDE), window.matchMedia(REDUCED)];
    const update = () => setAllowed(canPlay());
    queries.forEach((q) => q.addEventListener('change', update));
    return () => queries.forEach((q) => q.removeEventListener('change', update));
  }, []);
  return allowed;
};

/**
 * Nền phần đầu trang chủ: ảnh tĩnh luôn có (điện thoại chỉ dùng ảnh này), video phủ lên
 * trên khi được phép, rồi lớp phủ xanh biển giữ chữ trắng đủ tương phản trên mọi khung hình.
 * Video tự dừng khi cuộn khỏi tầm nhìn; nút dừng/phát đáp ứng WCAG 2.2.2.
 */
const HeroBackdrop: React.FC = () => {
  const allowed = useVideoAllowed();
  const videoRef = useRef<HTMLVideoElement>(null);
  // `playing` theo trạng thái thật của video (trình duyệt có thể chặn tự phát, ví dụ chế
  // độ tiết kiệm pin); `userPaused` là ý người xem, để cuộn qua lại không tự phát lại.
  const [playing, setPlaying] = useState(false);
  const userPaused = useRef(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!allowed || !v) return undefined;
    v.muted = true; // trình duyệt chỉ cho tự phát khi đã tắt tiếng
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !userPaused.current) v.play().catch(() => undefined);
      else v.pause();
    }, { threshold: 0.1 });
    io.observe(v);
    return () => io.disconnect();
  }, [allowed]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      userPaused.current = false;
      v.play().catch(() => undefined);
    } else {
      userPaused.current = true;
      v.pause();
    }
  };

  return (
    <>
      <Box aria-hidden="true" sx={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        bgcolor: C.seaDark,
        backgroundImage: `url(${POSTER_SRC})`, backgroundSize: 'cover', backgroundPosition: 'center',
      }}>
        {allowed && (
          <video
            ref={videoRef}
            src={VIDEO_SRC}
            poster={POSTER_SRC}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {/* Lớp phủ: đậm ở bên chữ (≥ 0,8 nên chữ trắng vẫn ≥ 6:1 kể cả trên mảng trời trắng),
            nhạt dần về phía bảng số liệu vốn đã có nền kính riêng. */}
        <Box sx={{
          position: 'absolute', inset: 0,
          background: {
            xs: 'linear-gradient(180deg, rgba(8,40,60,.74) 0%, rgba(8,40,60,.84) 100%)',
            md: 'linear-gradient(90deg, rgba(8,40,60,.88) 0%, rgba(8,40,60,.8) 40%, rgba(8,40,60,.62) 62%, rgba(8,40,60,.42) 100%)',
          },
        }} />
        <Box sx={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 140,
          background: 'linear-gradient(180deg, rgba(8,40,60,0) 0%, rgba(8,40,60,.45) 100%)',
        }} />
      </Box>
      {allowed && (
        <IconButton
          onClick={toggle}
          aria-label={playing ? 'Tạm dừng video nền' : 'Phát video nền'}
          title={playing ? 'Tạm dừng video nền' : 'Phát video nền'}
          size="small"
          sx={{
            position: 'absolute', zIndex: 2, left: 24, bottom: 18, width: 34, height: 34,
            color: 'rgba(255,255,255,.85)', bgcolor: 'rgba(255,255,255,.08)',
            border: '1px solid rgba(255,255,255,.22)', backdropFilter: 'blur(6px)',
            '&:hover': { bgcolor: 'rgba(255,255,255,.18)', color: '#FFFFFF' },
          }}
        >
          {playing ? <PauseRounded fontSize="small" /> : <PlayArrowRounded fontSize="small" />}
        </IconButton>
      )}
    </>
  );
};

export default HeroBackdrop;
