import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { fetchPlaces } from '../../store/slices/placeSlice';
import { fetchEnvironment } from '../../store/slices/environmentSlice';
import { fetchIssues } from '../../store/slices/issueSlice';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import {
  Box, Paper, Typography, FormControlLabel, Switch, Stack,
  ToggleButton, ToggleButtonGroup, Fab, TextField, InputAdornment,
  Slider, Chip, Collapse,
} from '@mui/material';
import {
  Layers, MyLocation, Search, FilterAlt, ExpandMore, ExpandLess,
} from '@mui/icons-material';
import { DA_NANG_CENTER, DEFAULT_ZOOM, PLACE_TYPE_MAP, CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';
import { Place, Issue, EnvironmentData } from '../../types';

const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

const TRAFFIC_FLOW_TILES_URL =
  `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}&tileSize=256`;

const makeIcon = (emoji: string, color: string) =>
  L.divIcon({
    html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${emoji}</div>`,
    className: '', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32],
  });

const envIcon = L.divIcon({
  html: `<div style="background:#10B981;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🌡️</div>`,
  className: '', iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -28],
});

// Heatmap layer component
const HeatmapLayer: React.FC<{ points: [number, number, number][] }> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const heat = (L as any).heatLayer(points, {
      radius: 30,
      blur: 25,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.2: '#2563EB',
        0.4: '#10B981',
        0.6: '#F59E0B',
        0.8: '#F97316',
        1.0: '#EF4444',
      },
    }).addTo(map);
    return () => { map.removeLayer(heat); };
  }, [map, points]);

  return null;
};

const RecenterButton: React.FC = () => {
  const map = useMap();
  return (
    <Fab size="small" onClick={() => map.setView([DA_NANG_CENTER.lat, DA_NANG_CENTER.lng], DEFAULT_ZOOM)}
      sx={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000, bgcolor: 'background.paper', color: 'primary.main' }}>
      <MyLocation />
    </Fab>
  );
};

