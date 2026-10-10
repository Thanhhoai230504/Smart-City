/**
 * Khung nhìn của trang bản đồ (tâm + mức zoom), lưu trong `sessionStorage` sau mỗi lần kéo/zoom.
 *
 * Bấm "Xem chi tiết" trên thẻ sự cố rồi "Quay lại" thì bản đồ mở lại đúng chỗ đang xem — như app
 * giữ nguyên màn bản đồ nằm dưới màn chi tiết. Trang bản đồ chỉ khôi phục khi vào bằng lịch sử
 * (quay lại, tải lại trang); vào từ menu thì vẫn về trung tâm thành phố.
 */
export interface MapView {
  lat: number;
  lng: number;
  zoom: number;
}

export const MAP_VIEW_KEY = 'map-view';

/** Đọc chuỗi đã lưu; hỏng hoặc ngoài phạm vi thì trả `null` để dùng khung mặc định. */
export const parseMapView = (raw: string | null): MapView | null => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<MapView> | null;
    if (!v || typeof v.lat !== 'number' || typeof v.lng !== 'number' || typeof v.zoom !== 'number') return null;
    if (Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180 || v.zoom < 0 || v.zoom > 22) return null;
    return { lat: v.lat, lng: v.lng, zoom: v.zoom };
  } catch {
    return null;
  }
};

// Trình duyệt chặn bộ nhớ (chế độ riêng tư, bị tắt) thì bỏ qua: bản đồ chỉ mất tính năng nhớ chỗ.
export const loadMapView = (): MapView | null => {
  try {
    return parseMapView(sessionStorage.getItem(MAP_VIEW_KEY));
  } catch {
    return null;
  }
};

export const saveMapView = (view: MapView) => {
  try {
    sessionStorage.setItem(MAP_VIEW_KEY, JSON.stringify({
      lat: Number(view.lat.toFixed(6)),
      lng: Number(view.lng.toFixed(6)),
      zoom: view.zoom,
    }));
  } catch {
    /* không lưu được thì thôi */
  }
};
