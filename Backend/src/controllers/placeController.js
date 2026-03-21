const Place = require('../models/Place');
const ApiError = require('../utils/apiError');

/**
 * @desc    Get all places (with optional type filter)
 * @route   GET /api/places
 * @access  Public
 */
const getPlaces = async (req, res, next) => {
  try {
    const { type, isActive } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const places = await Place.find(filter).sort('name');

    res.json({
      success: true,
      data: {
        places,
        total: places.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single place by ID
 * @route   GET /api/places/:id
 * @access  Public
 */
const getPlaceById = async (req, res, next) => {
  try {
    const place = await Place.findById(req.params.id);

    if (!place) {
      throw ApiError.notFound('Place not found.');
    }

    res.json({
      success: true,
      data: { place }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new place (admin only)
 * @route   POST /api/places
 * @access  Private (Admin)
 */
const createPlace = async (req, res, next) => {
  try {
    const { name, type, address, latitude, longitude, description, phone } = req.body;

    const place = await Place.create({
      name,
      type,
      address,
      latitude,
      longitude,
      description,
      phone
    });

    res.status(201).json({
      success: true,
      message: 'Place created successfully.',
      data: { place }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update place (admin only)
 * @route   PUT /api/places/:id
 * @access  Private (Admin)
 */
const updatePlace = async (req, res, next) => {
  try {
    const place = await Place.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!place) {
      throw ApiError.notFound('Place not found.');
    }

    res.json({
      success: true,
      message: 'Place updated successfully.',
      data: { place }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete place (admin only)
 * @route   DELETE /api/places/:id
 * @access  Private (Admin)
 */
const deletePlace = async (req, res, next) => {
  try {
    const place = await Place.findByIdAndDelete(req.params.id);

    if (!place) {
      throw ApiError.notFound('Place not found.');
    }

    res.json({
      success: true,
      message: 'Place deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPlaces, getPlaceById, createPlace, updatePlace, deletePlace };
