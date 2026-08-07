const cameraService = require('../services/cameraService');

const getCameras = async (req, res, next) => {
  try {
    const data = cameraService.getCameras();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getNearbyCameras = async (req, res, next) => {
  try {
    const { lat, lng, radius = 2000 } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng are required' });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedRadius = parseInt(radius, 10);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng) || Number.isNaN(parsedRadius)) {
      return res.status(400).json({ success: false, message: 'lat, lng and radius must be numbers' });
    }

    const data = cameraService.getNearbyCameras(parsedLat, parsedLng, parsedRadius);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCameras, getNearbyCameras };
