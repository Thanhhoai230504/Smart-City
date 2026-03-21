const dashboardService = require('../services/dashboardService');

const getStats = async (req, res, next) => {
  try {
    const data = await dashboardService.getStats();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getStats };
