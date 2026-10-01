import axiosClient from './axiosClient';
import { ApiResponse } from '../types';

export interface GeoPrediction {
  description: string;
  place_id: string;
  structured_formatting?: { main_text: string; secondary_text: string };
}

export interface GeoPlaceDetail {
  lat: number;
  lng: number;
  address: string;
}

export interface GeoRoute {
  distanceMeters: number | null;
  durationSeconds: number | null;
  trafficDelaySeconds: number;
  /** Danh sách [lat, lng] để vẽ polyline. */
  points: Array<[number, number]>;
}

/**
 * Mọi lời gọi bản đồ đi qua backend thay vì gọi thẳng Goong/TomTom.
 *
 * Lý do: Vite nhúng mọi biến `VITE_*` thẳng vào bundle, nên trước đây API key nằm
 * công khai trong `dist/assets/*.js` — ai mở DevTools cũng đọc được. Trên web còn
 * hạn chế được bằng HTTP referrer restriction, nhưng app native không gửi referrer
 * và APK giải nén ra là đọc được, nên proxy là cách duy nhất.
 *
 * Backend cache lại kết quả (gợi ý 60s, toạ độ 24h, chỉ đường 5 phút) nên đổi sang
 * proxy không làm chậm thêm mà còn giảm số lượt gọi phải trả tiền.
 */
export const geoApi = {
  autocomplete: (
    input: string,
    opts?: { lat?: number; lng?: number; radius?: number; limit?: number },
    signal?: AbortSignal,
  ) =>
    axiosClient.get<ApiResponse<{ predictions: GeoPrediction[] }>>('/geo/autocomplete', {
      params: { input, ...opts },
      signal,
    }),

  placeDetail: (placeId: string, signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<GeoPlaceDetail>>('/geo/place-detail', {
      params: { place_id: placeId },
      signal,
    }),

  reverse: (lat: number, lng: number, signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<{ address: string }>>('/geo/reverse', {
      params: { lat, lng },
      signal,
    }),

  route: (from: [number, number], to: [number, number], signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<GeoRoute>>('/geo/route', {
      params: { fromLat: from[0], fromLng: from[1], toLat: to[0], toLng: to[1] },
      signal,
    }),
};

/**
 * URL template cho lớp tile giao thông, trỏ về proxy của backend.
 *
 * Leaflet tự thay {z}/{x}/{y}; backend tải tile từ TomTom rồi stream lại kèm
 * `Cache-Control: max-age=900` để không gọi lại mỗi khung hình.
 */
export const TRAFFIC_TILE_URL = `${
  import.meta.env.VITE_API_URL || '/api'
}/geo/tiles/traffic/{z}/{x}/{y}.png`;
