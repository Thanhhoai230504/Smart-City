import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { placeApi } from '../../api/placeApi';
import {
  Box, Typography, Chip, Stack, Select, MenuItem, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Skeleton, SelectChangeEvent, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, FormControl, InputLabel, Snackbar, Alert,
  Paper, List, ListItemButton, ListItemText, InputAdornment, CircularProgress,
  Pagination,
} from '@mui/material';
import { Delete, Edit, Add, Close, LocationOn, Search, MyLocation } from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { DA_NANG_CENTER, DEFAULT_ZOOM } from '../../utils/constants';
import { GlassCard, PlaceItem, PLACE_TYPE_LABELS, PLACE_TYPES, cellSx, headCellSx } from './types';

// ── Goong API ──
const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY;

interface GoongPrediction {
  place_id: string;
  description: string;
  structured_formatting: { main_text: string; secondary_text: string };
}

const searchGoongAddress = async (input: string): Promise<GoongPrediction[]> => {
  const url = `https://rsapi.goong.io/Place/AutoComplete?api_key=${GOONG_API_KEY}&input=${encodeURIComponent(input)}&location=${DA_NANG_CENTER.lat},${DA_NANG_CENTER.lng}&radius=30&limit=5&more_compound=true`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.status === 'OK' ? data.predictions : [];
};

