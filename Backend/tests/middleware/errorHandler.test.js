const errorHandler = require('../../src/middleware/errorHandler');
const ApiError = require('../../src/utils/apiError');

const mockReq = () => ({});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

describe('Error Handler Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('should handle generic error with default 500 status', () => {
    const err = new Error('Something went wrong');
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Something went wrong',
      })
    );
  });

  it('should use err.statusCode if available', () => {
    const err = new Error('Not found');
    err.statusCode = 404;
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should handle Mongoose ValidationError', () => {
    const err = new Error('Validation failed');
    err.name = 'ValidationError';
    err.errors = {
      name: { message: 'Vui lòng nhập họ tên' },
      email: { message: 'Invalid email' },
    };
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Vui lòng nhập họ tên, Invalid email',
      })
    );
  });

  // E8: trước đây ValidationError bị gộp thành MỘT chuỗi nên client không biết
  // lỗi thuộc field nào. App mobile cần map lỗi vào từng ô nhập.
  it('returns per-field errors for a Mongoose ValidationError', () => {
    const err = new Error('Validation failed');
    err.name = 'ValidationError';
    err.errors = {
      'statusHistory.0.note': { path: 'statusHistory.0.note', message: 'Ghi chú không quá 500 ký tự' },
      title: { path: 'title', message: 'Vui lòng nhập tiêu đề' },
    };
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [
          { field: 'statusHistory.0.note', message: 'Ghi chú không quá 500 ký tự' },
          { field: 'title', message: 'Vui lòng nhập tiêu đề' },
        ],
      })
    );
  });

  it('falls back to the object key when the error has no path', () => {
    const err = new Error('Validation failed');
    err.name = 'ValidationError';
    err.errors = { name: { message: 'Vui lòng nhập họ tên' } };
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [{ field: 'name', message: 'Vui lòng nhập họ tên' }] })
    );
  });

  it('keeps the joined message so existing clients do not break', () => {
    const err = new Error('Validation failed');
    err.name = 'ValidationError';
    err.errors = { a: { message: 'A' }, b: { message: 'B' } };
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'A, B' }));
  });

  it('forwards a business error code so clients can branch without matching text', () => {
    const err = ApiError.badRequestWithCode('Cần tải lên ít nhất 1 ảnh minh chứng', 'NO_RESOLUTION_IMAGE');
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NO_RESOLUTION_IMAGE' }));
  });

  it('omits errors and code when there are none', () => {
    const res = mockRes();
    errorHandler(new Error('plain'), mockReq(), res, mockNext);

    const body = res.json.mock.calls[0][0];
    expect(body.errors).toBeUndefined();
    expect(body.code).toBeUndefined();
  });

  it('should handle Mongoose duplicate key error (code 11000)', () => {
    const err = new Error('Duplicate key');
    err.code = 11000;
    err.keyValue = { email: 'test@test.com' };
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Giá trị của trường email đã tồn tại.',
      })
    );
  });

  it('should handle Mongoose CastError', () => {
    const err = new Error('Cast error');
    err.name = 'CastError';
    err.path = '_id';
    err.value = 'invalid-id';
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Giá trị không hợp lệ cho trường _id.',
      })
    );
  });

  it('should handle JsonWebTokenError', () => {
    const err = new Error('jwt malformed');
    err.name = 'JsonWebTokenError';
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Phiên đăng nhập không hợp lệ.',
      })
    );
  });

  it('should handle TokenExpiredError', () => {
    const err = new Error('jwt expired');
    err.name = 'TokenExpiredError';
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Phiên đăng nhập đã hết hạn.',
      })
    );
  });

  it('should include stack trace in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const err = new Error('Dev error');
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.stack).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });

  it('should NOT include stack trace in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('Prod error');
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.stack).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });

  describe('production message masking', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should mask unexpected 500 error messages', () => {
      const err = new Error('connect ECONNREFUSED cluster0-shard-00.abc.mongodb.net:27017');
      const res = mockRes();

      errorHandler(err, mockReq(), res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Lỗi máy chủ. Vui lòng thử lại sau.' })
      );
    });

    // G5: trước đây chỉ log `err.message` và KHÔNG log stack, trong khi message
    // 5xx lại bị che ở response — nên lỗi nghiêm trọng nhất là lỗi khó truy nhất.
    // Test theo HÀNH VI (message thật và stack có tới được log) chứ không ghim
    // định dạng, để đổi logger sau này không làm vỡ test.
    it('should still log the real message and the stack on the server', () => {
      const err = new Error('mongodb replica set rs0 unreachable');
      errorHandler(err, mockReq(), mockRes(), mockNext);

      const logged = console.error.mock.calls.flat().join(' ');
      expect(logged).toContain('mongodb replica set rs0 unreachable');
      expect(logged).toContain('errorHandler');
    });

    it('logs the request context so a 500 can be traced to a user and route', () => {
      const err = new Error('boom');
      const req = { method: 'POST', originalUrl: '/api/issues', user: { id: 'u1' } };

      errorHandler(err, req, mockRes(), mockNext);

      const logged = console.error.mock.calls.flat().join(' ');
      expect(logged).toContain('/api/issues');
      expect(logged).toContain('u1');
    });

    // Lỗi nghiệp vụ 4xx là chuyện bình thường — không nên đổ stack vào log lỗi.
    it('does not log a 4xx as an error with a stack', () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      errorHandler(ApiError.badRequest('Thiếu tiêu đề'), mockReq(), mockRes(), mockNext);

      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      console.warn.mockRestore();
    });

    it('should keep ApiError messages for 5xx business errors', () => {
      const err = ApiError.serviceUnavailable('Embedding provider đang tắt');
      const res = mockRes();

      errorHandler(err, mockReq(), res, mockNext);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Embedding provider đang tắt' })
      );
    });

    it('should keep ApiError 4xx messages', () => {
      const err = ApiError.badRequest('Không thể tự đổi vai trò của chính mình.');
      const res = mockRes();

      errorHandler(err, mockReq(), res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Không thể tự đổi vai trò của chính mình.' })
      );
    });

    it('should keep Mongoose ValidationError messages', () => {
      const err = new Error('Validation failed');
      err.name = 'ValidationError';
      err.errors = { name: { message: 'Vui lòng nhập họ tên' } };
      const res = mockRes();

      errorHandler(err, mockReq(), res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Vui lòng nhập họ tên' })
      );
    });

    it('should keep duplicate key and CastError messages', () => {
      const dup = new Error('E11000 duplicate key error collection: prod_db.users');
      dup.code = 11000;
      dup.keyValue = { email: 'test@test.com' };
      const dupRes = mockRes();
      errorHandler(dup, mockReq(), dupRes, mockNext);
      expect(dupRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Giá trị của trường email đã tồn tại.' })
      );

      const cast = new Error('Cast error');
      cast.name = 'CastError';
      cast.path = '_id';
      cast.value = 'invalid-id';
      const castRes = mockRes();
      errorHandler(cast, mockReq(), castRes, mockNext);
      expect(castRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Giá trị không hợp lệ cho trường _id.' })
      );
    });

    it('should keep JWT error messages', () => {
      const err = new Error('jwt malformed');
      err.name = 'JsonWebTokenError';
      const res = mockRes();

      errorHandler(err, mockReq(), res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Phiên đăng nhập không hợp lệ.' })
      );
    });
  });
});
