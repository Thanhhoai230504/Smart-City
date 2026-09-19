import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  LocationOffOutlined,
  MapOutlined,
  OpenInNew,
  PlayArrow,
  Refresh,
  VideocamOutlined,
} from '@mui/icons-material';
import { cameraApi } from '../../api/cameraApi';
import { CAMERA_TYPE_MAP } from '../../utils/constants';
import { Camera, CameraType } from '../../types';

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
          aspectRatio: '16 / 9',
          minHeight: 280,
          px: 3,
          textAlign: 'center',
          bgcolor: '#0A2133',
          color: '#FFFFFF',
        }}
      >
        <VideocamOutlined sx={{ fontSize: 38, color: 'rgba(255,255,255,0.55)' }} />
        <Typography fontWeight={700}>Luồng camera đang tạm ngưng</Typography>
        <Typography variant="body2" sx={{ maxWidth: 440, color: 'rgba(255,255,255,0.65)' }}>
          Chủ kênh có thể đã dừng phát tại thời điểm này. Bạn vẫn có thể kiểm tra trực tiếp tại nguồn.
        </Typography>
        <Button
          variant="outlined"
          size="small"
          endIcon={<OpenInNew />}
          href={camera.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: '#FFFFFF',
            borderColor: 'rgba(255,255,255,0.45)',
            '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.08)' },
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
        position: 'relative',
        aspectRatio: '16 / 9',
        minHeight: 280,
        overflow: 'hidden',
        cursor: 'pointer',
        bgcolor: '#071E30',
        backgroundImage: `linear-gradient(to top, rgba(4,18,29,.9), rgba(4,18,29,.05) 58%), url(${camera.thumbnailUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        '&:hover .camera-play': {
          transform: 'translate(-50%, -50%) scale(1.06)',
          bgcolor: '#FFFFFF',
          color: '#073B5C',
        },
      }}
    >
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{
          position: 'absolute',
          top: 18,
          left: 18,
          px: 1.1,
          py: 0.55,
          bgcolor: 'rgba(7,30,48,0.82)',
          color: '#FFFFFF',
          border: '1px solid rgba(255,255,255,0.24)',
          borderRadius: 1,
          backdropFilter: 'blur(8px)',
        }}
      >
        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#E34D59' }} />
        <Typography variant="caption" fontWeight={750} letterSpacing={0.5}>
          LUỒNG CÔNG CỘNG
        </Typography>
      </Stack>

      <Box
        className="camera-play"
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: 58, sm: 68 },
          height: { xs: 58, sm: 68 },
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          bgcolor: 'rgba(7,30,48,0.78)',
          color: '#FFFFFF',
          border: '1px solid rgba(255,255,255,0.72)',
          transition: 'transform 160ms ease, background-color 160ms ease, color 160ms ease',
        }}
      >
        <PlayArrow sx={{ fontSize: { xs: 34, sm: 40 }, ml: 0.4 }} />
      </Box>

      <Box sx={{ position: 'absolute', left: 20, right: 20, bottom: 18, color: '#FFFFFF' }}>
        <Typography variant="h5" component="h2" fontWeight={700} mb={0.5}>
          {camera.name}
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Stack direction="row" spacing={0.65} alignItems="center">
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: info.color }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.82)' }}>
              {info.label}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.55} alignItems="center">
            {camera.coords
              ? <MapOutlined sx={{ fontSize: 15 }} />
              : <LocationOffOutlined sx={{ fontSize: 15 }} />}
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)' }}>
              {camera.coords ? 'Đã xác minh vị trí' : 'Chưa xác minh tọa độ'}
            </Typography>
          </Stack>
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
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '112px minmax(0, 1fr)',
        gap: 1.25,
        p: 1.25,
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        bgcolor: selected ? '#EEF5F8' : 'transparent',
        border: 0,
        borderBottom: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer',
        transition: 'background-color 150ms ease',
        '&:hover': { bgcolor: selected ? '#E7F1F5' : '#F7F9FA' },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: -2,
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '16 / 10',
          bgcolor: '#DCE5EA',
          backgroundImage: `linear-gradient(rgba(7,30,48,.08), rgba(7,30,48,.08)), url(${camera.thumbnailUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: 0.75,
          overflow: 'hidden',
        }}
      >
        {selected && (
          <Box sx={{ position: 'absolute', inset: 0, border: '2px solid #0B5E8E', borderRadius: 0.75 }} />
        )}
      </Box>

      <Stack minWidth={0} justifyContent="center" spacing={0.7}>
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {camera.name}
        </Typography>
        <Stack direction="row" spacing={0.65} alignItems="center">
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: info.color }} />
          <Typography variant="caption" color="text.secondary">{info.label}</Typography>
        </Stack>
        <Typography variant="caption" color={camera.coords ? 'secondary.dark' : 'text.disabled'}>
          {camera.coords ? 'Có trên bản đồ' : 'Chưa có tọa độ'}
        </Typography>
      </Stack>
    </Box>
  );
};

