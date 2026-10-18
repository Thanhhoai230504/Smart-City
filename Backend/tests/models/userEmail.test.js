const User = require('../../src/models/User');

const emailError = (email) => new User({ name: 'Người thử', email, password: 'MatKhau#2026' })
  .validateSync()?.errors?.email;

describe('User — định dạng email', () => {
  // Biểu thức cũ từ chối dấu "+" và đuôi tên miền dài hơn 3 ký tự.
  it.each([
    'ten+thu@gmail.com',
    'nguyen.van.a@gmail.com',
    'lienhe@congty.info',
    'ban@smartcity.email',
    'sv2251220051@student.dau.edu.vn',
  ])('accepts %s', (email) => {
    expect(emailError(email)).toBeUndefined();
  });

  it.each([
    'khong-co-a-cong',
    'thieu@tenmien',
    'co khoang@trang.com',
    'hai@@a-cong.com',
    'nhan@rong..com',
    '@thieu-ten.com',
  ])('rejects %s', (email) => {
    expect(emailError(email)).toBeDefined();
  });

  // Biểu thức cũ lồng lượng từ (`(\w+[.-]?)*`) nên chuỗi vài chục ký tự soạn sẵn đã
  // làm treo tiến trình. Biểu thức mới chạy tuyến tính kể cả với chuỗi rất dài.
  it('rejects a long crafted string without catastrophic backtracking', () => {
    const crafted = `${'a'.repeat(50000)}!`;
    const start = Date.now();

    expect(emailError(crafted)).toBeDefined();
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('reports the error in Vietnamese', () => {
    expect(emailError('khong-co-a-cong').message).toBe('Email không hợp lệ');
  });
});
