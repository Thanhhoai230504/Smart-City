jest.mock('../../src/models/Issue');
jest.mock('../../src/models/User');
jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  isEmailConfigured: jest.fn().mockReturnValue(true),
}));

const Issue = require('../../src/models/Issue');
const User = require('../../src/models/User');
const { sendEmail, isEmailConfigured } = require('../../src/services/emailService');
const { generateReport, sendReportToAdmins } = require('../../src/services/reportService');

/** Chuỗi `.sort().limit().select().lean()` của Mongoose, trả về `rows` ở cuối. */
const chain = (rows) => {
  const q = {};
  for (const m of ['sort', 'limit', 'select']) q[m] = jest.fn(() => q);
  q.lean = jest.fn().mockResolvedValue(rows);
  return q;
};

const mockData = ({ topVoted = [] } = {}) => {
  Issue.countDocuments.mockResolvedValue(10);
  Issue.aggregate.mockResolvedValue([]);
  // Lần find có `createdAt` là lấy sự cố trong kỳ; lần còn lại là top được vote.
  Issue.find.mockImplementation((filter) => chain(filter.createdAt ? [] : topVoted));
};

describe('reportService.generateReport', () => {
  beforeEach(() => jest.clearAllMocks());

  // Tiêu đề sự cố do người dân nhập và đi thẳng vào email gửi mọi admin.
  // Một sự cố được vote nhiều với tiêu đề chứa link sẽ thành link lừa đảo
  // nằm trong báo cáo chính thức của hệ thống.
  it('escapes user-supplied issue titles in the top-voted list', async () => {
    mockData({
      topVoted: [{ title: '<a href="https://evil.example">Xác minh tài khoản</a>', voteCount: 99 }],
    });

    const { html } = await generateReport('weekly');

    expect(html).not.toContain('href="https://evil.example"');
    expect(html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;');
  });

  it('keeps legitimate Vietnamese titles readable', async () => {
    mockData({ topVoted: [{ title: 'Ổ gà đường Nguyễn Văn Linh', voteCount: 5 }] });

    const { html } = await generateReport('weekly');

    expect(html).toContain('Ổ gà đường Nguyễn Văn Linh');
  });

  it('reports the monthly label when asked for a monthly report', async () => {
    mockData();
    const { html } = await generateReport('monthly');
    expect(html).toContain('Báo cáo Tháng');
  });
});

// Trước đây giá trị trả về của sendEmail bị bỏ qua: Gmail từ chối hay chưa cấu hình SMTP
// thì nút "Gửi báo cáo" vẫn báo thành công.
describe('reportService.sendReportToAdmins', () => {
  const admins = [{ email: 'a1@example.com' }, { email: 'a2@example.com' }];

  beforeEach(() => {
    jest.clearAllMocks();
    mockData();
    isEmailConfigured.mockReturnValue(true);
    sendEmail.mockResolvedValue(true);
    User.find.mockReturnValue({ select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(admins) })) });
  });

  it('returns how many emails actually went out', async () => {
    await expect(sendReportToAdmins('weekly')).resolves.toEqual({ total: 2, sent: 2, failed: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('reports a partial failure instead of plain success', async () => {
    sendEmail.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(sendReportToAdmins('weekly')).resolves.toEqual({ total: 2, sent: 1, failed: 1 });
  });

  it('fails with EMAIL_SEND_FAILED (502) when no email went out', async () => {
    sendEmail.mockResolvedValue(false);
    await expect(sendReportToAdmins('monthly'))
      .rejects.toMatchObject({ statusCode: 502, code: 'EMAIL_SEND_FAILED' });
  });

  it('fails with EMAIL_NOT_CONFIGURED (503) before building the report when SMTP is missing', async () => {
    isEmailConfigured.mockReturnValue(false);
    await expect(sendReportToAdmins('weekly'))
      .rejects.toMatchObject({ statusCode: 503, code: 'EMAIL_NOT_CONFIGURED' });
    expect(User.find).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('fails with NO_RECIPIENTS when there is no active admin', async () => {
    User.find.mockReturnValue({ select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })) });
    await expect(sendReportToAdmins('weekly'))
      .rejects.toMatchObject({ statusCode: 409, code: 'NO_RECIPIENTS' });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
