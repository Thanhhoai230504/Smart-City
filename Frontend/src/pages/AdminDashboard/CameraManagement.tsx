import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  LocationOff,
  Map,
  OpenInNew,
  Refresh,
  Videocam,
} from '@mui/icons-material';
import { cameraApi } from '../../api/cameraApi';
import { Camera, CameraType } from '../../types';
import { CAMERA_TYPE_MAP } from '../../utils/constants';
import { GlassCard } from './types';

const CameraManagement: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<CameraType | 'all'>('all');

  const loadCameras = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await cameraApi.getCameras();
      setCameras(data.data.cameras);
    } catch {
      setError('Không tải được danh sách camera. Vui lòng kiểm tra API và thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCameras();
  }, []);

  const filteredCameras = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi');
    return cameras.filter((camera) => {
      const matchesType = type === 'all' || camera.type === type;
      const matchesSearch = !keyword || camera.name.toLocaleLowerCase('vi').includes(keyword);
      return matchesType && matchesSearch;
    });
  }, [cameras, search, type]);

  const mappedCount = cameras.filter((camera) => camera.coords).length;
  const typeCount = new Set(cameras.map((camera) => camera.type)).size;

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        spacing={1.5}
      >
        <Box>
          <Typography variant="h6" fontWeight={800}>Quản lý camera công cộng</Typography>
          <Typography variant="body2" color="text.secondary">
            Theo dõi nguồn phát, phân loại và mức độ hoàn thiện tọa độ camera trong hệ thống.
          </Typography>
        </Box>
        <Button startIcon={<Refresh />} variant="outlined" onClick={loadCameras} disabled={loading}>
          Làm mới
        </Button>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        {[
          { icon: <Videocam />, value: cameras.length, label: 'Tổng nguồn camera', color: '#176B87', bg: '#EAF3F4' },
          { icon: <Map />, value: mappedCount, label: 'Đã có tọa độ', color: '#286653', bg: '#E0F1EB' },
          { icon: <LocationOff />, value: cameras.length - mappedCount, label: 'Cần bổ sung tọa độ', color: '#8A5A12', bg: '#F8F0DF' },
        ].map((item) => (
          <GlassCard key={item.label} sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center', color: item.color, bgcolor: item.bg }}>
                {item.icon}
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={800}>{item.value}</Typography>
                <Typography variant="caption" color="text.secondary">{item.label}</Typography>
              </Box>
            </Stack>
          </GlassCard>
        ))}
      </Box>

      <GlassCard sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            label="Tìm theo tên camera"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel id="camera-type-filter-label">Loại camera</InputLabel>
            <Select
              labelId="camera-type-filter-label"
              value={type}
              label="Loại camera"
              onChange={(event) => setType(event.target.value as CameraType | 'all')}
            >
              <MenuItem value="all">Tất cả ({typeCount} nhóm)</MenuItem>
              {Object.entries(CAMERA_TYPE_MAP).map(([key, info]) => (
                <MenuItem key={key} value={key}>{info.icon} {info.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </GlassCard>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box sx={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={34} />
        </Box>
      ) : filteredCameras.length === 0 ? (
        <Alert severity="info">Không có camera phù hợp với bộ lọc hiện tại.</Alert>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          {filteredCameras.map((camera) => {
            const info = CAMERA_TYPE_MAP[camera.type] || CAMERA_TYPE_MAP.public;
            return (
              <GlassCard key={camera.id} sx={{ p: 0, overflow: 'hidden' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ height: '100%' }}>
                  <Box
                    component="img"
                    src={camera.thumbnailUrl}
                    alt={camera.name}
                    loading="lazy"
                    sx={{ width: { xs: '100%', sm: 180 }, height: { xs: 150, sm: 'auto' }, minHeight: 150, objectFit: 'cover', bgcolor: '#EAF2F4' }}
                  />
                  <Stack spacing={1.2} sx={{ p: 2, minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={750} lineHeight={1.35}>{camera.name}</Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={`${info.icon} ${info.label}`} sx={{ bgcolor: `${info.color}18`, color: info.color }} />
                      <Chip
                        size="small"
                        variant="outlined"
                        color={camera.coords ? 'success' : 'warning'}
                        label={camera.coords ? 'Đã định vị' : 'Thiếu tọa độ'}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {camera.coords
                        ? `${camera.coords.lat.toFixed(5)}, ${camera.coords.lng.toFixed(5)}`
                        : 'Camera chưa thể hiển thị trong tìm kiếm theo bán kính.'}
                    </Typography>
                    <Button
                      size="small"
                      href={camera.watchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      endIcon={<OpenInNew />}
                      sx={{ alignSelf: 'flex-start', px: 0 }}
                    >
                      Kiểm tra nguồn phát
                    </Button>
                  </Stack>
                </Stack>
              </GlassCard>
            );
          })}
        </Box>
      )}

      <Alert severity="info" variant="outlined">
        Danh mục camera hiện được cấu hình từ nguồn công khai trong backend. Tab này dùng để giám sát; khi cần thêm, sửa hoặc xóa camera nên chuyển danh mục sang MongoDB và bổ sung API quản trị.
      </Alert>
    </Stack>
  );
};

export default CameraManagement;
