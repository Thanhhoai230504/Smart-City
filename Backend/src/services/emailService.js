const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

/**
 * Che phần giữa của địa chỉ email trước khi ghi log.
 *
 * Log thường được gửi sang dịch vụ bên thứ ba và giữ lâu hơn database, nên không
 * ghi nguyên địa chỉ. Nhưng vẫn phải đủ để nhận ra mail nào hỏng mà gửi lại —
 * đó chính là thứ trước đây thiếu.
 */
const maskEmail = (email) => {
  if (typeof email !== 'string' || !email.includes('@')) return '[invalid]';
  const [name, domain] = email.split('@');
  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(name.length - 2, 1))}@${domain}`;
};

/**
 * Gửi email.
 *
 * Trước đây hàm này bắt mọi lỗi, trả `false`, và chỉ in `error.message` — KHÔNG
 * ghi người nhận hay tiêu đề. Giá trị trả về lại bị bỏ qua ở hầu hết nơi gọi vì
 * không `await`. Nếu Gmail chặn (sai app password, vượt quota ~500 mail/ngày),
 * mọi email phân công và nhắc SLA thất bại hàng loạt trong khi nghiệp vụ vẫn báo
 * thành công, và log không cho biết mail nào gửi cho ai nên KHÔNG THỂ gửi lại.
 *
 * Giữ nguyên hợp đồng trả về boolean (nhiều nơi gọi không await), nhưng giờ mọi
 * thất bại đều có đủ ngữ cảnh để truy.
 *
 * @returns {Promise<boolean>} true nếu gửi được
 */
const sendEmail = async (to, subject, html) => {
  // Thiếu cấu hình SMTP thì nodemailer vẫn "gửi" rồi hỏng ở tầng mạng với thông
  // báo khó hiểu. Chặn sớm và nói rõ.
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    logger.warn('Bỏ qua gửi email: chưa cấu hình SMTP', {
      to: maskEmail(to),
      subject,
    });
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Smart City Đà Nẵng" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html,
    });
    logger.info('Đã gửi email', { to: maskEmail(to), subject, messageId: info?.messageId });
    return true;
  } catch (error) {
    logger.error('Gửi email thất bại', {
      to: maskEmail(to),
      subject,
      reason: error.message,
      // Gmail trả mã riêng cho quota/xác thực — biết mã là biết nên gửi lại hay
      // phải sửa cấu hình.
      code: error.code,
      responseCode: error.responseCode,
    });
    return false;
  }
};

module.exports = { sendEmail, maskEmail };
