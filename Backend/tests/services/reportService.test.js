jest.mock('../../src/models/Issue');
jest.mock('../../src/models/User');
jest.mock('../../src/services/emailService', () => ({ sendEmail: jest.fn().mockResolvedValue(true) }));

const Issue = require('../../src/models/Issue');
const { generateReport } = require('../../src/services/reportService');

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
