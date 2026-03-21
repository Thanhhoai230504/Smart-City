const { body } = require('express-validator');

const createPlaceValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Place name is required'),
  body('type')
    .notEmpty().withMessage('Place type is required')
    .isIn(['hospital', 'school', 'bus_stop', 'park', 'police'])
    .withMessage('Invalid place type'),
  body('latitude')
    .notEmpty().withMessage('Latitude is required')
    .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('longitude')
    .notEmpty().withMessage('Longitude is required')
    .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude')
];

module.exports = { createPlaceValidator };
