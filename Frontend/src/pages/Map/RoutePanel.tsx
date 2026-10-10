import React from 'react';
import {
  Box, Button, ButtonBase, CircularProgress, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  CloseRounded, DirectionsRounded, ErrorOutlineRounded, LocationOnOutlined, MyLocation, PlaceRounded,
} from '@mui/icons-material';
import { STATUS_MAP } from '../../utils/constants';
import { C } from '../Home/homeStyle';
import MapPanel, { PanelBadge } from './MapPanel';
import { panelFieldSx } from './mapPanelStyles';
import type { RouteEnd, RoutePlanner, RoutePoint } from './useRoutePlanner';
import type { GeoPrediction } from '../../api/geoApi';

/**
 * Ô nhập một đầu mút + danh sách gợi ý; rời khỏi cả ô lẫn danh sách (hoặc nhấn Esc) thì đóng gợi ý.
 * Danh sách nằm ngay trong bảng (đẩy phần dưới xuống) chứ không nổi lên: bảng cắt phần tràn ra ngoài.
 */
const EndpointField: React.FC<{
  point: RoutePoint;
  label: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onType: (text: string) => void;
  onPick: (prediction: GeoPrediction) => void;
  onDismiss: () => void;
  endAdornment?: React.ReactNode;
}> = ({ point, label, inputRef, onType, onPick, onDismiss, endAdornment }) => (
  <Box
    sx={{ position: 'relative' }}
    onBlur={(event) => {
      if (point.suggestions.length && !event.currentTarget.contains(event.relatedTarget as Node | null)) onDismiss();
    }}
  >
    <TextField
      fullWidth
      size="small"
      placeholder={label}
      value={point.label}
      inputRef={inputRef}
      onChange={(event) => onType(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && point.suggestions.length) {
          event.stopPropagation();
          onDismiss();
        }
      }}
      inputProps={{ 'aria-label': label, autoComplete: 'off' }}
      InputProps={{ endAdornment }}
      sx={panelFieldSx}
    />
    {point.suggestions.length > 0 && (
      <Box
        component="ul"
        aria-label={`Gợi ý cho ${label.toLowerCase()}`}
        sx={{
          mt: 0.75, mb: 0, p: 0.5, listStyle: 'none',
          bgcolor: C.white, borderRadius: '14px', border: `1px solid ${C.line}`,
          boxShadow: '0 12px 24px -18px rgba(8,40,60,.5)',
        }}
      >
        {point.suggestions.map((prediction) => (
          <li key={prediction.place_id}>
            <ButtonBase
              onClick={() => onPick(prediction)}
              sx={{
                width: '100%', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 1, px: 1, py: 0.9,
                borderRadius: '10px', textAlign: 'left',
                '&:hover, &:focus-visible': { bgcolor: C.bg },
              }}
            >
              <LocationOnOutlined sx={{ fontSize: 18, mt: '1px', color: C.muted, flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 650, color: C.ink }}>
                  {prediction.structured_formatting?.main_text ?? prediction.description}
                </Typography>
                {prediction.structured_formatting?.secondary_text && (
                  <Typography noWrap sx={{ fontSize: 12, color: C.muted }}>
                    {prediction.structured_formatting.secondary_text}
                  </Typography>
                )}
              </Box>
            </ButtonBase>
          </li>
        ))}
      </Box>
    )}
  </Box>
);

interface RoutePanelProps {
  route: RoutePlanner;
  open: boolean;
  onToggle: () => void;
  /** Ô điểm đi — trang bản đồ đặt con trỏ vào đây khi bấm "Chỉ đường" trên thẻ sự cố. */
  startInputRef: React.Ref<HTMLInputElement>;
}

/**
 * Bảng "Chỉ đường": hai ô điểm đi/đến nối bằng đường chấm (có gợi ý địa chỉ, nút dùng vị trí của
 * tôi), nút "Tìm đường", báo lỗi khi không tìm được tuyến, và thẻ kết quả giống thẻ tuyến đường
 * của app — thời gian · quãng đường, điểm đến, tình trạng kẹt xe.
 */
