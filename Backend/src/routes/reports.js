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
// Không thư nào đi thì service ném lỗi (503 chưa cấu hình SMTP, 502 máy chủ thư từ chối,
// 409 không có quản trị viên nhận); gửi được một phần thì báo rõ số thư lỗi và trả
// `data.failed` để web hiện cảnh báo thay vì "thành công".
router.post('/send', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const type = req.body.type === 'monthly' ? 'monthly' : 'weekly';
    const result = await sendReportToAdmins(type);
    const label = type === 'weekly' ? 'tuần' : 'tháng';
    const message = result.failed
      ? `Đã gửi báo cáo ${label} cho ${result.sent}/${result.total} quản trị viên; ${result.failed} thư gửi lỗi.`
      : `Đã gửi báo cáo ${label} cho ${result.sent} quản trị viên.`;
    res.json({ success: true, message, data: result });
  } catch (error) { next(error); }
});

module.exports = router;
