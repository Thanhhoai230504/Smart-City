const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { generateReport, sendReportToAdmins } = require('../services/reportService');
const router = express.Router();

// @route GET /api/reports/preview/:type — Preview report
router.get('/preview/:type', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const type = req.params.type === 'monthly' ? 'monthly' : 'weekly';
    const { html, stats } = await generateReport(type);
    res.json({ success: true, data: { html, stats } });
  } catch (error) { next(error); }
});

// @route POST /api/reports/send — Send report now
router.post('/send', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const type = req.body.type === 'monthly' ? 'monthly' : 'weekly';
    await sendReportToAdmins(type);
    res.json({ success: true, message: `Đã gửi báo cáo ${type === 'weekly' ? 'tuần' : 'tháng'} cho admin` });
  } catch (error) { next(error); }
});

module.exports = router;
