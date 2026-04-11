const { getPublicStatistics } = require('../services/statisticsService');

const getStatistics = async (req, res, next) => {
  try {
    const data = await getPublicStatistics();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getStatistics };
