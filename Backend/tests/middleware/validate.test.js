const { validationResult } = require('express-validator');

jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));

const validate = require('../../src/middleware/validate');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

describe('Validate Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call next() when there are no validation errors', () => {
    validationResult.mockReturnValue({
      isEmpty: () => true,
      array: () => [],
    });

    const req = {};
    const res = mockRes();

    validate(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 400 with formatted errors when validation fails', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [
        { path: 'email', msg: 'Vui lòng nhập email' },
        { path: 'password', msg: 'Mật khẩu phải có từ 8 đến 128 ký tự' },
      ],
    });

    const req = {};
    const res = mockRes();

    validate(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      // Câu tiếng Việt của lỗi đầu tiên — không còn chuỗi cố định "Validation
      // failed" mà client chỉ đọc `message` sẽ hiện nguyên cho người dùng.
      message: 'Vui lòng nhập email',
      code: 'VALIDATION_ERROR',
      errors: [
        { field: 'email', message: 'Vui lòng nhập email' },
        { field: 'password', message: 'Mật khẩu phải có từ 8 đến 128 ký tự' },
      ],
    });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
