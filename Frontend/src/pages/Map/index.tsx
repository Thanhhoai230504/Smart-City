import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useNavigationType } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { fetchPlaces } from '../../store/slices/placeSlice';
import { fetchEnvironment } from '../../store/slices/environmentSlice';
import { issueApi } from '../../api/issueApi';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline } from 'react-leaflet';
import { BASE_TILE_ATTRIBUTION, BASE_TILE_URL } from '../../utils/mapTiles';
import L from 'leaflet';
import 'leaflet.heat';
import 'leaflet/dist/leaflet.css';
import { Box, ButtonBase, Tooltip, useMediaQuery } from '@mui/material';
import { CenterFocusStrongRounded } from '@mui/icons-material';
import { DA_NANG_CENTER, DEFAULT_ZOOM, PLACE_TYPE_MAP, CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';
import { Place, MapIssue, EnvironmentData } from '../../types';
import { TRAFFIC_TILE_URL } from '../../api/geoApi';
import { loadMapView, saveMapView } from '../../utils/mapView';
import { filterMapIssues, filterMapPlaces, MapFilter } from '../../utils/mapFilters';
import { C } from '../Home/homeStyle';
import IssuePreviewCard from './IssuePreviewCard';
import LayerPanel from './LayerPanel';
import RoutePanel from './RoutePanel';
import { DEFAULT_LAYERS, DENSITY_GRADIENT, MapLayerState } from './mapLayers';
import { LatLngTuple, useRoutePlanner } from './useRoutePlanner';

// Mọi lời gọi Goong/TomTom đi qua backend proxy để API key không rời khỏi server
// — xem api/geoApi.ts. Trước đây key nằm công khai trong bundle.
const TRAFFIC_FLOW_TILES_URL = TRAFFIC_TILE_URL;

const iconCache = new Map<string, L.DivIcon>();
/**
 * Hai kiểu marker để màu chỉ mang MỘT nghĩa trên bản đồ:
 * - 'solid' (sự cố): nền đặc theo màu TRẠNG THÁI — nổi nhất, dành cho việc cần xử lý.
 * - 'outline' (địa điểm, môi trường): nền trắng, viền màu loại, nhỏ hơn — lùi ra sau.
 * Trước đây mọi lớp đều là chấm màu đặc: bệnh viện và sự cố cùng đỏ, trường học
 * trùng xanh với ngập nước, công viên trùng xanh lá với cây đổ.
 * 'selected' là ghim sự cố đang mở thẻ xem nhanh: to hơn, có vòng sáng cùng màu.
 * Biểu tượng bên trong ẩn với trình đọc màn hình; tên đọc lên lấy từ `title` của Marker.
 */
const makeIcon = (emoji: string, color: string, variant: 'solid' | 'selected' | 'outline' = 'solid') => {
  const cacheKey = `${emoji}-${color}-${variant}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const size = { solid: 32, selected: 42, outline: 26 }[variant];
  const look = {
    solid: `background:${color};border:2px solid white;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3)`,
    selected: `background:${color};border:3px solid white;font-size:20px;box-shadow:0 0 0 5px ${color}59,0 6px 16px rgba(8,40,60,0.45)`,
    outline: `background:#FFFFFF;border:2px solid ${color};font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.3)`,
  }[variant];
  const icon = L.divIcon({
    html: `<div aria-hidden="true" style="${look};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center">${emoji}</div>`,
    className: '', iconSize: [size, size], iconAnchor: [size / 2, size], popupAnchor: [0, -size],
  });
  iconCache.set(cacheKey, icon);
  return icon;
};

const envIcon = makeIcon('🌡️', '#2F7D64', 'outline');

// Điểm đi/đến của tuyến: cùng hình với cột chấm — đường chấm — ghim ở bảng "Chỉ đường".
const routeStartIcon = L.divIcon({
  html: '<div aria-hidden="true" style="width:18px;height:18px;border-radius:50%;background:#FFFFFF;border:4px solid #10B981;box-shadow:0 2px 6px rgba(8,40,60,.45)"></div>',
  className: '', iconSize: [18, 18], iconAnchor: [9, 9],
});
const routeEndIcon = L.divIcon({
  html: '<svg aria-hidden="true" width="30" height="38" viewBox="0 0 30 38"><path d="M15 36.5S27 24.2 27 15A12 12 0 0 0 3 15c0 9.2 12 21.5 12 21.5z" fill="#E5484D" stroke="#FFFFFF" stroke-width="2"/><circle cx="15" cy="15" r="4.5" fill="#FFFFFF"/></svg>',
  className: '', iconSize: [30, 38], iconAnchor: [15, 37],
});

