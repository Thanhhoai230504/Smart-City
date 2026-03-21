const placeService = require('../services/placeService');

const getPlaces = async (req, res, next) => {
  try {
    const data = await placeService.getPlaces(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getPlaceById = async (req, res, next) => {
  try {
    const place = await placeService.getPlaceById(req.params.id);
    res.json({ success: true, data: { place } });
  } catch (error) {
    next(error);
  }
};

const createPlace = async (req, res, next) => {
  try {
    const place = await placeService.createPlace(req.body);
    res.status(201).json({ success: true, message: 'Place created successfully.', data: { place } });
  } catch (error) {
    next(error);
  }
};

const updatePlace = async (req, res, next) => {
  try {
    const place = await placeService.updatePlace(req.params.id, req.body);
    res.json({ success: true, message: 'Place updated successfully.', data: { place } });
  } catch (error) {
    next(error);
  }
};

const deletePlace = async (req, res, next) => {
  try {
    await placeService.deletePlace(req.params.id);
    res.json({ success: true, message: 'Place deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPlaces, getPlaceById, createPlace, updatePlace, deletePlace };