// Distance calculation (Haversine)
const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const MapPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { places } = useSelector((s: RootState) => s.places);
  const { issues } = useSelector((s: RootState) => s.issues);
  const { environmentData } = useSelector((s: RootState) => s.environment);

  const [showPlaces, setShowPlaces] = useState(true);
  const [showIssues, setShowIssues] = useState(true);
  const [showEnv, setShowEnv] = useState(true);
  const [showTraffic, setShowTraffic] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [placeFilter, setPlaceFilter] = useState<string[]>([]);

  // Search & filter states
  const [searchText, setSearchText] = useState('');
  const [radiusKm, setRadiusKm] = useState(0);
  const [issueTimeFilter, setIssueTimeFilter] = useState<string>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    dispatch(fetchPlaces());
    dispatch(fetchIssues({ limit: 200 }));
    dispatch(fetchEnvironment());
  }, [dispatch]);

  // Filtered places
  const filteredPlaces = useMemo(() => {
    let result = placeFilter.length > 0
      ? places.filter((p) => placeFilter.includes(p.type))
      : places;

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q)
      );
    }

    if (radiusKm > 0) {
      result = result.filter((p) =>
        getDistanceKm(DA_NANG_CENTER.lat, DA_NANG_CENTER.lng, p.latitude, p.longitude) <= radiusKm
      );
    }

    return result;
  }, [places, placeFilter, searchText, radiusKm]);

  // Filtered issues (exclude resolved)
  const filteredIssues = useMemo(() => {
    let result = issues.filter((i) => i.status !== 'resolved');

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((i) =>
        i.title.toLowerCase().includes(q) || i.location?.toLowerCase().includes(q)
      );
    }

    if (radiusKm > 0) {
      result = result.filter((i) =>
        getDistanceKm(DA_NANG_CENTER.lat, DA_NANG_CENTER.lng, i.latitude, i.longitude) <= radiusKm
      );
    }

    if (issueTimeFilter !== 'all') {
      const now = Date.now();
      const hours: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720 };
      const cutoff = now - (hours[issueTimeFilter] || 0) * 60 * 60 * 1000;
      result = result.filter((i) => new Date(i.createdAt).getTime() >= cutoff);
    }

    return result;
  }, [issues, searchText, radiusKm, issueTimeFilter]);

  // Heatmap points
  const heatmapPoints: [number, number, number][] = useMemo(
    () => filteredIssues.map((i) => [i.latitude, i.longitude, 0.8]),
    [filteredIssues]
  );

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', position: 'relative' }}>
      {/* Layer Control Panel */}
      <Paper sx={{
        position: 'absolute', top: 16, left: 16, zIndex: 1000, p: 2, width: 280,
        bgcolor: 'rgba(17,24,39,0.92)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px',
        maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
      }}>
        {/* Search bar */}
        <TextField
          fullWidth size="small" placeholder="Tìm kiếm địa điểm, sự cố..."
          value={searchText} onChange={(e) => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment>,
          }}
          sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '10px', fontSize: '0.85rem' } }}
        />

        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          <Layers sx={{ color: 'primary.main' }} />
          <Typography fontWeight={600}>Lớp bản đồ</Typography>
        </Stack>

        <FormControlLabel control={<Switch checked={showPlaces} onChange={(_, c) => setShowPlaces(c)} size="small" />}
          label={<Typography variant="body2">Địa điểm công cộng</Typography>} sx={{ mb: 0.5 }} />
        {showPlaces && (
          <Box sx={{ ml: 4, mb: 1.5 }}>
            <ToggleButtonGroup size="small" value={placeFilter} onChange={(_, v) => setPlaceFilter(v)} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {Object.entries(PLACE_TYPE_MAP).map(([key, val]) => (
                <ToggleButton key={key} value={key} sx={{ borderRadius: '8px !important', fontSize: '0.7rem', py: 0.3, px: 1, border: '1px solid rgba(255,255,255,0.1) !important' }}>
                  {val.icon} {val.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}

        <FormControlLabel control={<Switch checked={showIssues} onChange={(_, c) => setShowIssues(c)} size="small" />}
          label={<Typography variant="body2">📍 Sự cố đô thị</Typography>} sx={{ mb: 0.5 }} />

        <FormControlLabel control={<Switch checked={showHeatmap} onChange={(_, c) => setShowHeatmap(c)} size="small" />}
          label={<Typography variant="body2">🔥 Heatmap mật độ sự cố</Typography>} sx={{ mb: 0.5 }} />

        <FormControlLabel control={<Switch checked={showEnv} onChange={(_, c) => setShowEnv(c)} size="small" />}
          label={<Typography variant="body2">🌡️ Môi trường</Typography>} sx={{ mb: 0.5 }} />
        <FormControlLabel control={<Switch checked={showTraffic} onChange={(_, c) => setShowTraffic(c)} size="small" />}
          label={<Typography variant="body2">🚗 Giao thông</Typography>} />

        {/* Traffic legend */}
        {showTraffic && (
          <Box sx={{ mt: 1, ml: 4 }}>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ fontSize: '0.7rem' }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: '#22C55E' }} />
              <Typography variant="caption">Thông thoáng</Typography>
              <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: '#EAB308', ml: 0.5 }} />
              <Typography variant="caption">Chậm</Typography>
              <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: '#F97316', ml: 0.5 }} />
              <Typography variant="caption">Đông</Typography>
              <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: '#EF4444', ml: 0.5 }} />
              <Typography variant="caption">Kẹt</Typography>
            </Stack>
          </Box>
        )}

        {/* Advanced Filters */}
        <Box
          sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <FilterAlt sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="body2" fontWeight={600}>Bộ lọc nâng cao</Typography>
            </Stack>
            {showAdvanced ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
          </Stack>
        </Box>

        <Collapse in={showAdvanced}>
          <Box sx={{ mt: 1.5 }}>
            {/* Radius filter */}
            <Typography variant="caption" color="text.secondary" mb={0.5} display="block">
              Bán kính tìm kiếm: {radiusKm === 0 ? 'Tất cả' : `${radiusKm} km`}
            </Typography>
            <Slider
              value={radiusKm} onChange={(_, v) => setRadiusKm(v as number)}
              min={0} max={20} step={1} size="small"
              valueLabelDisplay="auto" valueLabelFormat={(v) => v === 0 ? 'Tất cả' : `${v}km`}
              sx={{ mb: 2, color: 'primary.main' }}
            />

            {/* Time filter for issues */}
            <Typography variant="caption" color="text.secondary" mb={0.5} display="block">
              Sự cố theo thời gian
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
              {[
                { value: 'all', label: 'Tất cả' },
                { value: '24h', label: '24 giờ' },
                { value: '7d', label: '7 ngày' },
                { value: '30d', label: '30 ngày' },
              ].map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  size="small"
                  onClick={() => setIssueTimeFilter(opt.value)}
                  sx={{
                    fontSize: '0.7rem',
                    bgcolor: issueTimeFilter === opt.value ? 'primary.main' : 'rgba(255,255,255,0.05)',
                    color: issueTimeFilter === opt.value ? '#fff' : 'text.secondary',
                    fontWeight: issueTimeFilter === opt.value ? 600 : 400,
                    '&:hover': { bgcolor: issueTimeFilter === opt.value ? 'primary.dark' : 'rgba(255,255,255,0.1)' },
                  }}
                />
              ))}
            </Stack>

            {/* Result count */}
            <Typography variant="caption" color="text.secondary" mt={1.5} display="block">
              📍 {filteredPlaces.length} địa điểm · {filteredIssues.length} sự cố
            </Typography>
          </Box>
        </Collapse>
      </Paper>

      {/* Map */}
      <MapContainer
        center={[DA_NANG_CENTER.lat, DA_NANG_CENTER.lng]}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* TomTom Traffic Flow Tiles overlay */}
        {showTraffic && TOMTOM_API_KEY && (
          <TileLayer
            url={TRAFFIC_FLOW_TILES_URL}
            opacity={0.7}
            zIndex={400}
          />
        )}

        {/* Heatmap layer */}
        {showHeatmap && <HeatmapLayer points={heatmapPoints} />}

        {/* Places markers */}
        {showPlaces && filteredPlaces.map((place: Place) => {
          const info = PLACE_TYPE_MAP[place.type] || PLACE_TYPE_MAP.hospital;
          return (
            <Marker key={place._id} position={[place.latitude, place.longitude]}
              icon={makeIcon(info.icon, info.color)}>
              <Popup>
                <div style={{ color: '#333', minWidth: 180 }}>
                  <strong>{info.icon} {place.name}</strong><br />
                  <span style={{ color: '#666', fontSize: 12 }}>{info.label}</span><br />
                  {place.address && <span style={{ fontSize: 12 }}>📍 {place.address}</span>}
                  {place.phone && <><br /><span style={{ fontSize: 12 }}>📞 {place.phone}</span></>}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Issue markers */}
        {showIssues && filteredIssues.map((issue: Issue) => {
          const cat = CATEGORY_MAP[issue.category] || CATEGORY_MAP.other;
          const st = STATUS_MAP[issue.status] || STATUS_MAP.reported;
          return (
            <Marker key={issue._id} position={[issue.latitude, issue.longitude]}
              icon={makeIcon(cat.icon, '#EF4444')}>
              <Popup>
                <div style={{ color: '#333', minWidth: 200 }}>
                  <strong>{cat.icon} {issue.title}</strong><br />
                  <span style={{ background: st.color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{st.label}</span>
                  <span style={{ background: cat.color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, marginLeft: 4 }}>{cat.label}</span>
                  <br /><span style={{ fontSize: 12, color: '#666' }}>📍 {issue.location}</span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Environment markers */}
        {showEnv && environmentData.map((env: EnvironmentData, i: number) => (
          <Marker key={`env-${i}`} position={[env.latitude, env.longitude]} icon={envIcon}>
            <Popup>
              <div style={{ color: '#333', minWidth: 160 }}>
                <strong>🌡️ {env.location}</strong><br />
                <span style={{ fontSize: 13 }}>Nhiệt độ: <b>{env.temperature}°C</b></span><br />
                <span style={{ fontSize: 13 }}>Độ ẩm: <b>{env.humidity}%</b></span><br />
                <span style={{ fontSize: 12, color: '#666' }}>{env.weatherCondition} {env.weatherDescription ? `- ${env.weatherDescription}` : ''}</span>
              </div>
            </Popup>
          </Marker>
        ))}

        <RecenterButton />
      </MapContainer>
    </Box>
  );
};

export default MapPage;