// `leaflet.heat` gắn `heatLayer` vào L nhưng không kèm kiểu TypeScript.
type HeatLayerFactory = (points: [number, number, number][], options: Record<string, unknown>) => L.Layer;
const heatLayer: HeatLayerFactory = (points, options) =>
  (L as unknown as { heatLayer: HeatLayerFactory }).heatLayer(points, options);

const HeatmapLayer: React.FC<{ points: [number, number, number][] }> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const heat = heatLayer(points, {
      radius: 30,
      blur: 25,
      maxZoom: 17,
      max: 1.0,
      gradient: DENSITY_GRADIENT,
    }).addTo(map);
    return () => { map.removeLayer(heat); };
  }, [map, points]);

  return null;
};

/** Nút đưa bản đồ về trung tâm Đà Nẵng; chặn sự kiện để bấm nút không kéo hay nhấp vào bản đồ. */
const RecenterButton: React.FC = () => {
  const map = useMap();
  const guard = useCallback((el: HTMLButtonElement | null) => {
    if (el) L.DomEvent.disableClickPropagation(el);
  }, []);
  return (
    <Tooltip title="Về trung tâm Đà Nẵng" placement="left">
      <ButtonBase
        ref={guard}
        aria-label="Về trung tâm Đà Nẵng"
        onClick={() => map.setView([DA_NANG_CENTER.lat, DA_NANG_CENTER.lng], DEFAULT_ZOOM)}
        sx={{
          // thẳng hàng với nút trợ lý ảo ở trên (ChatbotWidget)
          position: 'absolute', zIndex: 1000, bottom: 20, right: { xs: 22, sm: 30 },
          width: 44, height: 44, borderRadius: '14px', color: C.blue, bgcolor: C.white,
          border: `1px solid ${C.line}`, boxShadow: '0 14px 28px -16px rgba(8,40,60,.65)',
          '&:hover': { bgcolor: C.bg },
          '&:focus-visible': { outline: `2px solid ${C.blue}`, outlineOffset: 2 },
        }}
      >
        <CenterFocusStrongRounded sx={{ fontSize: 22 }} />
      </ButtonBase>
    </Tooltip>
  );
};

/**
 * Chỉ tải marker nằm trong viewport. Kéo/zoom bản đồ sẽ huỷ request cũ và
 * debounce request mới, tránh tình trạng response chậm ghi đè response mới.
 */
const MapIssueLoader: React.FC<{
  onLoad: (issues: MapIssue[]) => void;
  onLoading: (loading: boolean) => void;
}> = ({ onLoad, onLoading }) => {
  const map = useMap();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const loadVisibleIssues = useCallback(async () => {
    const currentBounds = map.getBounds();
    const bounds = [
      currentBounds.getWest(),
      currentBounds.getSouth(),
      currentBounds.getEast(),
      currentBounds.getNorth(),
    ].map((value) => value.toFixed(6)).join(',');

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    onLoading(true);

    try {
      const { data } = await issueApi.getMapIssues(
        { bounds, limit: 500, sort: '-createdAt' },
        controller.signal
      );
      onLoad(data.data.issues);
    } catch {
      if (!controller.signal.aborted) onLoad([]);
    } finally {
      if (requestRef.current === controller) onLoading(false);
    }
  }, [map, onLoad, onLoading]);

  const scheduleLoad = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(loadVisibleIssues, 250);
  }, [loadVisibleIssues]);

  useMapEvents({
    moveend: scheduleLoad,
    zoomend: scheduleLoad,
  });

  useEffect(() => {
    loadVisibleIssues();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      requestRef.current?.abort();
    };
  }, [loadVisibleIssues]);

  return null;
};

/**
 * Ghim đang chọn: kéo nhẹ bản đồ nếu ghim nằm sát mép hoặc bị thẻ xem nhanh che (đo vị trí thẻ
 * thật — `offsetTop` không bị hiệu ứng trượt vào làm lệch); bấm nền bản đồ hoặc mở popup địa
 * điểm/môi trường thì đóng thẻ. Bấm ghim không tính là bấm nền — marker của Leaflet không cho
 * sự kiện click lan lên bản đồ.
 */
