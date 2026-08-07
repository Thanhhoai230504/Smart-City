/**
 * Danh sách quận/huyện Đà Nẵng — NGUỒN DUY NHẤT cho toàn hệ thống.
 * Trước đây danh sách này bị lặp ở issueService, statisticsService,
 * authService và AdminDashboard với nội dung không khớp nhau.
 */
const DA_NANG_DISTRICTS = [
  'Hải Châu',
  'Thanh Khê',
  'Sơn Trà',
  'Ngũ Hành Sơn',
  'Liên Chiểu',
  'Cẩm Lệ',
  'Hòa Vang',
  'Hoàng Sa',
];

/** Nhãn dùng cho các sự cố không xác định được quận */
const UNKNOWN_DISTRICT = 'Khác';

/**
 * Một số cách viết khác thường gặp trong chuỗi địa chỉ trả về từ Goong,
 * map về tên chuẩn ở trên.
 */
const DISTRICT_ALIASES = {
  'Hoà Vang': 'Hòa Vang',
  'Cam Le': 'Cẩm Lệ',
  'Hai Chau': 'Hải Châu',
  'Thanh Khe': 'Thanh Khê',
  'Son Tra': 'Sơn Trà',
  'Ngu Hanh Son': 'Ngũ Hành Sơn',
  'Lien Chieu': 'Liên Chiểu',
  'Hoa Vang': 'Hòa Vang',
};

/**
 * Suy ra tên quận chuẩn hoá từ chuỗi địa chỉ.
 * Chuẩn hoá này chạy MỘT LẦN lúc tạo/sửa sự cố và lưu vào field `district`,
 * nhờ đó truy vấn theo quận dùng được index thay vì $regex quét toàn bảng.
 *
 * @param {string} location - Chuỗi địa chỉ (thường từ Goong reverse geocode)
 * @returns {string} Tên quận chuẩn, hoặc 'Khác' nếu không khớp
 */
const resolveDistrict = (location) => {
  if (!location || typeof location !== 'string') return UNKNOWN_DISTRICT;

  const exact = DA_NANG_DISTRICTS.find((d) => location.includes(d));
  if (exact) return exact;

  const aliasKey = Object.keys(DISTRICT_ALIASES).find((alias) => location.includes(alias));
  if (aliasKey) return DISTRICT_ALIASES[aliasKey];

  return UNKNOWN_DISTRICT;
};

/** Danh sách hợp lệ cho enum của model và validate input */
const DISTRICT_ENUM = [...DA_NANG_DISTRICTS, UNKNOWN_DISTRICT];

/**
 * Chuẩn hoá giá trị quận do client gửi lên (query filter, watchedDistricts).
 * Chấp nhận tên chuẩn, alias không dấu, và tiền tố "Quận"/"Huyện".
 *
 * @param {string} input
 * @returns {string|null} Tên quận chuẩn, hoặc null nếu không hợp lệ
 */
const normalizeDistrictInput = (input) => {
  if (!input || typeof input !== 'string') return null;

  const cleaned = input.trim().replace(/^(Quận|Huyện|Q\.|H\.)\s*/i, '');
  if (!cleaned) return null;

  const exact = DISTRICT_ENUM.find((d) => d.toLowerCase() === cleaned.toLowerCase());
  if (exact) return exact;

  const aliasKey = Object.keys(DISTRICT_ALIASES).find(
    (alias) => alias.toLowerCase() === cleaned.toLowerCase()
  );
  if (aliasKey) return DISTRICT_ALIASES[aliasKey];

  return null;
};

module.exports = {
  DA_NANG_DISTRICTS,
  DISTRICT_ENUM,
  UNKNOWN_DISTRICT,
  resolveDistrict,
  normalizeDistrictInput,
};
