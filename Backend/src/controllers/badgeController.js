const badgeService = require('../services/badgeService');

const getMyBadges = async (req, res, next) => {
  try {
    const data = await badgeService.getUserBadges(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getLeaderboard = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const data = await badgeService.getLeaderboard(limit);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMyBadges, getLeaderboard };