const IssueSelection: React.FC<{
  issue: MapIssue | null;
  cardRef: React.RefObject<HTMLDivElement>;
  onDismiss: () => void;
}> = ({ issue, cardRef, onDismiss }) => {
  const map = useMapEvents({ click: onDismiss, popupopen: onDismiss });

  useEffect(() => {
    if (!issue) return;
    const card = cardRef.current;
    // Thẻ và bản đồ cùng nằm trong một khung `position: relative`, nên offsetTop tính từ đỉnh bản đồ.
    const coveredBelow = card ? map.getContainer().clientHeight - card.offsetTop : 0;
    map.panInside([issue.latitude, issue.longitude], {
      paddingTopLeft: [32, 72],
      paddingBottomRight: [32, coveredBelow + 32],
    });
  }, [issue, map, cardRef]);

  return null;
};

/**
 * Tìm được tuyến thì đưa cả tuyến vào khung nhìn như app, chừa chỗ cho các bảng đang mở: màn rộng
 * bảng nằm hai bên, màn hẹp bảng nằm trên cùng (đo kích thước bảng thật lúc canh).
 */
const RouteFitter: React.FC<{ path: LatLngTuple[]; overlays: React.RefObject<HTMLElement>[] }> = ({ path, overlays }) => {
  const map = useMap();

  useEffect(() => {
    if (path.length < 2) return;
    const box = map.getContainer().getBoundingClientRect();
    let left = 32;
    let right = 32;
    let top = 32;
    overlays.forEach((overlay) => {
      const r = overlay.current?.getBoundingClientRect();
      if (!r) return;
      if (box.width < 900) top = Math.max(top, r.bottom - box.top + 24);
      else if (r.left - box.left < box.width / 2) left = Math.max(left, r.right - box.left + 24);
      else right = Math.max(right, box.right - r.left + 24);
    });
    map.fitBounds(L.latLngBounds(path), { paddingTopLeft: [left, top], paddingBottomRight: [right, 40], maxZoom: 16 });
  }, [path, map, overlays]);

  return null;
};

