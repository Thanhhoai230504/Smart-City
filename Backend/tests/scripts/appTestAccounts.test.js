const { isTestTitle, readPassword, TEST_EMAILS } = require('../../src/scripts/appTestAccounts');

// Script này chạy trên DB THẬT. Hai rào chắn dưới đây là thứ ngăn nó xoá nhầm
// phiếu của người dân thật hoặc tạo tài khoản cán bộ có mật khẩu yếu.
describe('appTestAccounts — rào chắn', () => {
  it('chỉ nhận phiếu có tiêu đề bắt đầu bằng [TEST]', () => {
    expect(isTestTitle('[TEST] Ổ gà thử nghiệm')).toBe(true);
    expect(isTestTitle('  [TEST] có khoảng trắng đầu')).toBe(true);
    expect(isTestTitle('Ổ gà [TEST] ở giữa')).toBe(false);
    expect(isTestTitle('[test] chữ thường')).toBe(false);
    expect(isTestTitle(undefined)).toBe(false);
  });

  it('chỉ đúng 2 email miền example.com (RFC 2606 — thư không tới ai)', () => {
    expect(TEST_EMAILS).toHaveLength(2);
    expect(TEST_EMAILS.every((e) => e.endsWith('@example.com'))).toBe(true);
  });

  it('bắt buộc mật khẩu từ biến môi trường, đủ dài — không có mật khẩu mặc định trong code', () => {
    expect(() => readPassword({})).toThrow();
    expect(() => readPassword({ APP_TEST_ACCOUNT_PASSWORD: 'ngan' })).toThrow();
    expect(readPassword({ APP_TEST_ACCOUNT_PASSWORD: 'mot-cum-tu-du-dai-2026' })).toBe('mot-cum-tu-du-dai-2026');
  });
});
