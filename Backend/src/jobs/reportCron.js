const cron = require('node-cron');
const { sendReportToAdmins } = require('../services/reportService');

const startReportCron = () => {
  // Weekly: Monday 8:00 AM
  cron.schedule('0 8 * * 1', () => {
    console.log('📧 Sending weekly report...');
    sendReportToAdmins('weekly');
  });

  // Monthly: 1st day 8:00 AM
  cron.schedule('0 8 1 * *', () => {
    console.log('📧 Sending monthly report...');
    sendReportToAdmins('monthly');
  });

  console.log('⏰ Report cron jobs scheduled (weekly: Mon 8AM, monthly: 1st 8AM)');
};

module.exports = { startReportCron };
