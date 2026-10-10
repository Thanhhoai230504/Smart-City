import React, { useState } from 'react';
import {
  Box, ButtonBase, Chip, CircularProgress, Collapse, FormControlLabel, InputAdornment, Paper, Slider, Stack, Switch,
  TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { ExpandLess, ExpandMore, FilterAlt, Layers, Search } from '@mui/icons-material';
import { IssueStatus } from '../../types';
import { PLACE_TYPE_MAP, STATUS_MAP } from '../../utils/constants';
import { MAP_TIME_FILTERS, MapFilter } from '../../utils/mapFilters';
import { MapLayerState, TRAFFIC_LEVELS } from './mapLayers';

interface LayerPanelProps {
  open: boolean;
  onToggle: () => void;
  layers: MapLayerState;
  onLayersChange: React.Dispatch<React.SetStateAction<MapLayerState>>;
  filter: MapFilter;
  onFilterChange: React.Dispatch<React.SetStateAction<MapFilter>>;
  /** Số sự cố, địa điểm đang vẽ sau khi lọc. */
  issueCount: number;
  placeCount: number;
  /** Trạng thái có mặt trong các sự cố đang vẽ — chỉ những trạng thái này hiện ở chú giải. */
  issueStatuses: IssueStatus[];
  issuesLoading: boolean;
}

/**
 * Bảng "Lớp bản đồ" — giữ giao diện danh sách gọn như trước (công tắc + nhãn emoji, nút chọn loại
 * địa điểm, "Bộ lọc nâng cao"). Ngày 09/10/2026 bảng từng được làm lại thành các thẻ có ô icon và
 * mô tả, nhưng người dùng thấy khó nhìn hơn nên trả về kiểu này. Khác bản cũ: đầu bảng và nút "Bộ
 * lọc nâng cao" là nút thật (dùng được bằng bàn phím), thu gọn thì chỉ rộng vừa chữ để không đè
 * nút "Chỉ đường" trên màn hẹp.
 */
const LayerPanel = React.forwardRef<HTMLDivElement, LayerPanelProps>(({
  open, onToggle, layers, onLayersChange, filter, onFilterChange, issueCount, placeCount, issueStatuses, issuesLoading,
}, ref) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Giữ bề rộng đầy đủ tới khi thân bảng thu xong, để nội dung không bị bóp lại giữa lúc đóng.
  const [wide, setWide] = useState(open);
  if (open && !wide) setWide(true);

  // Cập nhật theo giá trị mới nhất, để hai thao tác liền nhau không ghi đè nhau.
  const set = (next: Partial<MapLayerState>) => onLayersChange((current) => ({ ...current, ...next }));
  const patchFilter = (next: Partial<MapFilter>) => onFilterChange((current) => ({ ...current, ...next }));

  return (
    <Paper ref={ref} sx={{
      position: 'absolute', top: 16, left: 16, zIndex: 1000,
      bgcolor: 'rgba(255,255,255,.96)', backdropFilter: 'blur(12px)',
      border: '1px solid #DCE7EB', borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(32,71,83,.12)',
      width: wide ? { xs: 220, sm: 250, md: 280 } : 'auto',
      maxHeight: open ? { xs: 'calc(100vh - 200px)', md: 'calc(100vh - 120px)' } : 'auto',
      overflowY: open ? 'auto' : 'hidden',
      '&::-webkit-scrollbar': { width: 4 },
      '&::-webkit-scrollbar-thumb': { bgcolor: '#AFC5CC', borderRadius: 2 },
    }}>
      <ButtonBase
        onClick={onToggle}
        aria-expanded={open}
        sx={{
          width: '100%', justifyContent: 'flex-start', p: 1.5, borderRadius: '12px', textAlign: 'left',
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
          <Layers sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography fontWeight={600} fontSize={14} sx={{ flex: 1, whiteSpace: 'nowrap' }}>Lớp bản đồ</Typography>
          {open ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
        </Stack>
      </ButtonBase>

      {/* Thu gọn xong thì bỏ thân bảng khỏi bố cục, để bề rộng chỉ tính theo đầu bảng */}
      <Collapse in={open} onExited={() => setWide(false)} sx={{ display: wide ? undefined : 'none' }}>
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <TextField
            fullWidth size="small" placeholder="Tìm kiếm địa điểm, sự cố..."
            value={filter.search} onChange={(e) => patchFilter({ search: e.target.value })}
            inputProps={{ 'aria-label': 'Tìm trên bản đồ' }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment>,
            }}
            sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { bgcolor: '#FFFFFF', borderRadius: '9px', fontSize: '0.85rem' } }}
          />

          <FormControlLabel control={<Switch checked={layers.places} onChange={(_, c) => set({ places: c })} size="small" />}
            label={<Typography variant="body2">Địa điểm công cộng</Typography>} sx={{ mb: 0.5 }} />
          {layers.places && (
            <Box sx={{ ml: 4, mb: 1.5 }}>
              <ToggleButtonGroup size="small" value={layers.placeTypes} onChange={(_, v: string[]) => set({ placeTypes: v })} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {Object.entries(PLACE_TYPE_MAP).map(([key, val]) => (
                  <ToggleButton key={key} value={key} sx={{ borderRadius: '8px !important', fontSize: '0.7rem', py: 0.3, px: 1, border: '1px solid #D6E5E9 !important' }}>
                    {val.icon} {val.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}

          <FormControlLabel control={<Switch checked={layers.issues} onChange={(_, c) => set({ issues: c })} size="small" />}
            label={<Typography variant="body2">📍 Sự cố đô thị</Typography>} sx={{ mb: 0.5 }} />
          {layers.issues && issueCount > 0 && (
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} alignItems="center" sx={{ mt: -0.5, mb: 1, ml: 4 }}>
              {issueStatuses.map((s) => (
                <Stack key={s} direction="row" spacing={0.5} alignItems="center">
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: STATUS_MAP[s].color, boxShadow: '0 0 0 1px rgba(0,0,0,0.15)' }} />
                  <Typography variant="caption">{STATUS_MAP[s].label}</Typography>
                </Stack>
              ))}
            </Stack>
          )}

          <FormControlLabel control={<Switch checked={layers.density} onChange={(_, c) => set({ density: c })} size="small" />}
            label={<Typography variant="body2">🔥 Heatmap mật độ sự cố</Typography>} sx={{ mb: 0.5 }} />

          <FormControlLabel control={<Switch checked={layers.weather} onChange={(_, c) => set({ weather: c })} size="small" />}
            label={<Typography variant="body2">🌡️ Môi trường</Typography>} sx={{ mb: 0.5 }} />
          <FormControlLabel control={<Switch checked={layers.traffic} onChange={(_, c) => set({ traffic: c })} size="small" />}
            label={<Typography variant="body2">🚗 Giao thông</Typography>} />

          {layers.traffic && (
            <Box sx={{ mt: 1, ml: 4 }}>
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ fontSize: '0.7rem' }}>
                {TRAFFIC_LEVELS.map((level, i) => (
                  <React.Fragment key={level.label}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: level.color, ml: i ? 0.5 : 0 }} />
                    <Typography variant="caption">{level.label}</Typography>
                  </React.Fragment>
                ))}
              </Stack>
            </Box>
          )}

          <ButtonBase
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-expanded={showAdvanced}
            sx={{
              width: '100%', justifyContent: 'space-between', mt: 1.5, pt: 1.5, borderTop: '1px solid #DCE7EB', textAlign: 'left',
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
            }}
          >
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <FilterAlt sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="body2" fontWeight={600}>Bộ lọc nâng cao</Typography>
            </Stack>
            {showAdvanced ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
          </ButtonBase>

          <Collapse in={showAdvanced}>
            <Box sx={{ mt: 1.5 }}>
              <Typography id="map-radius-label" variant="caption" color="text.secondary" mb={0.5} display="block">
                Bán kính tìm kiếm: {filter.radiusKm === 0 ? 'Tất cả' : `${filter.radiusKm} km`}
              </Typography>
              <Slider
                value={filter.radiusKm} onChange={(_, v) => patchFilter({ radiusKm: v as number })}
                min={0} max={20} step={1} size="small"
                aria-labelledby="map-radius-label"
                valueLabelDisplay="auto" valueLabelFormat={(v) => v === 0 ? 'Tất cả' : `${v}km`}
                sx={{ mb: 2, color: 'primary.main' }}
              />
              <Typography variant="caption" color="text.secondary" mb={0.5} display="block">
                Sự cố theo thời gian
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                {MAP_TIME_FILTERS.map((opt) => {
                  const active = filter.time === opt.value;
                  return (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      size="small"
                      onClick={() => patchFilter({ time: opt.value })}
                      sx={{
                        fontSize: '0.7rem',
                        bgcolor: active ? 'primary.main' : '#EAF2F4',
                        color: active ? '#fff' : 'text.secondary',
                        fontWeight: active ? 600 : 400,
                        '&:hover': { bgcolor: active ? 'primary.dark' : '#DCEEF2' },
                      }}
                    />
                  );
                })}
              </Stack>
              <Typography variant="caption" color="text.secondary" mt={1.5} display="block">
                📍 {placeCount} địa điểm · {issueCount} sự cố
                {issuesLoading && <CircularProgress size={12} sx={{ ml: 1 }} />}
              </Typography>
            </Box>
          </Collapse>
        </Box>
      </Collapse>
    </Paper>
  );
});

LayerPanel.displayName = 'LayerPanel';

export default LayerPanel;
