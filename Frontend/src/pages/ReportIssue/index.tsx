import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { createIssue } from '../../store/slices/issueSlice';
import {
  Box, Container, Typography, TextField, Button, MenuItem, Card,
  CardContent, Grid, Alert, CircularProgress, Stack, Paper, List,
  ListItemButton, ListItemText, InputAdornment, IconButton, Chip,
} from '@mui/material';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Send, CloudUpload, LocationOn, Search, MyLocation, Close, SmartToy, Phone, ThumbUp } from '@mui/icons-material';
import { CATEGORY_MAP, DA_NANG_CENTER, DEFAULT_ZOOM } from '../../utils/constants';
import { issueApi } from '../../api/issueApi';
import { DuplicateCandidate, DuplicateCandidateMeta } from '../../types';

// ── Goong API helpers ──
const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY;

interface GoongPrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface GoongAutoCompleteResponse {
  predictions: GoongPrediction[];
  status: string;
}

interface GoongPlaceDetailResponse {
  result: {
    geometry: {
      location: { lat: number; lng: number };
    };
    formatted_address: string;
    name: string;
  };
  status: string;
}

interface SelectedIssueImage {
  id: string;
  file: File;
  previewUrl: string;
}

const MAX_ISSUE_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Autocomplete: search for address suggestions near Da Nang
const searchAddress = async (input: string): Promise<GoongPrediction[]> => {
  const url = `https://rsapi.goong.io/Place/AutoComplete?` +
    `api_key=${GOONG_API_KEY}&input=${encodeURIComponent(input)}` +
    `&location=${DA_NANG_CENTER.lat},${DA_NANG_CENTER.lng}&radius=30&limit=5&more_compound=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Autocomplete failed');
  const data: GoongAutoCompleteResponse = await res.json();
  if (data.status !== 'OK') return [];
  return data.predictions;
};

// Place Detail: get coordinates from place_id
const getPlaceDetail = async (placeId: string): Promise<{ lat: number; lng: number; address: string }> => {
  const url = `https://rsapi.goong.io/Place/Detail?` +
    `place_id=${encodeURIComponent(placeId)}&api_key=${GOONG_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Place detail failed');
  const data: GoongPlaceDetailResponse = await res.json();
  return {
    lat: data.result.geometry.location.lat,
    lng: data.result.geometry.location.lng,
    address: data.result.formatted_address || data.result.name,
  };
};

// Reverse Geocode: get address from lat/lng
const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  const url = `https://rsapi.goong.io/Geocode?latlng=${lat},${lng}&api_key=${GOONG_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Reverse geocode failed');
  const data = await res.json();
  if (data.status === 'OK' && data.results?.length > 0) {
    return data.results[0].formatted_address;
  }
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};

// ── Map sub-components ──

// Fly to a position when it changes
const FlyToLocation: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo([lat, lng], 17, { duration: 1.5 });
  }, [lat, lng, map]);
  return null;
};

// Click-to-select / adjust location
const LocationPicker: React.FC<{ onSelect: (lat: number, lng: number) => void }> = ({ onSelect }) => {
  useMapEvents({
    click(e) { onSelect(e.latlng.lat, e.latlng.lng); },
  });
  return null;
};

const ReportIssuePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading } = useSelector((s: RootState) => s.issues);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [images, setImages] = useState<SelectedIssueImage[]>([]);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // AI classify
  const [aiClassifying, setAiClassifying] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ category: string; confidence: number; description: string } | null>(null);

  // Goong autocomplete state
  const [suggestions, setSuggestions] = useState<GoongPrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Two-stage duplicate detection: geo prefilter + embedding/lexical scoring.
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [duplicateMeta, setDuplicateMeta] = useState<DuplicateCandidateMeta | null>(null);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  const [confirmingDuplicateId, setConfirmingDuplicateId] = useState('');
  const [confirmedDuplicateId, setConfirmedDuplicateId] = useState('');

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, []);

  useEffect(() => {
    if (!lat || !lng || title.trim().length < 3 || description.trim().length < 10 || !category) {
      setDuplicateCandidates([]);
      setDuplicateMeta(null);
      setDuplicateError('');
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setDuplicateLoading(true);
      setDuplicateError('');
      try {
        const { data } = await issueApi.findDuplicateCandidates({
          title: title.trim(),
          description: description.trim(),
          category,
          latitude: lat,
          longitude: lng,
        }, controller.signal);
        setDuplicateCandidates(data.data.candidates);
        setDuplicateMeta(data.data.meta);
      } catch {
        if (!controller.signal.aborted) {
          setDuplicateError('Không thể kiểm tra đề xuất trùng lúc này. Bạn vẫn có thể gửi báo cáo mới.');
          setDuplicateCandidates([]);
          setDuplicateMeta(null);
        }
      } finally {
        if (!controller.signal.aborted) setDuplicateLoading(false);
      }
    }, 650);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [category, description, lat, lng, title]);

  // ── Close dropdown when clicking outside ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Debounced autocomplete on input change ──
  const handleLocationChange = useCallback((value: string) => {
    setLocation(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchAddress(value);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        // Silently fail autocomplete
      } finally {
        setSearching(false);
      }
    }, 400); // 400ms debounce
  }, []);

  // ── Manual search button ──
  const handleSearch = useCallback(async () => {
    if (!location.trim()) return;
    setSearching(true);
    setError('');
    try {
      const results = await searchAddress(location);
      setSuggestions(results);
      setShowSuggestions(true);
      if (results.length === 0) {
        setError('Không tìm thấy địa chỉ. Hãy thử nhập cụ thể hơn hoặc click trực tiếp trên bản đồ.');
      }
    } catch {
      setError('Lỗi khi tìm kiếm địa chỉ. Vui lòng thử lại.');
    } finally {
      setSearching(false);
    }
  }, [location]);

  // ── Select a suggestion → get lat/lng via Place Detail ──
  const handleSelectSuggestion = useCallback(async (prediction: GoongPrediction) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setSearching(true);
    try {
      const detail = await getPlaceDetail(prediction.place_id);
      setLat(detail.lat);
      setLng(detail.lng);
      setLocation(prediction.description);
      setFlyTarget({ lat: detail.lat, lng: detail.lng });
    } catch {
      setError('Không lấy được toạ độ. Vui lòng thử lại hoặc click trên bản đồ.');
    } finally {
      setSearching(false);
    }
  }, []);

  // ── Click on map to adjust ──
  const handleLocationSelect = useCallback(async (latitude: number, longitude: number) => {
    setLat(latitude);
    setLng(longitude);
    setFlyTarget(null);
    // Reverse geocode khi click trên bản đồ
    try {
      const address = await reverseGeocode(latitude, longitude);
      setLocation(address);
    } catch { /* keep current location text */ }
  }, []);

  // ── Lấy vị trí hiện tại bằng GPS ──
  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ định vị GPS');
      return;
    }
    setGettingLocation(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLat(latitude);
        setLng(longitude);
        setFlyTarget({ lat: latitude, lng: longitude });
        try {
          const address = await reverseGeocode(latitude, longitude);
          setLocation(address);
        } catch {
          setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
        setGettingLocation(false);
      },
      (err) => {
        setGettingLocation(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError('Bạn đã từ chối quyền truy cập vị trí. Hãy cho phép trong cài đặt trình duyệt.');
        } else {
          setError('Không thể lấy vị trí. Vui lòng thử lại hoặc nhập địa chỉ thủ công.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    e.target.value = '';
    if (!selectedFiles.length) return;

    if (selectedFiles.some((file) => !file.type.startsWith('image/'))) {
      setError('Chỉ chấp nhận tệp hình ảnh.');
      return;
    }
    if (selectedFiles.some((file) => file.size > MAX_IMAGE_SIZE)) {
      setError('Mỗi ảnh có dung lượng tối đa 5MB.');
      return;
    }

    const existingSignatures = new Set(
      images.map(({ file }) => `${file.name}:${file.size}:${file.lastModified}`)
    );
    const uniqueFiles = selectedFiles.filter((file) => {
      const signature = `${file.name}:${file.size}:${file.lastModified}`;
      if (existingSignatures.has(signature)) return false;
      existingSignatures.add(signature);
      return true;
    });
    if (!uniqueFiles.length) return;
    if (images.length + uniqueFiles.length > MAX_ISSUE_IMAGES) {
      setError(`Mỗi báo cáo chỉ được chọn tối đa ${MAX_ISSUE_IMAGES} ảnh.`);
      return;
    }

    const additions = uniqueFiles.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      objectUrlsRef.current.add(previewUrl);
      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl,
      };
    });
    setImages((current) => [...current, ...additions]);
    setError('');

    // Ảnh đầu tiên đại diện cho báo cáo và được dùng để AI gợi ý phân loại.
    if (images.length === 0) {
      setAiClassifying(true);
      setAiSuggestion(null);
      try {
        const { aiApi } = await import('../../api/aiApi');
        const { data } = await aiApi.classifyImage(additions[0].file);
        const result = data.data;
        setAiSuggestion(result);
        if (result.confidence >= 0.5 && !category) {
          setCategory(result.category);
        }
      } catch { /* AI chỉ là gợi ý, không chặn người dùng báo cáo */ }
      setAiClassifying(false);
    }
  };

  const handleRemoveImage = (imageId: string) => {
    setImages((current) => {
      const removed = current.find((image) => image.id === imageId);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        objectUrlsRef.current.delete(removed.previewUrl);
      }
      return current.filter((image) => image.id !== imageId);
    });
    setAiSuggestion(null);
  };

  const handleConfirmDuplicate = async (candidate: DuplicateCandidate) => {
    const duplicateIssue = candidate.issue;
    setConfirmingDuplicateId(duplicateIssue._id);
    setError('');
    try {
      const { data } = await issueApi.confirmDuplicate(duplicateIssue._id);
      setConfirmedDuplicateId(duplicateIssue._id);
      setDuplicateCandidates((current) => current.map((item) => (
        item.issue._id === duplicateIssue._id
          ? { ...item, issue: { ...item.issue, voteCount: data.data.voteCount } }
          : item
      )));
    } catch {
      setError('Không thể xác nhận sự cố trùng. Vui lòng thử lại.');
    } finally {
      setConfirmingDuplicateId('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!lat || !lng) { setError('Vui lòng tìm kiếm địa chỉ hoặc chọn vị trí trên bản đồ'); return; }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category);
    formData.append('location', location);
    formData.append('latitude', String(lat));
    formData.append('longitude', String(lng));
    if (phone.trim()) formData.append('phone', phone.trim());
    images.forEach(({ file }) => formData.append('images', file));

    const result = await dispatch(createIssue(formData));
    if (createIssue.fulfilled.match(result)) {
      setSuccess(true);
      setTimeout(() => navigate('/my-issues'), 1500);
    } else {
      setError(result.payload as string || 'Có lỗi xảy ra');
    }
  };

  const markerIcon = L.divIcon({
    html: '<div style="background:#EF4444;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid white;box-shadow:0 2px 12px rgba(239,68,68,0.5)">📍</div>',
    className: '', iconSize: [36, 36], iconAnchor: [18, 36],
  });

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} mb={1}>📝 Báo cáo sự cố</Typography>
      <Typography color="text.secondary" mb={4}>Giúp thành phố tốt đẹp hơn bằng cách báo cáo các vấn đề bạn gặp</Typography>

      {success && <Alert severity="success" sx={{ mb: 3 }}>🎉 Báo cáo thành công! Đang chuyển hướng...</Alert>}
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit}>
        <Grid container spacing={4}>
          {/* Form */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2.5}>
              <TextField label="Tiêu đề sự cố" value={title} onChange={(e) => setTitle(e.target.value)}
                required placeholder="VD: Ổ gà lớn trên đường Nguyễn Văn Linh" />
              <TextField select label="Phân loại" value={category} onChange={(e) => setCategory(e.target.value)} required>
                {Object.entries(CATEGORY_MAP).map(([k, v]) => <MenuItem key={k} value={k}>{v.icon} {v.label}</MenuItem>)}
              </TextField>

              {/* ── Address with Goong Autocomplete ── */}
              <Box ref={searchBoxRef} sx={{ position: 'relative' }}>
                <TextField
                  label="Địa chỉ"
                  value={location}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
                  required
                  fullWidth
                  placeholder="VD: 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LocationOn sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleSearch}
                          disabled={searching || !location.trim()}
                          color="primary"
                          size="small"
                          title="Tìm trên bản đồ"
                        >
                          {searching ? <CircularProgress size={20} /> : <Search />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  helperText="Nhập địa chỉ hoặc nhấn nút GPS để lấy vị trí hiện tại"
                />

                {/* ── Nút lấy vị trí hiện tại ── */}
                <Button
                  variant="outlined" size="small"
                  startIcon={gettingLocation ? <CircularProgress size={16} /> : <MyLocation />}
                  onClick={handleGetCurrentLocation}
                  disabled={gettingLocation}
                  sx={{
                    mt: 1, textTransform: 'none', fontSize: '0.8rem',
                    borderColor: 'rgba(59,130,246,0.3)', color: '#3B82F6',
                    borderRadius: '8px',
                    '&:hover': { borderColor: '#3B82F6', bgcolor: 'rgba(59,130,246,0.06)' },
                  }}
                >
                  {gettingLocation ? 'Đang lấy vị trí...' : '📍 Lấy vị trí hiện tại của tôi'}
                </Button>

                {/* ── Suggestions Dropdown ── */}
                {showSuggestions && suggestions.length > 0 && (
                  <Paper
                    elevation={8}
                    sx={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                      mt: 0.5, maxHeight: 300, overflow: 'auto', borderRadius: 2,
                      border: '1px solid', borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, pt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {suggestions.length} kết quả từ Goong Maps
                      </Typography>
                      <IconButton size="small" onClick={() => setShowSuggestions(false)}><Close fontSize="small" /></IconButton>
                    </Box>
                    <List dense disablePadding>
                      {suggestions.map((s) => (
                        <ListItemButton
                          key={s.place_id}
                          onClick={() => handleSelectSuggestion(s)}
                          sx={{
                            py: 1.5, px: 2,
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          <MyLocation sx={{ fontSize: 18, mr: 1.5, color: 'primary.main', flexShrink: 0, mt: 0.3 }} />
                          <ListItemText
                            primary={s.structured_formatting.main_text}
                            secondary={s.structured_formatting.secondary_text}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </Paper>
                )}
              </Box>

              <TextField
                label="Số điện thoại liên hệ"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0901234567"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Phone sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                helperText="Không bắt buộc — giúp cơ quan chức năng liên hệ nhanh hơn"
              />

              <TextField label="Mô tả chi tiết" value={description} onChange={(e) => setDescription(e.target.value)}
                required multiline rows={4} placeholder="Mô tả tình trạng sự cố..." />

              {/* Image Upload */}
              <Box>
                <Button component="label" variant="outlined" startIcon={<CloudUpload />} fullWidth
                  disabled={images.length >= MAX_ISSUE_IMAGES}
                  sx={{ py: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.15)' }}>
                  {images.length
                    ? `Thêm ảnh (${images.length}/${MAX_ISSUE_IMAGES})`
                    : `Chọn tối đa ${MAX_ISSUE_IMAGES} ảnh (mỗi ảnh tối đa 5MB)`}
                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                </Button>
                {images.length > 0 && (
                  <Box
                    sx={{
                      mt: 2,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))',
                      gap: 1,
                    }}
                  >
                    {images.map((image, index) => (
                      <Box
                        key={image.id}
                        sx={{
                          position: 'relative',
                          aspectRatio: '1 / 1',
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: '1px solid',
                          borderColor: index === 0 ? 'primary.main' : 'divider',
                        }}
                      >
                        <Box
                          component="img"
                          src={image.previewUrl}
                          alt={`Ảnh báo cáo ${index + 1}`}
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {index === 0 && (
                          <Chip
                            label="Ảnh chính"
                            size="small"
                            color="primary"
                            sx={{ position: 'absolute', left: 5, bottom: 5, height: 20, fontSize: '0.65rem' }}
                          />
                        )}
                        <IconButton
                          size="small"
                          aria-label={`Xóa ảnh ${index + 1}`}
                          onClick={() => handleRemoveImage(image.id)}
                          sx={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            bgcolor: 'rgba(0,0,0,0.7)',
                            color: 'white',
                            '&:hover': { bgcolor: 'rgba(239,68,68,0.9)' },
                          }}
                        >
                          <Close fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}
                {aiClassifying && (
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="caption" color="text.secondary">🧠 AI đang phân tích ảnh...</Typography>
                  </Stack>
                )}
                {aiSuggestion && !aiClassifying && (
                  <Chip
                    icon={<SmartToy sx={{ fontSize: 16 }} />}
                    label={`AI gợi ý: ${CATEGORY_MAP[aiSuggestion.category]?.label || aiSuggestion.category} (${Math.round(aiSuggestion.confidence * 100)}%) — ${aiSuggestion.description}`}
                    size="small"
                    onDelete={() => setAiSuggestion(null)}
                    sx={{ mt: 1, bgcolor: 'rgba(14,165,233,0.15)', color: '#A5B4FC', border: '1px solid rgba(14,165,233,0.3)', maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }}
                  />
                )}
              </Box>

              {lat && lng && (
                <Alert severity="info" icon={<LocationOn />}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Vị trí đã chọn</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {lat.toFixed(5)}, {lng.toFixed(5)}
                    </Typography>
                  </Box>
                </Alert>
              )}

              {/* Embedding duplicate candidates */}
              {duplicateLoading && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">Đang so khớp nội dung và vị trí...</Typography>
                </Stack>
              )}
              {duplicateError && <Alert severity="info">{duplicateError}</Alert>}
              {!duplicateLoading && duplicateCandidates.length > 0 && (
                <Alert severity="warning" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                  <Typography variant="body2" fontWeight={600} mb={1}>
                    ⚠️ Có {duplicateCandidates.length} báo cáo có khả năng trùng
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                    Hệ thống so khớp nội dung, khoảng cách, loại và thời gian. Đây chỉ là đề xuất;
                    bạn vẫn quyết định xác nhận hoặc tạo báo cáo riêng.
                  </Typography>
                  {duplicateMeta?.mode !== 'embedding' && (
                    <Alert severity="info" sx={{ mb: 1.5, py: 0.25 }}>
                      Embedding chưa sẵn sàng; kết quả đang dùng từ khóa + vị trí dự phòng.
                    </Alert>
                  )}
                  {confirmedDuplicateId && (
                    <Alert
                      severity="success"
                      sx={{ mb: 1.5 }}
                      action={(
                        <Button
                          component={Link}
                          to={`/issues/${confirmedDuplicateId}`}
                          color="inherit"
                          size="small"
                        >
                          Theo dõi
                        </Button>
                      )}
                    >
                      Đã xác nhận cùng một sự cố. Bạn không cần gửi báo cáo mới.
                    </Alert>
                  )}
                  <Stack spacing={1}>
                    {duplicateCandidates.map((candidate) => {
                      const candidateIssue = candidate.issue;
                      return (
                      <Paper key={candidateIssue._id} sx={{
                        p: 1.5, bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
                      }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {CATEGORY_MAP[candidateIssue.category]?.icon} {candidateIssue.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap display="block">
                              📍 {candidateIssue.location} · ~{candidate.distanceMeters}m
                            </Typography>
                            <Stack direction="row" spacing={0.5} mt={0.5} flexWrap="wrap" useFlexGap>
                              <Chip label={`Giống ${Math.round(candidate.duplicateScore * 100)}%`}
                                color={candidate.confidence === 'high' ? 'error' : 'warning'}
                                size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
                              <Chip label={CATEGORY_MAP[candidateIssue.category]?.label || candidateIssue.category}
                                size="small" sx={{ fontSize: '0.65rem', height: 20, bgcolor: 'rgba(14,165,233,0.15)' }} />
                              <Chip label={`👍 ${candidateIssue.voteCount || 0}`}
                                size="small" sx={{ fontSize: '0.65rem', height: 20, bgcolor: 'rgba(59,130,246,0.15)' }} />
                            </Stack>
                            <Typography variant="caption" color="text.secondary" display="block" mt={0.65}>
                              {candidate.reasons.join(' · ')}
                            </Typography>
                          </Box>
                          <Stack spacing={0.75} alignItems="flex-end">
                            <Button
                              type="button"
                              variant={confirmedDuplicateId === candidateIssue._id ? 'contained' : 'outlined'}
                              color="success"
                              size="small"
                              startIcon={confirmingDuplicateId === candidateIssue._id
                                ? <CircularProgress size={14} color="inherit" />
                                : <ThumbUp sx={{ fontSize: 14 }} />}
                              disabled={Boolean(confirmingDuplicateId || confirmedDuplicateId)}
                              onClick={() => handleConfirmDuplicate(candidate)}
                              sx={{
                                textTransform: 'none',
                                fontSize: '0.7rem',
                                borderRadius: '8px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {confirmedDuplicateId === candidateIssue._id
                                ? 'Đã xác nhận'
                                : 'Đây là cùng một sự cố'}
                            </Button>
                            <Button
                              component={Link}
                              to={`/issues/${candidateIssue._id}`}
                              target="_blank"
                              size="small"
                              sx={{ fontSize: '0.68rem', minWidth: 'auto' }}
                            >
                              Xem chi tiết
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                    );})}
                  </Stack>
                  {confirmedDuplicateId && (
                    <Button
                      type="button"
                      color="inherit"
                      size="small"
                      onClick={() => setConfirmedDuplicateId('')}
                      sx={{ mt: 1 }}
                    >
                      Tôi vẫn muốn tạo báo cáo riêng
                    </Button>
                  )}
                </Alert>
              )}

              <Button type="submit" variant="contained" size="large" startIcon={loading ? <CircularProgress size={20} /> : <Send />}
                disabled={loading || Boolean(confirmedDuplicateId)} sx={{ py: 1.5 }}>
                {loading
                  ? 'Đang gửi...'
                  : confirmedDuplicateId
                    ? 'Đã xác nhận báo cáo trùng'
                    : 'Gửi báo cáo'}
              </Button>
            </Stack>
          </Grid>

          {/* Map Picker */}
          <Grid item xs={12} md={6}>
            <Card sx={{ overflow: 'hidden', height: '100%', minHeight: 450 }}>
              <CardContent sx={{ p: '12px !important', pb: '0 !important', height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    📍 Xác nhận vị trí trên bản đồ
                  </Typography>
                  {lat && lng && (
                    <Chip label="✓ Đã chọn vị trí" size="small" color="success" variant="outlined" />
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Nhập địa chỉ để tìm, hoặc click trực tiếp trên bản đồ để chọn/tinh chỉnh
                </Typography>
                <Box sx={{ height: 'calc(100% - 55px)', borderRadius: 2, overflow: 'hidden' }}>
                  <MapContainer center={[DA_NANG_CENTER.lat, DA_NANG_CENTER.lng]} zoom={DEFAULT_ZOOM}
                    style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; Google Maps'
                      url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=vi"
                    />
                    <LocationPicker onSelect={handleLocationSelect} />
                    {flyTarget && <FlyToLocation lat={flyTarget.lat} lng={flyTarget.lng} />}
                    {lat && lng && <Marker position={[lat, lng]} icon={markerIcon} />}
                  </MapContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default ReportIssuePage;
