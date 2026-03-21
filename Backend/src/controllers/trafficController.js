const trafficService = require('../services/trafficService');

const getTrafficStats = async (req, res, next) => {
  try {
    const data = await trafficService.getTrafficStats();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTrafficStats };
