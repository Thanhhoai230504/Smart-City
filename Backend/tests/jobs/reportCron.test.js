jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../src/services/reportService', () => ({ sendReportToAdmins: jest.fn() }));

const cron = require('node-cron');
const { sendReportToAdmins } = require('../../src/services/reportService');
const { runReport, startReportCron } = require('../../src/jobs/reportCron');

// Trước đây cron gọi sendReportToAdmins mà không await và không bắt lỗi: không thư nào đi
// thì log vẫn chỉ có dòng "đang gửi".
describe('jobs/reportCron', () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('ghi lỗi khi cả kỳ không gửi được, không để promise bị reject trôi đi', async () => {
    sendReportToAdmins.mockRejectedValue(new Error('Không gửi được báo cáo'));

    await expect(runReport('weekly')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('weekly'), 'Không gửi được báo cáo');
  });

  it('lên lịch tuần và tháng, mỗi lịch gửi đúng loại báo cáo', async () => {
    sendReportToAdmins.mockResolvedValue({ total: 1, sent: 1, failed: 0 });
    startReportCron();

    expect(cron.schedule).toHaveBeenCalledTimes(2);
    const [[weeklyExpr, weeklyJob], [monthlyExpr, monthlyJob]] = cron.schedule.mock.calls;
    expect(weeklyExpr).toBe('0 8 * * 1');
    expect(monthlyExpr).toBe('0 8 1 * *');

    await weeklyJob();
    await monthlyJob();
    expect(sendReportToAdmins.mock.calls).toEqual([['weekly'], ['monthly']]);
  });
});