const getGoongPlaceDetail = async (placeId: string) => {
  const url = `https://rsapi.goong.io/Place/Detail?place_id=${encodeURIComponent(placeId)}&api_key=${GOONG_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Place detail failed');
  const data = await res.json();
  return { lat: data.result.geometry.location.lat, lng: data.result.geometry.location.lng, address: data.result.formatted_address || data.result.name };
};

// ── Map sub-components ──
const FlyToLocation: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  React.useEffect(() => { map.flyTo([lat, lng], 17, { duration: 1.2 }); }, [lat, lng, map]);
  return null;
};

const MapClickPicker: React.FC<{ onSelect: (lat: number, lng: number) => void }> = ({ onSelect }) => {
  useMapEvents({ click(e) { onSelect(e.latlng.lat, e.latlng.lng); } });
  return null;
};

const placeMarkerIcon = L.divIcon({
  html: '<div style="background:#EC4899;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 10px rgba(236,72,153,0.5)">📍</div>',
  className: '', iconSize: [32, 32], iconAnchor: [16, 32],
});

// ── Constants ──
const ITEMS_PER_PAGE = 8;

interface Props {
  onDataChange: () => void;
}

const PlaceManagement: React.FC<Props> = ({ onDataChange }) => {
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlaceItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'hospital', address: '', latitude: null as number | null, longitude: null as number | null, description: '', phone: '' });
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });

  // Filter & Pagination state
  const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Goong autocomplete state
  const [suggestions, setSuggestions] = useState<GoongPrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadPlaces = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await placeApi.getPlaces();
      setPlaces(data.data.places);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPlaces(); }, [loadPlaces]);

  // Filter + paginate places client-side
  const filteredPlaces = useMemo(() => {
    if (!typeFilter) return places;
    return places.filter(p => p.type === typeFilter);
  }, [places, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPlaces.length / ITEMS_PER_PAGE));
  const pagedPlaces = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPlaces.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPlaces, currentPage]);

  // Reset page when filter changes
  useEffect(() => { setCurrentPage(1); }, [typeFilter]);

  const resetForm = () => {
    setForm({ name: '', type: 'hospital', address: '', latitude: null, longitude: null, description: '', phone: '' });
    setSuggestions([]); setShowSuggestions(false); setFlyTarget(null);
  };

  const openForm = (place?: PlaceItem) => {
    if (place) {
      setEditing(place);
      setForm({
        name: place.name, type: place.type, address: place.address || '',
        latitude: place.latitude, longitude: place.longitude,
        description: place.description || '', phone: place.phone || '',
      });
      setFlyTarget({ lat: place.latitude, lng: place.longitude });
    } else {
      setEditing(null);
      resetForm();
    }
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); resetForm(); setEditing(null); };

  // ── Goong autocomplete ──
  const handleAddressChange = useCallback((value: string) => {
    setForm(f => ({ ...f, address: value }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchGoongAddress(value);
        setSuggestions(results); setShowSuggestions(results.length > 0);
      } catch { } finally { setSearching(false); }
    }, 400);
  }, []);

  const handleSearchClick = useCallback(async () => {
    if (!form.address.trim()) return;
    setSearching(true);
    try {
      const results = await searchGoongAddress(form.address);
      setSuggestions(results); setShowSuggestions(true);
    } catch { } finally { setSearching(false); }
  }, [form.address]);

  const handleSelectSuggestion = useCallback(async (pred: GoongPrediction) => {
    setShowSuggestions(false); setSuggestions([]); setSearching(true);
    try {
      const detail = await getGoongPlaceDetail(pred.place_id);
      setForm(f => ({ ...f, address: pred.description, latitude: detail.lat, longitude: detail.lng }));
      setFlyTarget({ lat: detail.lat, lng: detail.lng });
    } catch { } finally { setSearching(false); }
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setForm(f => ({ ...f, latitude: lat, longitude: lng }));
    setFlyTarget(null);
  }, []);

  // ── Save / Delete ──
  const handleSave = async () => {
    if (!form.latitude || !form.longitude) return;
    try {
      const payload = { ...form, latitude: form.latitude, longitude: form.longitude };
      if (editing) {
        await placeApi.updatePlace(editing._id, payload);
        setSnack({ open: true, msg: 'Đã cập nhật địa điểm', severity: 'success' });
      } else {
        await placeApi.createPlace(payload);
        setSnack({ open: true, msg: 'Đã thêm địa điểm mới', severity: 'success' });
      }
      closeDialog(); loadPlaces(); onDataChange();
    } catch { setSnack({ open: true, msg: 'Lưu thất bại', severity: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await placeApi.deletePlace(deleteId);
      setDeleteId(null);
      setSnack({ open: true, msg: 'Đã xoá địa điểm', severity: 'success' });
      loadPlaces(); onDataChange();
    } catch { setSnack({ open: true, msg: 'Xoá thất bại', severity: 'error' }); }
  };

  return (
    <GlassCard>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <Typography fontWeight={600} variant="h6">📍 Quản lý địa điểm</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Type Filter */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: 'text.secondary' }}>Loại</InputLabel>
            <Select value={typeFilter} label="Loại" onChange={(e: SelectChangeEvent) => setTypeFilter(e.target.value)}
              sx={{ borderRadius: '10px', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}>
              <MenuItem value="">Tất cả</MenuItem>
              {PLACE_TYPES.map(t => <MenuItem key={t} value={t}>{PLACE_TYPE_LABELS[t]}</MenuItem>)}
            </Select>
          </FormControl>
          <Chip label={`${filteredPlaces.length} địa điểm`} sx={{ bgcolor: 'rgba(236,72,153,0.15)', color: '#F9A8D4', fontWeight: 600 }} />
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => openForm()}
            sx={{ borderRadius: '10px', textTransform: 'none' }}>Thêm</Button>
        </Stack>
      </Stack>

      {/* ── Table ── */}
      <TableContainer>
        <Table size="small">
          <TableHead><TableRow>
            {['Tên', 'Loại', 'Địa chỉ', 'Toạ độ', 'SĐT', 'Thao tác'].map(h => (
              <TableCell key={h} sx={headCellSx}>{h}</TableCell>
            ))}
          </TableRow></TableHead>
          <TableBody>
            {loading ? [...Array(3)].map((_, i) => (
              <TableRow key={i}>{[...Array(6)].map((_, j) => <TableCell key={j} sx={cellSx}><Skeleton sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} /></TableCell>)}</TableRow>
            )) : pagedPlaces.length === 0 ? (
              <TableRow><TableCell colSpan={6} sx={{ ...cellSx, textAlign: 'center', py: 3 }}>
                <Typography color="text.secondary">Chưa có địa điểm</Typography>
              </TableCell></TableRow>
            ) : pagedPlaces.map(p => (
              <TableRow key={p._id} hover sx={{ '&:hover': { bgcolor: 'rgba(108,99,255,0.04)' } }}>
                <TableCell sx={{ ...cellSx, maxWidth: 180 }}><Typography variant="body2" fontWeight={500} noWrap>{p.name}</Typography></TableCell>
                <TableCell sx={cellSx}><Chip size="small" label={PLACE_TYPE_LABELS[p.type] || p.type} sx={{ height: 24, fontSize: '0.7rem', bgcolor: 'rgba(236,72,153,0.15)', color: '#F9A8D4' }} /></TableCell>
                <TableCell sx={{ ...cellSx, maxWidth: 180 }}><Typography variant="caption" noWrap>{p.address || '—'}</Typography></TableCell>
                <TableCell sx={cellSx}><Typography variant="caption" color="text.secondary">{p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}</Typography></TableCell>
                <TableCell sx={cellSx}><Typography variant="caption">{p.phone || '—'}</Typography></TableCell>
                <TableCell sx={cellSx}>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Sửa"><IconButton size="small" onClick={() => openForm(p)} sx={{ color: '#F59E0B' }}><Edit fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Xoá"><IconButton size="small" onClick={() => setDeleteId(p._id)} sx={{ color: '#EF4444' }}><Delete fontSize="small" /></IconButton></Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Stack alignItems="center" mt={2}>
          <Pagination count={totalPages} page={currentPage} onChange={(_, p) => setCurrentPage(p)}
            sx={{ '& .MuiPaginationItem-root': { color: 'text.secondary' } }} />
        </Stack>
      )}

      {/* ── Place Form Dialog with Goong + Map ── */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="md" fullWidth
        PaperProps={{ sx: { bgcolor: '#1F2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', maxHeight: '90vh' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {editing ? '✏️ Sửa địa điểm' : '➕ Thêm địa điểm mới'}
          <IconButton onClick={closeDialog} size="small"><Close /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2.5, flexDirection: { xs: 'column', md: 'row' }, mt: 1 }}>
            {/* Left: Form */}
            <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
              <TextField label="Tên địa điểm" size="small" fullWidth value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                placeholder="VD: Bệnh viện Đà Nẵng" />
              <FormControl size="small" fullWidth>
                <InputLabel>Loại</InputLabel>
                <Select value={form.type} label="Loại" onChange={(e: SelectChangeEvent) => setForm(f => ({ ...f, type: e.target.value }))}>
                  {PLACE_TYPES.map(t => <MenuItem key={t} value={t}>{PLACE_TYPE_LABELS[t]}</MenuItem>)}
                </Select>
              </FormControl>

              {/* Address with Goong Autocomplete */}
              <Box ref={searchBoxRef} sx={{ position: 'relative' }}>
                <TextField label="Địa chỉ" size="small" fullWidth required
                  value={form.address}
                  onChange={e => handleAddressChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearchClick(); } }}
                  placeholder="VD: 124 Hải Phòng, Hải Châu, Đà Nẵng"
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><LocationOn sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={handleSearchClick} disabled={searching || !form.address.trim()} size="small" color="primary">
                          {searching ? <CircularProgress size={18} /> : <Search />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  helperText="Nhập địa chỉ rồi chọn gợi ý, hoặc click trên bản đồ"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <Paper elevation={8} sx={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1300,
                    mt: 0.5, maxHeight: 250, overflow: 'auto', borderRadius: 2,
                    border: '1px solid', borderColor: 'divider', bgcolor: '#1F2937',
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, pt: 1 }}>
                      <Typography variant="caption" color="text.secondary">{suggestions.length} kết quả</Typography>
                      <IconButton size="small" onClick={() => setShowSuggestions(false)}><Close fontSize="small" /></IconButton>
                    </Box>
                    <List dense disablePadding>
                      {suggestions.map(s => (
                        <ListItemButton key={s.place_id} onClick={() => handleSelectSuggestion(s)} sx={{ py: 1, px: 2 }}>
                          <MyLocation sx={{ fontSize: 16, mr: 1.5, color: 'primary.main', flexShrink: 0 }} />
                          <ListItemText primary={s.structured_formatting.main_text} secondary={s.structured_formatting.secondary_text}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} secondaryTypographyProps={{ variant: 'caption' }} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Paper>
                )}
              </Box>

              <TextField label="Mô tả" size="small" fullWidth multiline rows={2} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả ngắn" />
              <TextField label="Số điện thoại" size="small" fullWidth value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="VD: 0236 3822 xxx" />

              {form.latitude && form.longitude && (
                <Alert severity="info" icon={<LocationOn />}>
                  <Typography variant="body2" fontWeight={600}>Vị trí đã chọn</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                  </Typography>
                </Alert>
              )}
            </Stack>

            {/* Right: Map */}
            <Box sx={{ flex: 1, minHeight: 350, borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.03)' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">📍 Click trên bản đồ để chọn vị trí</Typography>
                  {form.latitude && form.longitude && <Chip label="✓ Đã chọn" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
                </Stack>
              </Box>
              <MapContainer
                center={form.latitude && form.longitude ? [form.latitude, form.longitude] : [DA_NANG_CENTER.lat, DA_NANG_CENTER.lng]}
                zoom={form.latitude ? 15 : DEFAULT_ZOOM}
                style={{ height: 'calc(100% - 36px)', width: '100%' }}
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                <MapClickPicker onSelect={handleMapClick} />
                {flyTarget && <FlyToLocation lat={flyTarget.lat} lng={flyTarget.lng} />}
                {form.latitude && form.longitude && <Marker position={[form.latitude, form.longitude]} icon={placeMarkerIcon} />}
              </MapContainer>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} sx={{ color: 'text.secondary' }}>Huỷ</Button>
          <Button onClick={handleSave} variant="contained" disabled={!form.name || !form.latitude || !form.longitude}>
            {editing ? 'Cập nhật' : 'Thêm địa điểm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}
        PaperProps={{ sx: { bgcolor: '#1F2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' } }}>
        <DialogTitle>⚠️ Xác nhận xoá</DialogTitle>
        <DialogContent><Typography color="text.secondary">Bạn có chắc muốn xoá địa điểm này?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)} sx={{ color: 'text.secondary' }}>Huỷ</Button>
          <Button onClick={handleDelete} variant="contained" color="error">Xoá</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </GlassCard>
  );
};

export default PlaceManagement;
