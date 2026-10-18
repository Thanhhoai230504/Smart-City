const cron = require('node-cron');
const { sendReportToAdmins } = require('../services/reportService');

/**
 * Gửi một kỳ báo cáo. Trước đây cron gọi sendReportToAdmins mà không await và không bắt
 * lỗi: không thư nào đi thì log vẫn chỉ có dòng "đang gửi". Số thư gửi được do service
 * ghi; ở đây ghi lỗi khi cả kỳ không gửi được.
 */
const runReport = async (type) => {
  console.log(`📧 Sending ${type} report...`);
  try {
    await sendReportToAdmins(type);
  } catch (err) {
    console.error(`❌ Không gửi được báo cáo ${type}:`, err.message);
  }
};

const startReportCron = () => {
  // Weekly: Monday 8:00 AM
  cron.schedule('0 8 * * 1', () => runReport('weekly'));

  // Monthly: 1st day 8:00 AM
  cron.schedule('0 8 1 * *', () => runReport('monthly'));

  console.log('⏰ Report cron jobs scheduled (weekly: Mon 8AM, monthly: 1st 8AM)');
};

module.exports = { startReportCron, runReport };
