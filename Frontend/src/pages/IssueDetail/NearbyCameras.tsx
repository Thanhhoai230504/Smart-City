import React, { useEffect, useState } from 'react';
import { Box, Card, Typography, Stack, Chip, Button } from '@mui/material';
import { Videocam, OpenInNew } from '@mui/icons-material';
import { cameraApi } from '../../api/cameraApi';
import { NearbyCamera } from '../../types';
import { CAMERA_TYPE_MAP } from '../../utils/constants';

interface Props {
  latitude: number;
  longitude: number;
}

/**
 * Camera công cộng quanh vị trí sự cố — cán bộ mở xem trực tiếp để xác minh
 * hiện trường trước khi cử người đi.
 *
 * Không render gì khi không có camera nào trong bán kính: phần lớn camera
 * chưa xác minh được toạ độ nên trường hợp rỗng là bình thường, không phải lỗi.
 */
const NearbyCameras: React.FC<Props> = ({ latitude, longitude }) => {
  const [cameras, setCameras] = useState<NearbyCamera[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [failedIds, setFailedIds] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchCameras = async () => {
      try {
        const { data } = await cameraApi.getNearbyCameras(
          latitude,
          longitude,
          2000,
          controller.signal
        );
        setCameras(data.data.cameras);
      } catch {
        if (!controller.signal.aborted) setCameras([]);
      }
    };

    fetchCameras();
    return () => controller.abort();
  }, [latitude, longitude]);

  if (cameras.length === 0) return null;

  return (
    <Card sx={{ mb: 3, p: 0, overflow: 'hidden' }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ p: 2, pb: 0.5 }}>
        📹 Camera công cộng gần đây
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: 'block' }}>
        Luồng trực tiếp từ kênh YouTube &quot;Phát Triển Đà Nẵng&quot;
      </Typography>

      <Stack spacing={2} sx={{ p: 2 }}>
        {cameras.map((camera) => {
          const info = CAMERA_TYPE_MAP[camera.type] || CAMERA_TYPE_MAP.public;
          const isPlaying = playingId === camera.id;
          const hasFailed = failedIds.includes(camera.id);

          return (
            <Box key={camera.id}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>
                  {info.icon} {camera.name}
                </Typography>
                <Chip
                  label={`${camera.distance} m`}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.06)',
                    color: 'text.secondary',
                    fontWeight: 600,
                  }}
                />
              </Stack>

              <Box
                sx={{
                  position: 'relative',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  bgcolor: 'rgba(0,0,0,0.4)',
                  aspectRatio: '16 / 9',
                }}
              >
                {isPlaying && !hasFailed ? (
                  <Box
                    component="iframe"
                    src={camera.embedUrl}
                    title={camera.name}
                    allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    onError={() => setFailedIds((prev) => [...prev, camera.id])}
                    sx={{ width: '100%', height: '100%', border: 0, display: 'block' }}
                  />
                ) : (
                  <Box
                    onClick={() => !hasFailed && setPlayingId(camera.id)}
                    sx={{
                      width: '100%',
                      height: '100%',
                      position: 'relative',
                      cursor: hasFailed ? 'default' : 'pointer',
                    }}
                  >
                    <Box
                      component="img"
                      src={camera.thumbnailUrl}
                      alt={camera.name}
                      onError={() => setFailedIds((prev) => [...prev, camera.id])}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        bgcolor: 'rgba(0,0,0,0.45)',
                        textAlign: 'center',
                        px: 2,
                      }}
                    >
                      {hasFailed ? (
                        <>
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
                        </>
                      ) : (
                        <>
                          <Videocam sx={{ fontSize: 32, color: info.color }} />
                          <Typography variant="caption" fontWeight={600}>
                            Bấm để xem trực tiếp
                          </Typography>
                        </>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Card>
  );
};

export default NearbyCameras;
