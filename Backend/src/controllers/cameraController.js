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
      return res.status(400).json({ success: false, message: 'Thiếu toạ độ (lat, lng)' });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedRadius = parseInt(radius, 10);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng) || Number.isNaN(parsedRadius)) {
      return res.status(400).json({ success: false, message: 'lat, lng và radius phải là số' });
    }

    const data = cameraService.getNearbyCameras(parsedLat, parsedLng, parsedRadius);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCameras, getNearbyCameras };
