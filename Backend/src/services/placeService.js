const Place = require('../models/Place');
const ApiError = require('../utils/apiError');
const { parsePagination } = require('../utils/pagination');

/**
 * Chuyển chuỗi `west,south,east,north` thành Polygon GeoJSON.
 * Cùng hợp đồng với `view=map&bounds=` của issueService để client chỉ phải
 * dựng một dạng tham số cho cả hai lớp bản đồ.
 */
const parseMapBounds = (bounds) => {
  if (!bounds || typeof bounds !== 'string') return null;
  const values = bounds.split(',').map(Number);
  if (values.length !== 4 || values.some((v) => !Number.isFinite(v))) return null;

  const [west, south, east, north] = values;
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) {
    return null;
  }
  return {
    type: 'Polygon',
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
  };
};

/**
 * Danh sách địa điểm công cộng.
 *
 * Trước đây hàm này là `Place.find(filter).sort('name')` — không limit, không
 * skip, không lọc theo khung nhìn — trong khi mọi service danh sách khác đều đi
 * qua `parsePagination`. Frontend gọi không tham số rồi render 1:1 thành marker,
 * và `/api/places` lại nằm trong danh sách service worker cache nên payload lớn
 * bị lưu luôn vào Cache Storage. Trên 4G của app thì mỗi lần mở bản đồ là tải
 * toàn bộ collection.
 *
 * Trần 500 đủ rộng để không đổi hành vi hiện tại (dữ liệu thật ít hơn nhiều)
 * nhưng chặn được trường hợp collection phình ra.
 */
const getPlaces = async ({ type, isActive, bounds, page, limit } = {}) => {
  const filter = {};
  if (type) filter.type = type;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const geometry = parseMapBounds(bounds);
  if (geometry) filter.geo = { $geoWithin: { $geometry: geometry } };

  const { pageNum, limitNum, skip } = parsePagination(
    { page, limit },
    { defaultLimit: 200, maxLimit: 500 }
  );

  const [places, total] = await Promise.all([
    Place.find(filter).sort('name').skip(skip).limit(limitNum),
    Place.countDocuments(filter),
  ]);

  return {
    places,
    // Giữ `total` ở hình dạng cũ để client hiện tại không phải sửa; nó giờ là
    // tổng số bản ghi khớp filter chứ không phải số phần tử trả về.
    total,
    pagination: {
      current: pageNum,
      pages: Math.ceil(total / limitNum),
      total,
      limit: limitNum,
    },
  };
};

const getPlaceById = async (id) => {
  const place = await Place.findById(id);
  if (!place) {
    throw ApiError.notFound('Không tìm thấy địa điểm.');
  }
  return place;
};

const createPlace = async ({ name, type, address, latitude, longitude, description, phone }) => {
  const place = await Place.create({ name, type, address, latitude, longitude, description, phone });
  return place;
};

// Chỉ những field này được phép cập nhật từ request. Đáng chú ý là `geo` không
// có trong danh sách: nó do hook pre('validate') sinh ra từ latitude/longitude,
// nếu cho client gán trực tiếp thì toạ độ GeoJSON có thể lệch khỏi lat/lng và
// làm sai truy vấn khoảng cách khi tính điểm ưu tiên.
const UPDATABLE_FIELDS = ['name', 'type', 'address', 'latitude', 'longitude', 'description', 'phone', 'isActive'];

const updatePlace = async (id, data) => {
  // Dùng document.save() để hook đồng bộ GeoJSON chạy khi toạ độ thay đổi.
  const place = await Place.findById(id);
  if (!place) {
    throw ApiError.notFound('Không tìm thấy địa điểm.');
  }
  UPDATABLE_FIELDS.forEach(field => {
    if (data[field] !== undefined) place[field] = data[field];
  });
  await place.save();
  return place;
};

const deletePlace = async (id) => {
  const place = await Place.findByIdAndDelete(id);
  if (!place) {
    throw ApiError.notFound('Không tìm thấy địa điểm.');
  }
  return place;
};

module.exports = { getPlaces, getPlaceById, createPlace, updatePlace, deletePlace };
