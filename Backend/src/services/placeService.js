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

const updatePlace = async (id, data) => {
  const place = await Place.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!place) {
    throw ApiError.notFound('Place not found.');
  }
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
