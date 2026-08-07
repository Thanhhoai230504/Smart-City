const cron = require('node-cron');
const { runSlaCheck } = require('../services/slaService');

const startSlaCron = () => {
  // Mỗi giờ, vào phút thứ 15. SLA ngắn nhất là 12 giờ nên quét theo giờ là đủ
  // mịn, mà không tạo tải không cần thiết.
  cron.schedule('15 * * * *', async () => {
    try {
      const result = await runSlaCheck();
      if (result.reminded || result.escalated) {
        console.log(`⏰ SLA: nhắc ${result.reminded || 0} sự cố, leo cấp ${result.escalated || 0} sự cố`);
      }
    } catch (err) {
      console.error('❌ SLA cron thất bại:', err.message);
    }
  });

  console.log('⏰ SLA cron scheduled (mỗi giờ, phút 15)');
};

module.exports = { startSlaCron };
