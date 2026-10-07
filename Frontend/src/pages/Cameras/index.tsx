import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  ButtonBase,
  Container,
  Grid,
  Skeleton,
  Stack,
  Typography,
  keyframes,
} from '@mui/material';
import {
  InfoOutlined,
  LiveTvRounded,
  LocationOffOutlined,
  MapRounded,
  OpenInNew,
  PlaceRounded,
  PlayArrowRounded,
  RefreshRounded,
  SensorsRounded,
  VideocamOutlined,
  VideocamRounded,
  VideoLibraryRounded,
} from '@mui/icons-material';
import { cameraApi } from '../../api/cameraApi';
import { CAMERA_TYPE_MAP } from '../../utils/constants';
import { Camera, CameraType } from '../../types';
import { CHROME } from '../../layout/chrome';
import PageHero, { HeroButton, HeroGlassCard, HeroStatTile } from '../../components/PageHero';
import { pillRowSx, pillSx } from '../../components/filterStyles';
import { C, EASE, FONT_MONO, NO_MOTION } from '../Home/homeStyle';
import { GradientText } from '../Home/SectionHeading';

const SOURCE_URL = 'https://www.youtube.com/@0511.VietNam';

/** Chấm đỏ "đang phát" toả vòng. */
const livePulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(227, 77, 89, .6); }
  70% { box-shadow: 0 0 0 8px rgba(227, 77, 89, 0); }
  100% { box-shadow: 0 0 0 0 rgba(227, 77, 89, 0); }
`;
/** Vòng sáng lan ra quanh nút phát. */
const ring = keyframes`
  0% { transform: translate(-50%, -50%) scale(1); opacity: .55; }
  100% { transform: translate(-50%, -50%) scale(1.55); opacity: 0; }
