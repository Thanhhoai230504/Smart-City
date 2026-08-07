const {
  PUBLIC_CAMERAS,
  getEmbedUrl,
  getThumbnailUrl,
  getWatchUrl,
  getMappableCameras,
} = require('../utils/publicCameras');

/** Bán kính Trái Đất (mét) — dùng cho Haversine */
const EARTH_RADIUS_M = 6371000;

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Khoảng cách mặt cầu giữa hai toạ độ, tính bằng mét.
 * Danh sách camera là mảng tĩnh 10 phần tử trong bộ nhớ nên tính thẳng ở Node,
 * không cần $geoNear như sự cố (không có collection nào để truy vấn).
 */
const haversine = (lat1, lng1, lat2, lng2) => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a)));
};

/**
 * Gắn sẵn URL embed và thumbnail để frontend không phải tự ghép chuỗi từ
 * `youtubeId` — tránh luôn rủi ro iframe injection ở phía client.
 */
const decorate = (camera) => ({
  id: camera.id,
  name: camera.name,
  type: camera.type,
  coords: camera.coords,
  embedUrl: getEmbedUrl(camera.youtubeId),
  thumbnailUrl: getThumbnailUrl(camera.youtubeId),
  watchUrl: getWatchUrl(camera.youtubeId),
});

/**
 * Toàn bộ camera công cộng, kể cả camera chưa có toạ độ.
 * @returns {{ cameras: Array, total: number }}
 */
const getCameras = () => {
  const cameras = PUBLIC_CAMERAS.map(decorate);
  return { cameras, total: cameras.length };
};

/**
 * Camera quanh một toạ độ, gần → xa. Chỉ xét camera đã xác minh toạ độ.
 * Dùng ở trang chi tiết sự cố: cán bộ mở camera xem trực tiếp để xác minh
 * hiện trường trước khi cử người đi.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusMeters - Bán kính tìm kiếm (mặc định 2000)
 * @returns {{ cameras: Array, total: number }} Tối đa 5 camera, kèm `distance` (mét)
 */
const getNearbyCameras = (lat, lng, radiusMeters = 2000) => {
  const cameras = getMappableCameras()
    .map((camera) => ({
      ...decorate(camera),
      distance: haversine(lat, lng, camera.coords.lat, camera.coords.lng),
    }))
    .filter((camera) => camera.distance <= radiusMeters)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);

  return { cameras, total: cameras.length };
};

module.exports = { getCameras, getNearbyCameras };
