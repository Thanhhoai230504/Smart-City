const express = require('express');
const validate = require('../middleware/validate');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { createPlaceValidator } = require('../validators/placeValidator');
const {
  getPlaces,
  getPlaceById,
  createPlace,
  updatePlace,
  deletePlace
} = require('../controllers/placeController');

const router = express.Router();

// @route   GET /api/places
router.get('/', getPlaces);

// @route   GET /api/places/:id
router.get('/:id', getPlaceById);

// @route   POST /api/places (Admin only)
router.post('/', authMiddleware, adminMiddleware, createPlaceValidator, validate, createPlace);

// @route   PUT /api/places/:id (Admin only)
router.put('/:id', authMiddleware, adminMiddleware, updatePlace);

// @route   DELETE /api/places/:id (Admin only)
router.delete('/:id', authMiddleware, adminMiddleware, deletePlace);

module.exports = router;