const CamerasPage: React.FC = () => {
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

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 } }}>
      <Box
        component="header"
        sx={{
          pb: 3,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'flex-end' }}
          spacing={2}
        >
          <Box>
            <Typography variant="body2" color="primary.main" fontWeight={700} mb={0.75}>
              Hạ tầng quan sát đô thị
            </Typography>
            <Typography variant="h3" component="h1" mb={0.75}>
              Camera công cộng
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 690 }}>
              Theo dõi các điểm quan sát công khai phục vụ giao thông và quản lý không gian đô thị.
            </Typography>
          </Box>

          <Button
            variant="outlined"
            endIcon={<OpenInNew />}
            href="https://www.youtube.com/@0511.VietNam"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ alignSelf: { xs: 'flex-start', sm: 'flex-end' }, whiteSpace: 'nowrap' }}
          >
            Mở kênh nguồn
          </Button>
        </Stack>
      </Box>

      {loading ? (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' },
              borderLeft: '1px solid',
              borderBottom: '1px solid',
              borderColor: 'divider',
              mb: 3,
            }}
          >
            {Array.from({ length: 3 }).map((_, index) => (
              <Box key={index} sx={{ p: 2, borderTop: '1px solid #D8E1E7', borderRight: '1px solid #D8E1E7' }}>
                <Skeleton width="55%" />
                <Skeleton height={32} width="40%" />
              </Box>
            ))}
          </Box>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={8}><Skeleton variant="rounded" height={430} /></Grid>
            <Grid item xs={12} md={4}><Skeleton variant="rounded" height={430} /></Grid>
          </Grid>
        </>
      ) : failed ? (
        <Alert
          severity="error"
          sx={{ mt: 3 }}
          action={(
            <Button color="inherit" size="small" startIcon={<Refresh />} onClick={() => fetchCameras()}>
              Thử lại
            </Button>
          )}
        >
          Không tải được danh sách camera. Vui lòng kiểm tra kết nối máy chủ và thử lại.
        </Alert>
      ) : (
        <>
          <Box
            component="section"
            aria-label="Tổng quan nguồn camera"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' },
              mb: 0,
              bgcolor: 'background.paper',
              borderLeft: '1px solid',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            {[
              { label: 'Nguồn camera', value: cameras.length, note: 'điểm quan sát công khai' },
              { label: 'Đã định vị', value: camerasWithCoordinates, note: 'có thể hiển thị trên bản đồ' },
              { label: 'Nhà cung cấp', value: '0511', note: 'Phát Triển Đà Nẵng' },
            ].map((item, index) => (
              <Box
                key={item.label}
                sx={{
                  px: 2.25,
                  py: 1.75,
                  gridColumn: { xs: index === 2 ? '1 / -1' : 'auto', sm: 'auto' },
                  borderTop: '1px solid',
                  borderRight: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                <Typography variant="h6" component="p" mt={0.2}>{item.value}</Typography>
                <Typography variant="caption" color="text.disabled">{item.note}</Typography>
              </Box>
            ))}
          </Box>

          <Box
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              mb: 2.5,
            }}
          >
            <Tabs
              value={filter}
              onChange={(_, nextFilter: CameraType | 'all') => {
                setFilter(nextFilter);
                setSelectedCameraId('');
              }}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="Lọc camera theo loại"
            >
              <Tab value="all" label={`Tất cả (${cameras.length})`} />
              {availableTypes.map((type) => {
                const typeInfo = CAMERA_TYPE_MAP[type];
                const count = cameras.filter((camera) => camera.type === type).length;
                return <Tab key={type} value={type} label={`${typeInfo.label} (${count})`} />;
              })}
            </Tabs>
          </Box>

          {selectedCamera ? (
            <Grid container spacing={2.5} alignItems="stretch">
              <Grid item xs={12} md={8}>
                <Box
                  component="section"
                  aria-label="Camera đang xem"
                  sx={{
                    height: '100%',
                    overflow: 'hidden',
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                  }}
                >
                  <CameraViewer key={selectedCamera.id} camera={selectedCamera} />
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ sm: 'center' }}
                    spacing={1.5}
                    sx={{ px: 2.25, py: 1.75 }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={700}>Thông tin nguồn phát</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Video chỉ được tải sau khi bạn nhấn phát để giảm tài nguyên trình duyệt.
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      endIcon={<OpenInNew />}
                      href={selectedCamera.watchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, whiteSpace: 'nowrap' }}
                    >
                      Xem tại nguồn
                    </Button>
                  </Stack>
                </Box>
              </Grid>

              <Grid item xs={12} md={4}>
                <Box
                  component="aside"
                  aria-label="Danh sách điểm quan sát"
                  sx={{
                    height: '100%',
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    overflow: 'hidden',
                  }}
                >
                  <Box sx={{ px: 2, py: 1.7, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                      <Typography variant="h6" component="h2">Điểm quan sát</Typography>
                      <Typography variant="caption" color="text.secondary">{filtered.length} camera</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Chọn một vị trí để chuyển luồng
                    </Typography>
                  </Box>

                  <Box sx={{ maxHeight: { md: 438 }, overflowY: 'auto' }}>
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
            <Box
              sx={{
                py: 7,
                textAlign: 'center',
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
              }}
            >
              <VideocamOutlined sx={{ fontSize: 38, color: 'text.disabled', mb: 1 }} />
              <Typography fontWeight={650}>Không có camera thuộc nhóm này</Typography>
            </Box>
          )}

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            spacing={0.75}
            sx={{ mt: 2.5, color: 'text.secondary' }}
          >
            <Typography variant="caption">
              Nguồn video công khai từ kênh Phát Triển Đà Nẵng.
            </Typography>
            <Typography variant="caption">
              Một số luồng có thể tạm ngưng phát tùy thời điểm.
            </Typography>
          </Stack>
        </>
      )}
    </Container>
  );
};

export default CamerasPage;
