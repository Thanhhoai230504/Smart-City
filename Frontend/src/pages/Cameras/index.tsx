import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Container, Typography, Grid, Card, CardContent, Chip,
  Stack, Skeleton, Alert, Link, Button,
} from '@mui/material';
import { Videocam, PlayArrow, LocationOff, OpenInNew } from '@mui/icons-material';
import { cameraApi } from '../../api/cameraApi';
import { CAMERA_TYPE_MAP } from '../../utils/constants';
import { Camera, CameraType } from '../../types';

/** Chỉ nạp iframe sau khi người dùng bấm — 10 iframe tự phát cùng lúc sẽ làm treo trang */
const CameraCard: React.FC<{ camera: Camera }> = ({ camera }) => {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const info = CAMERA_TYPE_MAP[camera.type] || CAMERA_TYPE_MAP.public;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ position: 'relative', pt: '56.25%', bgcolor: '#000' }}>
        {failed ? (
          <Stack
            spacing={1}
            sx={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 2,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Luồng hiện không phát. Chủ kênh có thể đã tạm tắt camera này.
            </Typography>
            <Button
              size="small"
              endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
              href={camera.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Mở trên YouTube
            </Button>
          </Stack>
        ) : playing ? (
          <Box
            component="iframe"
            src={camera.embedUrl}
            title={camera.name}
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onError={() => setFailed(true)}
            sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
          />
        ) : (
          <Box
            onClick={() => setPlaying(true)}
            role="button"
            tabIndex={0}
            aria-label={`Phát camera ${camera.name}`}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPlaying(true); }}
            sx={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundImage: `url(${camera.thumbnailUrl})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              '&:hover .play-icon': { transform: 'scale(1.12)' },
            }}
          >
            <Box
              className="play-icon"
              sx={{
                width: 60, height: 60, borderRadius: '50%',
                bgcolor: 'rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.2s',
              }}
            >
              <PlayArrow sx={{ color: '#fff', fontSize: 34 }} />
            </Box>
          </Box>
        )}
      </Box>

      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          {camera.name}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={`${info.icon} ${info.label}`}
            sx={{
              bgcolor: `${info.color}22`,
              color: info.color,
              border: `1px solid ${info.color}55`,
              fontWeight: 700,
            }}
          />
          {!camera.coords && (
            <Chip
              size="small"
              variant="outlined"
              icon={<LocationOff sx={{ fontSize: 15 }} />}
              label="Chưa có toạ độ"
              sx={{ color: 'text.secondary', '& .MuiChip-icon': { color: 'inherit' } }}
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

const CamerasPage: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<CameraType | 'all'>('all');

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        const res = await cameraApi.getCameras(controller.signal);
        setCameras(res.data.data.cameras);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, []);

  const filtered = useMemo(
    () => (filter === 'all' ? cameras : cameras.filter((c) => c.type === filter)),
    [cameras, filter]
  );

  const availableTypes = useMemo(
    () => Object.keys(CAMERA_TYPE_MAP).filter((type) => cameras.some((c) => c.type === type)),
    [cameras]
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
        <Videocam color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" fontWeight={800}>Camera công cộng</Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Luồng trực tiếp từ kênh{' '}
        <Link href="https://www.youtube.com/@0511.VietNam" target="_blank" rel="noopener noreferrer">
          Phát Triển Đà Nẵng
        </Link>
        . Một số luồng có thể tạm ngừng phát tuỳ thời điểm.
      </Typography>

      {loading ? (
        <Grid container spacing={3}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rounded" height={280} sx={{ borderRadius: '18px' }} />
            </Grid>
          ))}
        </Grid>
      ) : failed ? (
        <Alert severity="error">Không tải được danh sách camera. Vui lòng thử lại sau.</Alert>
      ) : (
        <>
          <Stack direction="row" spacing={1} mb={3} flexWrap="wrap" useFlexGap>
            <Chip
              label="Tất cả"
              onClick={() => setFilter('all')}
              sx={{
                bgcolor: filter === 'all' ? 'primary.main' : 'rgba(255,255,255,0.05)',
                color: filter === 'all' ? '#fff' : 'text.secondary',
                fontWeight: filter === 'all' ? 600 : 400,
              }}
            />
            {availableTypes.map((type) => {
              const info = CAMERA_TYPE_MAP[type];
              const active = filter === type;
              return (
                <Chip
                  key={type}
                  label={`${info.icon} ${info.label}`}
                  onClick={() => setFilter(type as CameraType)}
                  sx={{
                    bgcolor: active ? 'primary.main' : 'rgba(255,255,255,0.05)',
                    color: active ? '#fff' : 'text.secondary',
                    fontWeight: active ? 600 : 400,
                  }}
                />
              );
            })}
          </Stack>

          <Grid container spacing={3}>
            {filtered.map((camera) => (
              <Grid item xs={12} sm={6} md={4} key={camera.id}>
                <CameraCard camera={camera} />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Container>
  );
};

export default CamerasPage;
