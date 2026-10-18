const { validationResult } = require('express-validator');
const {
  forgotPasswordValidator,
  resendVerificationValidator,
} = require('../../src/validators/authValidator');

const run = async (chain, body) => {
  const req = { body };
  for (const validator of chain) {
    await validator.run(req);
  }
  return req;
};

describe('authValidator — email ở quên mật khẩu và gửi lại thư xác thực', () => {
  // normalizeEmail() mặc định bỏ dấu chấm và phần "+…" của Gmail, trong khi lúc đăng
  // ký địa chỉ được lưu đúng như gõ → tìm không ra tài khoản, người dùng không nhận
  // được thư. Hai validator này chỉ được trim.
  it.each([
    ['forgotPasswordValidator', forgotPasswordValidator],
    ['resendVerificationValidator', resendVerificationValidator],
  ])('%s keeps Gmail dots and +tags exactly as typed', async (_name, chain) => {
    const req = await run(chain, { email: '  nguyen.van.a+thu@gmail.com ' });

    expect(validationResult(req).isEmpty()).toBe(true);
    expect(req.body.email).toBe('nguyen.van.a+thu@gmail.com');
  });

  it.each([
    ['forgotPasswordValidator', forgotPasswordValidator],
    ['resendVerificationValidator', resendVerificationValidator],
  ])('%s still rejects a malformed address', async (_name, chain) => {
    const req = await run(chain, { email: 'khong-phai-email' });

    expect(validationResult(req).isEmpty()).toBe(false);
  });
});