`;

const cardSx = {
  bgcolor: C.white, border: `1px solid ${C.line}`, borderRadius: '20px', overflow: 'hidden',
  boxShadow: '0 1px 2px rgba(15,34,51,.04), 0 18px 40px -32px rgba(15,34,51,.4)',
} as const;

const CameraViewer: React.FC<{ camera: Camera }> = ({ camera }) => {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const info = CAMERA_TYPE_MAP[camera.type] || CAMERA_TYPE_MAP.public;

  if (failed) {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={1.5}
        sx={{
          aspectRatio: '16 / 9', minHeight: 280, px: 3, textAlign: 'center', color: '#FFFFFF',
          background: `radial-gradient(60% 70% at 50% 0%, rgba(63,184,201,.18), rgba(63,184,201,0) 70%), linear-gradient(160deg, ${C.seaDark}, ${C.sea})`,
        }}
      >
        <Box sx={{
          width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center',
          bgcolor: 'rgba(255,255,255,.08)', border: `1px solid ${CHROME.line}`,
        }}>
          <VideocamOutlined sx={{ fontSize: 32, color: CHROME.soft }} />
        </Box>
        <Typography sx={{ fontSize: 17, fontWeight: 800 }}>Luồng camera đang tạm ngưng</Typography>
        <Typography sx={{ maxWidth: 440, fontSize: 14, lineHeight: 1.6, color: CHROME.body }}>
          Chủ kênh có thể đã dừng phát tại thời điểm này. Bạn vẫn có thể kiểm tra trực tiếp tại nguồn.
        </Typography>
        <Button
          endIcon={<OpenInNew />}
          href={camera.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            height: 40, px: 2, borderRadius: 999, fontWeight: 700, color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,.45)',
            '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,.1)' },
          }}
        >
          Mở kênh nguồn
        </Button>
      </Stack>
    );
  }

  if (playing) {
    return (
      <Box sx={{ position: 'relative', aspectRatio: '16 / 9', minHeight: 280, bgcolor: '#071E30' }}>
        <Box
          component="iframe"
          src={camera.embedUrl}
          title={camera.name}
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setFailed(true)}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      </Box>
    );
  }

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`Phát camera ${camera.name}`}
      onClick={() => setPlaying(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setPlaying(true);
        }
      }}
      sx={{
        position: 'relative', aspectRatio: '16 / 9', minHeight: 280, overflow: 'hidden', cursor: 'pointer',
        bgcolor: '#071E30',
        '&:hover .camera-poster': { scale: '1.04' },
        '&:hover .camera-play, &:focus-visible .camera-play': { scale: '1.08', bgcolor: '#FFFFFF', color: C.seaDark },
        '&:focus-visible': { outline: `3px solid ${C.aqua}`, outlineOffset: -3 },
      }}
    >
      <Box className="camera-poster" aria-hidden="true" sx={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${camera.thumbnailUrl})`, backgroundSize: 'cover', backgroundPosition: 'center',
        transition: `scale 900ms ${EASE}`,
      }} />
      {/* lớp tối từ đáy để chữ trắng đọc được trên mọi khung ảnh */}
      <Box aria-hidden="true" sx={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(6,24,38,.92) 0%, rgba(6,24,38,.45) 38%, rgba(6,24,38,.08) 65%, rgba(6,24,38,.25) 100%)',
      }} />

      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ position: 'absolute', top: 16, left: 16, right: 16 }}>
        <Stack direction="row" spacing={0.9} alignItems="center" sx={{
          height: 30, px: 1.25, borderRadius: 999, color: '#FFFFFF',
          bgcolor: 'rgba(6,24,38,.62)', border: '1px solid rgba(255,255,255,.22)', backdropFilter: 'blur(8px)',
        }}>
          <Box sx={{
            width: 8, height: 8, borderRadius: '50%', bgcolor: '#E34D59',
            animation: `${livePulse} 2s ease-out infinite`, [NO_MOTION]: { animation: 'none' },
          }} />
          <Typography component="span" sx={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em' }}>
            LUỒNG CÔNG CỘNG
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{
          height: 30, px: 1.25, borderRadius: 999, color: C.ink,
          bgcolor: 'rgba(255,255,255,.92)', fontSize: 12.5, fontWeight: 700,
        }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: info.color }} />
          <Box component="span">{info.label}</Box>
        </Stack>
      </Stack>

      {/* nút phát + vòng sáng lan ra */}
      <Box aria-hidden="true" sx={{
        position: 'absolute', top: '50%', left: '50%', width: { xs: 64, sm: 78 }, height: { xs: 64, sm: 78 },
        borderRadius: '50%', border: '2px solid rgba(255,255,255,.7)',
        animation: `${ring} 2.2s ease-out infinite`, [NO_MOTION]: { animation: 'none', display: 'none' },
      }} />
      <Box className="camera-play" sx={{
        position: 'absolute', top: '50%', left: '50%', translate: '-50% -50%',
        width: { xs: 64, sm: 78 }, height: { xs: 64, sm: 78 }, display: 'grid', placeItems: 'center',
        borderRadius: '50%', color: '#FFFFFF',
        bgcolor: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.75)', backdropFilter: 'blur(10px)',
        boxShadow: '0 18px 40px -16px rgba(0,0,0,.7)',
        transition: `scale 250ms ${EASE}, background-color 200ms ease, color 200ms ease`,
      }}>
        <PlayArrowRounded sx={{ fontSize: { xs: 36, sm: 44 }, ml: 0.4 }} />
      </Box>

      <Box sx={{ position: 'absolute', left: 20, right: 20, bottom: 18, color: '#FFFFFF' }}>
        <Typography component="h2" sx={{ fontSize: { xs: 19, sm: 24 }, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.2, mb: 0.75 }}>
          {camera.name}
        </Typography>
        <Stack direction="row" spacing={0.6} alignItems="center" sx={{ color: 'rgba(255,255,255,.85)' }}>
          {camera.coords ? <PlaceRounded sx={{ fontSize: 16 }} /> : <LocationOffOutlined sx={{ fontSize: 16 }} />}
          <Typography component="span" sx={{ fontSize: 13 }}>
            {camera.coords ? 'Đã xác minh vị trí — có trên bản đồ' : 'Chưa xác minh tọa độ'}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
};

