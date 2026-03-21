const environmentService = require('../services/environmentService');

const getEnvironmentData = async (req, res, next) => {
  try {
    const data = await environmentService.getEnvironmentData();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getEnvironmentHistory = async (req, res, next) => {
  try {
    const data = await environmentService.getEnvironmentHistory(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getEnvironmentData, getEnvironmentHistory };
