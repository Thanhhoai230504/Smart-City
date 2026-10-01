/**
 * Lớp nền bản đồ — NGUỒN DUY NHẤT cho mọi MapContainer trong web.
 *
 * Trước đây mỗi màn tự khai URL tile. Trang chi tiết sự cố khai khác ba màn còn
 * lại và hỏng hai lần liền, cả hai lần đều chỉ hiện nền xám, không báo lỗi gì:
 * - tile.openstreetmap.org: DNS router của mạng phát triển trả ::1 cho cả tên
 *   miền openstreetmap.org;
 * - CARTO (basemaps.cartocdn.com): nay bắt buộc API key, trả về ảnh "API KEY
 *   REQUIRED" với HTTP 200 — nên kiểm tra mã HTTP thôi là không đủ.
 *
 * ⚠️ URL dưới đây không phải API chính thức của Google Maps Platform (dùng ngoài
 * API là trái điều khoản của Google). Muốn đổi nhà cung cấp thì chỉ sửa ở đây.
 */
export const BASE_TILE_URL = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=vi';
export const BASE_TILE_ATTRIBUTION = '&copy; Google Maps';
