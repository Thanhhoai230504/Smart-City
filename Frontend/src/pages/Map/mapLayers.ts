/** Các lớp bật/tắt trên bản đồ web — gom thành một đối tượng như `MapLayers` của app. */
export interface MapLayerState {
  issues: boolean;
  density: boolean;
  places: boolean;
  /** Loại địa điểm đang lọc; rỗng = mọi loại. */
  placeTypes: string[];
  weather: boolean;
  traffic: boolean;
}

export const DEFAULT_LAYERS: MapLayerState = {
  issues: true, density: false, places: true, placeTypes: [], weather: true, traffic: true,
};

/** Chú giải lớp giao thông (màu của tile TomTom) — giống app. */
export const TRAFFIC_LEVELS = [
  { color: '#22C55E', label: 'Thông thoáng' },
  { color: '#EAB308', label: 'Chậm' },
  { color: '#F97316', label: 'Đông' },
  { color: '#EF4444', label: 'Kẹt' },
];

/** Dải màu lớp mật độ (cùng mốc với `leaflet.heat` ở trang bản đồ). */
export const DENSITY_GRADIENT: Record<number, string> = {
  0.2: '#2563EB', 0.4: '#10B981', 0.6: '#F59E0B', 0.8: '#F97316', 1.0: '#EF4444',
};
