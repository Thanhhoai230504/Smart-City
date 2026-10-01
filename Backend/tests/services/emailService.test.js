jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn() })),
}));

const nodemailer = require('nodemailer');
const { sendEmail, maskEmail } = require('../../src/services/emailService');
const { logger } = require('../../src/utils/logger');

const transporter = nodemailer.createTransport.mock.results[0].value;

describe('emailService.maskEmail', () => {
  // Đủ để nhận ra mail nào hỏng mà gửi lại, nhưng không ghi nguyên địa chỉ vào
  // log — log được giữ lâu hơn database và hay đi sang bên thứ ba.
  it('keeps enough to identify the recipient without logging it in full', () => {
    expect(maskEmail('nguyenvana@gmail.com')).toBe('ng********@gmail.com');
  });

  it('does not throw on malformed input', () => {
    expect(maskEmail('khong-phai-email')).toBe('[invalid]');
    expect(maskEmail(undefined)).toBe('[invalid]');
  });
});

describe('emailService.sendEmail', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, SMTP_EMAIL: 'bot@smartcity.vn', SMTP_PASSWORD: 'app-pw' };
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterAll(() => { process.env = OLD_ENV; });

  it('returns true and logs the recipient on success', async () => {
    transporter.sendMail.mockResolvedValue({ messageId: 'mid-1' });

    await expect(sendEmail('a@example.com', 'Xin chao', '<p>hi</p>')).resolves.toBe(true);

    expect(logger.info).toHaveBeenCalledWith('Đã gửi email', expect.objectContaining({
      subject: 'Xin chao',
      messageId: 'mid-1',
    }));
  });

  // Trước đây chỉ in `error.message` — không có người nhận, không có tiêu đề.
  // Gmail chặn hàng loạt là không biết mail nào hỏng để gửi lại.
  it('logs recipient, subject and provider code when sending fails', async () => {
    transporter.sendMail.mockRejectedValue(
      Object.assign(new Error('Daily user sending quota exceeded'), { code: 'EENVELOPE', responseCode: 550 })
    );

    await expect(sendEmail('a@example.com', 'Nhac han SLA', '<p>x</p>')).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledWith('Gửi email thất bại', expect.objectContaining({
      subject: 'Nhac han SLA',
      reason: 'Daily user sending quota exceeded',
      code: 'EENVELOPE',
      responseCode: 550,
    }));
  });

  it('never writes the raw address into the log', async () => {
    transporter.sendMail.mockRejectedValue(new Error('boom'));

    await sendEmail('nguyenvana@gmail.com', 'X', '<p>x</p>');

    const meta = logger.error.mock.calls[0][1];
    expect(meta.to).not.toBe('nguyenvana@gmail.com');
    expect(meta.to).toContain('@gmail.com');
  });

  // Thiếu cấu hình SMTP thì nodemailer vẫn "gửi" rồi hỏng ở tầng mạng với thông
  // báo khó hiểu. Chặn sớm và nói rõ.
  it('skips sending entirely when SMTP is not configured', async () => {
    delete process.env.SMTP_PASSWORD;

    await expect(sendEmail('a@example.com', 'X', '<p>x</p>')).resolves.toBe(false);

    expect(transporter.sendMail).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
