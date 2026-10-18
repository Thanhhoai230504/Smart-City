const crypto = require('crypto');
const User = require('../../src/models/User');
const Department = require('../../src/models/Department');
const { EMAIL_PATTERN } = require('../../src/utils/emailFormat');

const userEmailError = (email) => new User({ name: 'Người thử', email, password: 'MatKhau#2026' })
  .validateSync()?.errors?.email;

const departmentEmailError = (email) => new Department({ name: 'Đơn vị thử', email })
  .validateSync()?.errors?.email;

describe('Định dạng email ở tầng model (utils/emailFormat)', () => {
  // Biểu thức cũ từ chối dấu "+" và đuôi tên miền dài hơn 3 ký tự.
  it.each([
    'ten+thu@gmail.com',
    'nguyen.van.a@gmail.com',
    'lienhe@congty.info',
    'ban@smartcity.email',
    'sv2251220051@student.dau.edu.vn',
  ])('User accepts %s', (email) => {
    expect(userEmailError(email)).toBeUndefined();
  });

  it.each([
    'khong-co-a-cong',
    'thieu@tenmien',
    'co khoang@trang.com',
    'hai@@a-cong.com',
    'nhan@rong..com',
    '@thieu-ten.com',
  ])('User rejects %s', (email) => {
    expect(userEmailError(email)).toBeDefined();
  });

  it('reports the error in Vietnamese', () => {
    expect(userEmailError('khong-co-a-cong').message).toBe('Email không hợp lệ');
  });

  // Xoá tài khoản thay email bằng địa chỉ ẩn danh (accountService). Với biểu thức cũ,
  // đuôi ".invalid" 7 ký tự không khớp nên lưu tài khoản đã xoá có thể treo tiến trình.
  it('accepts the anonymized address written when an account is deleted', () => {
    const digest = crypto.createHash('sha256').update('a@example.com').digest('hex').slice(0, 24);
    expect(userEmailError(`deleted-${digest}@deleted.invalid`)).toBeUndefined();
  });

  it('applies the same rule to department emails', () => {
    expect(departmentEmailError('htgt+phancong@danang.gov.vn')).toBeUndefined();
    expect(departmentEmailError('khong hop le@danang.gov.vn')).toBeDefined();
  });

  // Biểu thức cũ lồng lượng từ (`(\w+[.-]?)*`) nên chuỗi vài chục ký tự soạn sẵn đã
  // làm treo tiến trình. Biểu thức mới chạy tuyến tính kể cả với chuỗi rất dài.
  it('rejects long crafted strings without catastrophic backtracking', () => {
    const crafted = [`${'a'.repeat(50000)}!`, `${'a.'.repeat(25000)}@x`, `a@${'b.'.repeat(25000)}`];
    const start = Date.now();

    for (const input of crafted) {
      expect(EMAIL_PATTERN.test(input)).toBe(false);
    }
    expect(Date.now() - start).toBeLessThan(500);
  });
});