const CameraListItem: React.FC<{
  camera: Camera;
  selected: boolean;
  onSelect: () => void;
}> = ({ camera, selected, onSelect }) => {
  const info = CAMERA_TYPE_MAP[camera.type] || CAMERA_TYPE_MAP.public;

  return (
    <ButtonBase
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        width: '100%', display: 'grid', gridTemplateColumns: '116px minmax(0, 1fr)', gap: 1.5,
        p: 1, mb: 0.5, borderRadius: '14px', textAlign: 'left', alignItems: 'center',
        border: '1px solid', borderColor: selected ? 'rgba(11,94,142,.32)' : 'transparent',
        bgcolor: selected ? 'rgba(11,94,142,.06)' : 'transparent',
        transition: 'background-color 160ms ease, border-color 160ms ease',
        '&:hover': { bgcolor: selected ? 'rgba(11,94,142,.09)' : '#F5F8FA' },
        '&:hover .camera-thumb': { scale: '1.06' },
        '&:focus-visible': { outline: `2px solid ${C.blue}`, outlineOffset: -2 },
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: '16 / 10', borderRadius: '10px', overflow: 'hidden', bgcolor: '#DCE5EA' }}>
        <Box className="camera-thumb" aria-hidden="true" sx={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${camera.thumbnailUrl})`, backgroundSize: 'cover', backgroundPosition: 'center',
          transition: `scale 500ms ${EASE}`,
        }} />
        {selected ? (
          <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(8,40,60,.55)' }}>
            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ px: 0.9, py: 0.3, borderRadius: 999, bgcolor: 'rgba(6,24,38,.7)' }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#E34D59', animation: `${livePulse} 2s ease-out infinite`, [NO_MOTION]: { animation: 'none' } }} />
              <Typography component="span" sx={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#FFFFFF' }}>
                ĐANG XEM
              </Typography>
            </Stack>
          </Stack>
        ) : (
          <Box aria-hidden="true" sx={{
            position: 'absolute', right: 6, bottom: 6, width: 22, height: 22, borderRadius: '50%',
            display: 'grid', placeItems: 'center', color: '#FFFFFF', bgcolor: 'rgba(6,24,38,.6)',
          }}>
            <PlayArrowRounded sx={{ fontSize: 16 }} />
          </Box>
        )}
      </Box>

      <Stack minWidth={0} spacing={0.6}>
        <Typography sx={{
          fontSize: 14, fontWeight: 700, lineHeight: 1.35, color: selected ? C.blue : C.ink,
          display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
        }}>
          {camera.name}
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: info.color, flexShrink: 0 }} />
          <Typography component="span" sx={{ fontSize: 12.5, color: C.body }}>{info.label}</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: camera.coords ? C.teal : '#7A8C97' }}>
          {camera.coords ? <PlaceRounded sx={{ fontSize: 14 }} /> : <LocationOffOutlined sx={{ fontSize: 14 }} />}
          <Typography component="span" sx={{ fontSize: 12.5, fontWeight: camera.coords ? 600 : 400 }}>
            {camera.coords ? 'Có trên bản đồ' : 'Chưa có tọa độ'}
          </Typography>
        </Stack>
      </Stack>
    </ButtonBase>
  );
};

/**
 * Trang camera công cộng — giữ bố cục cũ (số liệu → lọc theo loại → khung xem + danh sách),
 * đổi sang kiểu chung với trang Sự cố/Thống kê: phần đầu xanh biển (`PageHero`) chứa ba số
 * liệu nguồn camera, hàng lọc theo loại nằm trong thẻ trắng nổi đè lên mép dưới phần đầu.
 * Video chỉ tải iframe khi người xem bấm phát.
 */
const CamerasPage: React.FC = () => {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<CameraType | 'all'>('all');
  const [selectedCameraId, setSelectedCameraId] = useState('');

  const fetchCameras = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await cameraApi.getCameras(signal);
      const nextCameras = response.data.data.cameras;
      setCameras(nextCameras);
      setSelectedCameraId((current) => current || nextCameras[0]?.id || '');
    } catch {
      if (!signal?.aborted) setFailed(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCameras(controller.signal);
    return () => controller.abort();
  }, [fetchCameras]);

  const filtered = useMemo(
    () => (filter === 'all' ? cameras : cameras.filter((camera) => camera.type === filter)),
    [cameras, filter],
  );

  const availableTypes = useMemo(
    () => Object.keys(CAMERA_TYPE_MAP).filter(
      (type) => cameras.some((camera) => camera.type === type),
    ) as CameraType[],
    [cameras],
  );

  const selectedCamera = filtered.find((camera) => camera.id === selectedCameraId)
    || filtered[0]
    || null;

  const camerasWithCoordinates = cameras.filter((camera) => camera.coords).length;

  const pickFilter = (next: CameraType | 'all') => {
    setFilter(next);
    setSelectedCameraId('');
  };

  return (
    <Box sx={{ bgcolor: C.bg, pb: { xs: 6, md: 9 } }}>
      <PageHero
        eyebrow="HẠ TẦNG QUAN SÁT ĐÔ THỊ"
        title={<>Camera <GradientText dark>công cộng</GradientText></>}
        description="Theo dõi các điểm quan sát công khai phục vụ giao thông và quản lý không gian đô thị."
        actions={(
          <>
            <HeroButton startIcon={<MapRounded />} onClick={() => navigate('/map')}>
              Xem trên bản đồ
            </HeroButton>
            <HeroButton endIcon={<OpenInNew />} href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
              Mở kênh nguồn
            </HeroButton>
          </>
        )}
        aside={failed ? (
          <HeroGlassCard>
            <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 0.75 }}>Chưa tải được danh sách camera</Typography>
            <Typography sx={{ fontSize: 14, color: CHROME.body, lineHeight: 1.6, mb: 2 }}>
              Vui lòng kiểm tra kết nối máy chủ và thử lại.
            </Typography>
            <Button
              startIcon={<RefreshRounded />}
              onClick={() => fetchCameras()}
              sx={{ borderRadius: '10px', fontWeight: 700, color: C.seaDark, bgcolor: '#FFFFFF', '&:hover': { bgcolor: '#E3F4F8' } }}
            >
              Thử lại
            </Button>
          </HeroGlassCard>
        ) : (
          <HeroGlassCard>
            <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 1.75 }}>Tổng quan nguồn camera</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
              <HeroStatTile icon={VideocamRounded} label="Nguồn camera" value={loading ? '—' : cameras.length} note="điểm quan sát công khai" />
              <HeroStatTile icon={PlaceRounded} label="Đã định vị" value={loading ? '—' : camerasWithCoordinates} note="có thể hiển thị trên bản đồ" highlight />
              <HeroStatTile icon={LiveTvRounded} label="Nhà cung cấp" value="0511" note="Kênh Phát Triển Đà Nẵng" wide />
            </Box>
          </HeroGlassCard>
        )}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', mt: { xs: -7, md: -8 } }}>
        {/* Lọc theo loại — thẻ trắng nổi đè lên mép dưới phần đầu */}
        <Box sx={{
          ...cardSx, p: { xs: 1.5, md: 2 }, boxShadow: '0 28px 56px -34px rgba(8,40,60,.6)',
          display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { md: 'center' }, gap: { xs: 1.25, md: 2 },
        }}>
          <Typography component="span" sx={{ flexShrink: 0, fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, letterSpacing: '.12em', color: C.muted }}>
            LOẠI CAMERA
          </Typography>
          {loading ? (
            <Stack direction="row" spacing={1}>
              {[96, 120, 120, 110].map((w) => <Skeleton key={w} variant="rounded" width={w} height={38} sx={{ borderRadius: 999 }} />)}
            </Stack>
          ) : (
            <Box role="group" aria-label="Lọc camera theo loại" sx={pillRowSx}>
              <ButtonBase aria-pressed={filter === 'all'} onClick={() => pickFilter('all')} sx={pillSx(filter === 'all')}>
                Tất cả ({cameras.length})
              </ButtonBase>
              {availableTypes.map((type) => {
                const typeInfo = CAMERA_TYPE_MAP[type];
                const count = cameras.filter((camera) => camera.type === type).length;
                const active = filter === type;
                return (
                  <ButtonBase key={type} aria-pressed={active} onClick={() => pickFilter(type)} sx={pillSx(active)}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: typeInfo.color, boxShadow: active ? '0 0 0 2px rgba(255,255,255,.25)' : 'none' }} />
                    {typeInfo.label} ({count})
                  </ButtonBase>
                );
              })}
            </Box>
          )}
          {/* 900–1199 px nhường chỗ cho hàng nút lọc nằm trên một dòng */}
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ display: { xs: 'flex', md: 'none', lg: 'flex' }, ml: { md: 'auto' }, flexShrink: 0, color: C.muted }}>
            <InfoOutlined sx={{ fontSize: 17 }} />
            <Typography component="span" sx={{ fontSize: 13 }}>Video chỉ tải khi bạn nhấn phát</Typography>
          </Stack>
        </Box>

        <Box sx={{ mt: 2.5 }}>
          {loading ? (
            <Grid container spacing={2.5}>
              <Grid item xs={12} md={8}><Skeleton variant="rounded" height={520} sx={{ borderRadius: '20px' }} /></Grid>
              <Grid item xs={12} md={4}><Skeleton variant="rounded" height={520} sx={{ borderRadius: '20px' }} /></Grid>
            </Grid>
          ) : failed ? (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ ...cardSx, p: 2.5, border: '1px dashed #C9D7DE', boxShadow: 'none', color: C.body }}>
              <VideocamOutlined sx={{ color: C.muted }} />
              <Typography sx={{ fontSize: 14.5 }}>Danh sách camera sẽ hiện ở đây khi máy chủ phản hồi.</Typography>
            </Stack>
          ) : selectedCamera ? (
            <Grid container spacing={2.5} alignItems="stretch">
              <Grid item xs={12} md={8}>
                <Box component="section" aria-label="Camera đang xem" sx={{ ...cardSx, height: '100%' }}>
                  <CameraViewer key={selectedCamera.id} camera={selectedCamera} />
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ sm: 'center' }}
                    spacing={1.5}
                    sx={{ px: { xs: 2, sm: 2.5 }, py: 2 }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                      <Box sx={{
                        width: 40, height: 40, flexShrink: 0, borderRadius: '12px', display: 'grid', placeItems: 'center',
                        color: '#FFFFFF', background: `linear-gradient(140deg, ${C.blue}, ${C.teal})`,
                        boxShadow: `0 10px 20px -12px ${C.blue}`,
                      }}>
                        <SensorsRounded sx={{ fontSize: 21 }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Thông tin nguồn phát</Typography>
                        <Typography sx={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                          Video chỉ được tải sau khi bạn nhấn phát để giảm tài nguyên trình duyệt.
                        </Typography>
                      </Box>
                    </Stack>
                    <Button
                      endIcon={<OpenInNew />}
                      href={selectedCamera.watchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        alignSelf: { xs: 'flex-start', sm: 'center' }, flexShrink: 0, whiteSpace: 'nowrap',
                        height: 40, px: 2, borderRadius: 999, fontWeight: 700, color: C.blue,
                        border: `1px solid ${C.line}`,
                        '&:hover': { bgcolor: 'rgba(11,94,142,.06)', borderColor: 'rgba(11,94,142,.35)' },
                      }}
                    >
                      Xem tại nguồn
                    </Button>
                  </Stack>
                </Box>
              </Grid>

              <Grid item xs={12} md={4}>
                {/* Từ 900 px danh sách cao đúng bằng khung xem: chiều cao 0 nên không đẩy hàng cao thêm,
                    min-height 100% để lấp đầy hàng do khung xem quyết định; phần danh sách tự cuộn. */}
                <Box component="aside" aria-label="Danh sách điểm quan sát" sx={{
                  ...cardSx, display: 'flex', flexDirection: 'column',
                  height: { xs: 'auto', md: 0 }, minHeight: { md: '100%' },
                }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2.25, pt: 2.25, pb: 1.75, borderBottom: `1px solid ${C.line}` }}>
                    <Box sx={{
                      width: 40, height: 40, flexShrink: 0, borderRadius: '12px', display: 'grid', placeItems: 'center',
                      color: '#FFFFFF', background: `linear-gradient(140deg, ${C.blue}, ${C.teal})`,
                      boxShadow: `0 10px 20px -12px ${C.blue}`,
                    }}>
                      <VideoLibraryRounded sx={{ fontSize: 21 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography component="h2" sx={{ fontSize: 17.5, fontWeight: 800, color: C.ink, lineHeight: 1.3 }}>Điểm quan sát</Typography>
                      <Typography sx={{ fontSize: 13, color: C.muted }}>Chọn một vị trí để chuyển luồng</Typography>
                    </Box>
                    <Box sx={{ flexShrink: 0, px: 1.1, py: 0.35, borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: C.blue, bgcolor: 'rgba(11,94,142,.07)' }}>
                      {filtered.length} camera
                    </Box>
                  </Stack>

                  <Box sx={{
                    flex: { md: '1 1 0' }, minHeight: 0, overflowY: { md: 'auto' }, p: 1,
                    scrollbarWidth: 'thin', scrollbarColor: '#C9D7DE transparent',
                  }}>
                    {filtered.map((camera) => (
                      <CameraListItem
                        key={camera.id}
                        camera={camera}
                        selected={camera.id === selectedCamera.id}
                        onSelect={() => setSelectedCameraId(camera.id)}
                      />
                    ))}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          ) : (
            <Box sx={{ ...cardSx, py: 7, textAlign: 'center', border: '1px dashed #C9D7DE', boxShadow: 'none' }}>
              <Box sx={{
                width: 64, height: 64, mx: 'auto', mb: 1.5, borderRadius: '50%', display: 'grid', placeItems: 'center',
                color: C.blue, bgcolor: 'rgba(11,94,142,.08)',
              }}>
                <VideocamOutlined sx={{ fontSize: 30 }} />
              </Box>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color: C.ink }}>Không có camera thuộc nhóm này</Typography>
            </Box>
          )}
        </Box>

        {!loading && !failed && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            spacing={0.75}
            sx={{ mt: 3, color: C.muted }}
          >
            <Stack direction="row" spacing={0.75} alignItems="center">
              <LiveTvRounded sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 12.5 }}>Nguồn video công khai từ kênh Phát Triển Đà Nẵng.</Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <InfoOutlined sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 12.5 }}>Một số luồng có thể tạm ngưng phát tùy thời điểm.</Typography>
            </Stack>
          </Stack>
        )}
      </Container>
    </Box>
  );
};

export default CamerasPage;