const RoutePanel = React.forwardRef<HTMLElement, RoutePanelProps>(({ route, open, onToggle, startInputRef }, ref) => {
  const canRoute = Boolean(route.start.coord && route.end.coord);
  const needsPick = (point: RoutePoint) => Boolean(point.label.trim()) && !point.coord;
  const hasInput = Boolean(route.start.label || route.end.label || route.path.length);
  const field = (which: RouteEnd) => ({
    point: route[which],
    onType: (text: string) => route.type(which, text),
    onPick: (prediction: GeoPrediction) => route.pick(which, prediction),
    onDismiss: () => route.closeSuggestions(which),
  });

  return (
    <MapPanel
      ref={ref}
      icon={DirectionsRounded}
      title="Chỉ đường"
      subtitle="Tìm tuyến, tính cả kẹt xe"
      badge={route.summary ? <PanelBadge>{route.summary.duration}</PanelBadge> : null}
      open={open}
      onToggle={onToggle}
      sx={{ top: 16, right: 16 }}
    >
      {/* cột trái: chấm điểm đi — đường chấm — ghim điểm đến */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', columnGap: 1, rowGap: 1, mt: 0.5 }}>
        <Box aria-hidden="true" sx={{ gridRow: '1 / span 2', display: 'flex', flexDirection: 'column', alignItems: 'center', py: '13px' }}>
          <Box sx={{ width: 12, height: 12, flexShrink: 0, borderRadius: '50%', border: '3px solid #10B981', bgcolor: '#FFFFFF' }} />
          <Box sx={{ flex: 1, my: '3px', borderLeft: '2px dotted #A8BCC7' }} />
          <PlaceRounded sx={{ fontSize: 18, color: '#E5484D', flexShrink: 0, mb: '-2px' }} />
        </Box>
        <EndpointField
          {...field('start')}
          label="Điểm đi"
          inputRef={startInputRef}
          endAdornment={(
            <InputAdornment position="end">
              <Tooltip title="Dùng vị trí của tôi">
                <span>
                  <IconButton size="small" aria-label="Dùng vị trí của tôi" onClick={route.locateStart} disabled={route.locating} sx={{ color: C.blue }}>
                    {route.locating ? <CircularProgress size={16} /> : <MyLocation sx={{ fontSize: 19 }} />}
                  </IconButton>
                </span>
              </Tooltip>
            </InputAdornment>
          )}
        />
        <EndpointField {...field('end')} label="Điểm đến" />
      </Box>

      {(needsPick(route.start) || needsPick(route.end)) && !route.error
        && !route.start.suggestions.length && !route.end.suggestions.length && (
        <Typography sx={{ mt: 1, fontSize: 12.5, lineHeight: 1.45, color: C.muted }}>
          Chọn địa chỉ trong danh sách gợi ý (hoặc bấm biểu tượng định vị ở ô điểm đi) để có toạ độ.
        </Typography>
      )}

      {route.error && (
        <Stack role="alert" direction="row" spacing={1} sx={{ mt: 1.25, p: 1.25, borderRadius: '12px', bgcolor: STATUS_MAP.reported.bg, color: STATUS_MAP.reported.text }}>
          <ErrorOutlineRounded sx={{ fontSize: 18, mt: '1px' }} />
          <Typography sx={{ fontSize: 13, lineHeight: 1.45 }}>{route.error}</Typography>
        </Stack>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <Button
          variant="contained"
          fullWidth
          disabled={!canRoute || route.loading}
          onClick={route.findRoute}
          startIcon={route.loading ? <CircularProgress size={16} color="inherit" /> : <DirectionsRounded />}
          sx={{ height: 42, borderRadius: '12px', fontWeight: 700 }}
        >
          {route.loading ? 'Đang tìm đường…' : 'Tìm đường'}
        </Button>
        {hasInput && (
          <Tooltip title="Xoá tuyến đường">
            <Button
              variant="outlined"
              aria-label="Xoá tuyến đường"
              onClick={route.clear}
              sx={{ height: 42, minWidth: 42, px: 0, borderRadius: '12px', color: C.body }}
            >
              <CloseRounded fontSize="small" />
            </Button>
          </Tooltip>
        )}
      </Stack>

      {route.summary && (
        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: '14px', bgcolor: 'rgba(11,94,142,.06)', border: '1px solid rgba(11,94,142,.14)' }}>
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography sx={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', color: C.ink, lineHeight: 1.2 }}>
              {route.summary.duration}
            </Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: C.body }}>· {route.summary.distance}</Typography>
          </Stack>
          <Typography noWrap sx={{ mt: 0.25, fontSize: 12.5, color: C.muted }}>Tới {route.end.label}</Typography>
          <Box sx={{
            mt: 1, display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 26, px: 1.1, borderRadius: 999,
            fontSize: 12.5, fontWeight: 700,
            ...(route.summary.delay
              ? { bgcolor: STATUS_MAP.processing.bg, color: STATUS_MAP.processing.text }
              : { bgcolor: STATUS_MAP.resolved.bg, color: STATUS_MAP.resolved.text }),
          }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: route.summary.delay ? STATUS_MAP.processing.color : STATUS_MAP.resolved.color }} />
            {route.summary.delay ?? 'Không kẹt xe'}
          </Box>
        </Box>
      )}
    </MapPanel>
  );
});

RoutePanel.displayName = 'RoutePanel';

export default RoutePanel;