/** Ghi khung nhìn sau mỗi lần kéo/zoom để "Quay lại" từ trang chi tiết về đúng chỗ (utils/mapView). */
const ViewSaver: React.FC = () => {
  useMapEvents({
    moveend: (e) => {
      const map = e.target as L.Map;
      const center = map.getCenter();
      saveMapView({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    },
  });
  return null;
};

const MapPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { places } = useSelector((s: RootState) => s.places);
  const { environmentData } = useSelector((s: RootState) => s.environment);
  const [issues, setIssues] = useState<MapIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);

  // Quay lại từ trang chi tiết (hoặc tải lại trang) thì mở đúng khung nhìn cũ; vào từ menu thì về trung tâm.
  const navigationType = useNavigationType();
  const [initialView] = useState(() => (navigationType === 'POP' ? loadMapView() : null));

  // Sự cố đang mở thẻ xem nhanh (bản web của bottom sheet trên app) và ghim của nó, để trả tiêu điểm khi đóng.
  const [selectedIssue, setSelectedIssue] = useState<MapIssue | null>(null);
  const selectedMarkerRef = useRef<HTMLElement | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const startInputRef = useRef<HTMLInputElement>(null);

  const [layers, setLayers] = useState<MapLayerState>(DEFAULT_LAYERS);
  const [filter, setFilter] = useState<MapFilter>({ search: '', radiusKm: 0, time: 'all' });

  // Dưới 900 px hai bảng cùng nằm ở mép trên nên mỗi lúc chỉ mở một bảng (nút "Chỉ đường" ẩn khi
  // bảng lớp đang mở), và bảng lớp thu gọn sẵn để không che bản đồ khi vừa vào trang.
  const compact = useMediaQuery('(max-width:899.95px)', { noSsr: true });
  const [showLayerPanel, setShowLayerPanel] = useState(!compact);
  const [showRouting, setShowRouting] = useState(false);
  const layerPanelRef = useRef<HTMLDivElement>(null);
  const routePanelRef = useRef<HTMLElement>(null);
  const overlayRefs = useMemo(() => [layerPanelRef, routePanelRef], []);

  const route = useRoutePlanner();
  const { setPoint } = route;

  useEffect(() => {
    // Nêu trần tường minh thay vì dựa vào mặc định của server. Địa điểm là dữ
    // liệu tĩnh và ít (bệnh viện, trường học, công viên) nên tải một lần rẻ hơn
    // tải theo khung nhìn — bounds sẽ bắt refetch mỗi lần kéo bản đồ. Sự cố thì
    // ngược lại, nhiều và thay đổi liên tục, nên vẫn dùng bounds (MapIssueLoader).
    dispatch(fetchPlaces({ limit: '500' }));
    dispatch(fetchEnvironment());
  }, [dispatch]);

  const handleMapIssues = useCallback((nextIssues: MapIssue[]) => {
    setIssues(nextIssues);
  }, []);

  const handleMapIssuesLoading = useCallback((loading: boolean) => {
    setIssuesLoading(loading);
  }, []);

  const selectIssue = useCallback((issue: MapIssue, marker: L.Marker) => {
    selectedMarkerRef.current = marker.getElement() ?? null;
    setSelectedIssue(issue);
  }, []);

  const dismissPreview = useCallback(() => setSelectedIssue(null), []);

  const closePreview = useCallback((restoreFocus: boolean) => {
    setSelectedIssue(null);
    if (restoreFocus) selectedMarkerRef.current?.focus({ preventScroll: true });
  }, []);

  // Tắt lớp sự cố thì đóng luôn thẻ xem nhanh.
  useEffect(() => {
    if (!layers.issues) setSelectedIssue(null);
  }, [layers.issues]);

  const toggleLayerPanel = () => {
    if (!showLayerPanel && compact) setShowRouting(false);
    setShowLayerPanel(!showLayerPanel);
  };

  const toggleRouting = () => {
    if (!showRouting && compact) setShowLayerPanel(false);
    setShowRouting(!showRouting);
  };

  // Lọc tại máy — cùng quy tắc với app (utils/mapFilters.ts).
  const filteredPlaces = useMemo(
    () => filterMapPlaces(places, layers.placeTypes, filter),
    [places, layers.placeTypes, filter],
  );
  const filteredIssues = useMemo(() => filterMapIssues(issues, filter), [issues, filter]);
  // Chú giải chỉ liệt kê trạng thái đang có trên bản đồ.
  const issueStatuses = useMemo(
    () => (['reported', 'processing'] as const).filter((s) => filteredIssues.some((i) => i.status === s)),
    [filteredIssues],
  );

  const heatmapPoints: [number, number, number][] = useMemo(
    () => filteredIssues.map((i) => [i.latitude, i.longitude, 0.8]),
    [filteredIssues]
  );

  // "Chỉ đường" trên thẻ sự cố: điền sẵn điểm đến là sự cố, như app mở trang chỉ đường.
  const routeToIssue = useCallback((issue: MapIssue) => {
    // flushSync: bảng chỉ đường phải mở xong (Collapse bỏ `visibility: hidden`) thì mới đặt con trỏ được.
    flushSync(() => {
      setSelectedIssue(null);
      setPoint('end', issue.title, [issue.latitude, issue.longitude]);
      setShowRouting(true);
      if (compact) setShowLayerPanel(false);
    });
    // Còn thiếu điểm đi nên đưa con trỏ vào ô đó — trừ màn cảm ứng, để bàn phím ảo không che bản đồ.
    if (window.matchMedia('(pointer: fine)').matches) startInputRef.current?.focus({ preventScroll: true });
  }, [setPoint, compact]);

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', position: 'relative' }}>
      <LayerPanel
        ref={layerPanelRef}
        open={showLayerPanel}
        onToggle={toggleLayerPanel}
        layers={layers}
        onLayersChange={setLayers}
        filter={filter}
        onFilterChange={setFilter}
        issueCount={filteredIssues.length}
        placeCount={filteredPlaces.length}
        issueStatuses={issueStatuses}
        issuesLoading={issuesLoading}
      />

      {!(compact && showLayerPanel) && (
        <RoutePanel
          ref={routePanelRef}
          route={route}
          open={showRouting}
          onToggle={toggleRouting}
          startInputRef={startInputRef}
        />
      )}

      {/* Map */}
      <MapContainer
        center={initialView ? [initialView.lat, initialView.lng] : [DA_NANG_CENTER.lat, DA_NANG_CENTER.lng]}
        zoom={initialView?.zoom ?? DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <MapIssueLoader
          onLoad={handleMapIssues}
          onLoading={handleMapIssuesLoading}
        />
        <IssueSelection issue={selectedIssue} cardRef={previewRef} onDismiss={dismissPreview} />
        <RouteFitter path={route.path} overlays={overlayRefs} />
        <ViewSaver />
        <TileLayer attribution={BASE_TILE_ATTRIBUTION} url={BASE_TILE_URL} />

        {/* Lớp giao thông TomTom, tile đi qua proxy của backend (key ở server).
            Không còn điều kiện theo API key vì client không biết key nữa; backend
            trả 503 nếu chưa cấu hình và Leaflet chỉ đơn giản không vẽ được tile. */}
        {layers.traffic && (
          <TileLayer
            url={TRAFFIC_FLOW_TILES_URL}
            opacity={0.7}
            zIndex={400}
          />
        )}

        {layers.density && <HeatmapLayer points={heatmapPoints} />}

        {/* Places markers */}
        {layers.places && filteredPlaces.map((place: Place) => {
          const info = PLACE_TYPE_MAP[place.type] || PLACE_TYPE_MAP.hospital;
          return (
            <Marker key={place._id} position={[place.latitude, place.longitude]}
              icon={makeIcon(info.icon, info.color, 'outline')} title={`${info.label}: ${place.name}`}>
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

        {/* Issue markers: bấm (hoặc Enter/Space khi đang chọn bằng Tab) mở thẻ xem nhanh. Leaflet chỉ
            tự xử lý Enter cho marker có popup, nên phải bắt `keypress` ở đây. */}
        {layers.issues && filteredIssues.map((issue: MapIssue) => {
          const cat = CATEGORY_MAP[issue.category] || CATEGORY_MAP.other;
          const st = STATUS_MAP[issue.status] || STATUS_MAP.reported;
          const selected = selectedIssue?._id === issue._id;
          return (
            <Marker key={issue._id} position={[issue.latitude, issue.longitude]}
              icon={makeIcon(cat.icon, st.color, selected ? 'selected' : 'solid')}
              zIndexOffset={selected ? 1000 : 0}
              title={`${cat.label}: ${issue.title}`}
              eventHandlers={{
                click: (e) => selectIssue(issue, e.target),
                keypress: (e) => {
                  const { key } = e.originalEvent;
                  if (key !== 'Enter' && key !== ' ') return;
                  e.originalEvent.preventDefault();
                  selectIssue(issue, e.target);
                },
              }}
            />
          );
        })}

        {/* Environment markers */}
        {layers.weather && environmentData.map((env: EnvironmentData, i: number) => (
          <Marker key={`env-${i}`} position={[env.latitude, env.longitude]} icon={envIcon}
            title={`Thời tiết ${env.location}`}>
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

        {/* Tuyến đường: viền trắng dưới, nét xanh biển trên để nổi trên lớp giao thông */}
        {route.path.length > 0 && (
          <>
            <Polyline positions={route.path} interactive={false} pathOptions={{ color: '#FFFFFF', weight: 10, opacity: 0.95 }} />
            <Polyline positions={route.path} interactive={false} pathOptions={{ color: C.blue, weight: 6, opacity: 0.95 }} />
          </>
        )}
        {/* điểm đi/đến chỉ để nhìn: không nhận chuột, không nằm trong thứ tự Tab */}
        {route.start.coord && (
          <Marker position={route.start.coord} icon={routeStartIcon} interactive={false} keyboard={false} />
        )}
        {route.end.coord && (
          <Marker position={route.end.coord} icon={routeEndIcon} interactive={false} keyboard={false} zIndexOffset={500} />
        )}

        <RecenterButton />
      </MapContainer>

      {selectedIssue && (
        <IssuePreviewCard
          key={selectedIssue._id}
          ref={previewRef}
          issue={selectedIssue}
          onClose={closePreview}
          onDirections={() => routeToIssue(selectedIssue)}
        />
      )}
    </Box>
  );
};

export default MapPage;
