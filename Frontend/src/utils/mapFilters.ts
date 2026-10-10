import { DA_NANG_CENTER } from './constants';
import type { MapIssue, Place } from '../types';

/**
 * Lọc tại máy cho trang bản đồ — cùng quy tắc với app (`App/lib/features/map/map_filters.dart`):
 * chỉ việc đang mở, tìm theo tiêu đề/địa chỉ, bán kính quanh trung tâm thành phố, thời gian báo cáo.
 * Không gọi lại API: sự cố đã được tải theo khung nhìn.
 */

/** Mốc thời gian của bộ lọc sự cố — cùng mốc với app (app ghi "Mọi lúc" thay cho "Tất cả"). */
export const MAP_TIME_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: '24h', label: '24 giờ' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
] as const;

export type MapTimeFilter = (typeof MAP_TIME_FILTERS)[number]['value'];

const HOURS: Record<MapTimeFilter, number | null> = { all: null, '24h': 24, '7d': 168, '30d': 720 };

export interface MapFilter {
  search: string;
  /** 0 = không giới hạn. */
  radiusKm: number;
  time: MapTimeFilter;
}

/** Khoảng cách theo đường tròn lớn (Haversine), tính bằng km. */
export const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const matches = (search: string, fields: Array<string | undefined>) => {
  const q = search.trim().toLowerCase();
  return !q || fields.some((field) => field?.toLowerCase().includes(q));
};

const withinRadius = (radiusKm: number, lat: number, lng: number) =>
  radiusKm <= 0 || distanceKm(DA_NANG_CENTER.lat, DA_NANG_CENTER.lng, lat, lng) <= radiusKm;

export const filterMapIssues = (issues: MapIssue[], filter: MapFilter, now = Date.now()): MapIssue[] => {
  const hours = HOURS[filter.time];
  const cutoff = hours == null ? null : now - hours * 3_600_000;
  return issues.filter((issue) =>
    (issue.status === 'reported' || issue.status === 'processing')
    && matches(filter.search, [issue.title, issue.location])
    && withinRadius(filter.radiusKm, issue.latitude, issue.longitude)
    && (cutoff == null || new Date(issue.createdAt).getTime() >= cutoff));
};

/** Địa điểm theo loại đang chọn (rỗng = mọi loại), cùng ô tìm kiếm và bán kính với sự cố. */
export const filterMapPlaces = (
  places: Place[],
  types: string[],
  filter: Pick<MapFilter, 'search' | 'radiusKm'>,
): Place[] => places.filter((place) =>
  (types.length === 0 || types.includes(place.type))
  && matches(filter.search, [place.name, place.address])
  && withinRadius(filter.radiusKm, place.latitude, place.longitude));

/** "14 phút · 5,2 km", "Kẹt xe thêm 6 phút" — cùng cách viết với thẻ tuyến đường của app. */
export const describeRoute = (route: {
  distanceMeters: number | null;
  durationSeconds: number | null;
  trafficDelaySeconds: number;
}) => {
  const minutes = (seconds: number) => {
    const m = Math.round(seconds / 60);
    if (m < 60) return `${Math.max(m, 1)} phút`;
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest === 0 ? `${h} giờ` : `${h} giờ ${rest} phút`;
  };
  const meters = route.distanceMeters ?? 0;
  return {
    distance: meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`,
    duration: route.durationSeconds == null ? '—' : minutes(route.durationSeconds),
    /** `null` khi chậm dưới một phút — coi như không kẹt. */
    delay: route.trafficDelaySeconds >= 60 ? `Kẹt xe thêm ${minutes(route.trafficDelaySeconds)}` : null,
  };
};
