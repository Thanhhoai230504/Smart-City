/**
 * Camera công cộng Đà Nẵng — nguồn: kênh YouTube "Phát Triển Đà Nẵng"
 * (@0511.VietNam), là nguồn phát của trang camera.0511.vn.
 *
 * Đây là các luồng YouTube công khai, nhúng hợp pháp bằng iframe embed.
 * KHÔNG rip/proxy luồng: vừa vi phạm điều khoản YouTube, vừa tốn băng thông server.
 *
 * Kiểm tra ngày 07/08/2026: 7/10 luồng đang phát; 3 luồng
 * (cau-tran-thi-ly, truong-ly-tu-trong-cong, ks-hai-trieu) trả
 * LIVE_STREAM_OFFLINE — video vẫn tồn tại, chủ kênh tạm tắt và có thể mở lại.
 * Luồng có thể tắt bất kỳ lúc nào — UI phải xử lý trường hợp iframe lỗi.
 *
 * Tọa độ: lấy qua OpenStreetMap Nominatim từ địa chỉ trong tiêu đề video,
 * đối chiếu chéo bằng reverse geocode (07/08/2026). Đây là tọa độ CƠ SỞ được
 * quan sát, không phải vị trí chính xác của thân camera — đủ dùng để cắm marker
 * và tìm camera quanh một sự cố.
 *
 * `coords: null` = chưa xác minh được tọa độ, KHÔNG tự bịa.
 */

const PUBLIC_CAMERAS = [
  {
    id: 'cau-rong-tay',
    name: 'Nút giao thông tây Cầu Rồng',
    youtubeId: 'oC8ttZHG50I',
    coords: { lat: 16.0612, lng: 108.2275 },
    type: 'traffic',
  },
  {
    id: 'cau-tran-thi-ly',
    name: 'Cầu Trần Thị Lý',
    youtubeId: 'qv_qe9n1Gx4',
    coords: { lat: 16.0525, lng: 108.2275 },
    type: 'traffic',
  },
  {
    id: 'benh-vien-c-cong-sau',
    name: 'Cổng sau Bệnh viện C Đà Nẵng',
    youtubeId: 'oif_zZFIfB4',
    coords: { lat: 16.0732, lng: 108.2166 },
    type: 'public',
  },
  {
    id: 'benh-vien-da-nang-cong-trinh',
    name: 'Công trình Bệnh viện Đà Nẵng',
    youtubeId: 'x8tUUv-NGXs',
    coords: { lat: 16.073, lng: 108.2154 },
    type: 'construction',
  },
  {
    id: 'truong-nguyen-hue',
    name: 'Cổng trường Nguyễn Huệ',
    youtubeId: 'sJvEFrG0wq0',
    coords: { lat: 16.0748, lng: 108.216 },
    type: 'school',
  },
  {
    id: 'truong-ly-tu-trong-cong',
    name: 'Cổng trường Lý Tự Trọng (12 Lý Tự Trọng)',
    youtubeId: 'RUrUS1JluRs',
    coords: { lat: 16.0774, lng: 108.2217 },
    type: 'school',
  },
  {
    id: 'truong-ly-tu-trong-ptz',
    name: 'Trường Tiểu học Lý Tự Trọng (PTZ)',
    youtubeId: '1EamsYw_Xyo',
    coords: { lat: 16.0779, lng: 108.2212 },
    type: 'school',
  },
  {
    id: 'truong-ly-tu-trong-song-han',
    name: 'Trường Lý Tự Trọng — hướng KS Sông Hàn',
    youtubeId: 'NeJGBQAY-bE',
    coords: { lat: 16.0774, lng: 108.2217 },
    type: 'school',
  },
  {
    id: 'ks-hai-trieu',
    name: 'Khách sạn Hải Triều (PTZ)',
    youtubeId: 'MeimXMs6t1o',
    coords: null,
    type: 'public',
  },
  {
    id: 'phuong-tran',
    name: 'Trang phục biểu diễn Phương Trần (PTZ)',
    youtubeId: 'G_G8A6JU_LI',
    coords: null,
    type: 'public',
  },
];

const getEmbedUrl = (youtubeId) =>
  `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&rel=0`;

const getThumbnailUrl = (youtubeId) =>
  `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;

// Link mở trực tiếp trên YouTube — dùng làm phương án dự phòng khi iframe
// không phát được (chủ kênh tạm tắt luồng)
const getWatchUrl = (youtubeId) => `https://www.youtube.com/watch?v=${youtubeId}`;

// Chỉ camera đã có tọa độ mới hiển thị được trên bản đồ
const getMappableCameras = () => PUBLIC_CAMERAS.filter((c) => c.coords !== null);

module.exports = {
  PUBLIC_CAMERAS,
  getEmbedUrl,
  getThumbnailUrl,
  getWatchUrl,
  getMappableCameras,
};
