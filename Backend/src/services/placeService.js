const Place = require('../models/Place');
const ApiError = require('../utils/apiError');

const getPlaces = async ({ type, isActive }) => {
  const filter = {};
  if (type) filter.type = type;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const places = await Place.find(filter).sort('name');
  return { places, total: places.length };
};

const getPlaceById = async (id) => {
  const place = await Place.findById(id);
  if (!place) {
    throw ApiError.notFound('Place not found.');
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
    throw ApiError.notFound('Place not found.');
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
    throw ApiError.notFound('Place not found.');
  }
  return place;
};

module.exports = { getPlaces, getPlaceById, createPlace, updatePlace, deletePlace };
