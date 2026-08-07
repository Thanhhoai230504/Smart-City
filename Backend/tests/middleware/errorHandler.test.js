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
      name: { message: 'Name is required' },
      email: { message: 'Invalid email' },
    };
    const res = mockRes();

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Name is required, Invalid email',
      })
    );
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
        message: 'email already exists.',
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
        message: 'Invalid _id: invalid-id',
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
        message: 'Invalid token.',
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
        message: 'Token expired.',
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
        expect.objectContaining({ success: false, message: 'Internal Server Error' })
      );
    });

    it('should still log the real message on the server', () => {
      const err = new Error('mongodb replica set rs0 unreachable');
      errorHandler(err, mockReq(), mockRes(), mockNext);

      expect(console.error).toHaveBeenCalledWith('❌ Error:', 'mongodb replica set rs0 unreachable');
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
      const err = ApiError.badRequest('Cannot change your own role');
      const res = mockRes();

      errorHandler(err, mockReq(), res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Cannot change your own role' })
      );
    });

    it('should keep Mongoose ValidationError messages', () => {
      const err = new Error('Validation failed');
      err.name = 'ValidationError';
      err.errors = { name: { message: 'Name is required' } };
      const res = mockRes();

      errorHandler(err, mockReq(), res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Name is required' })
      );
    });

    it('should keep duplicate key and CastError messages', () => {
      const dup = new Error('E11000 duplicate key error collection: prod_db.users');
      dup.code = 11000;
      dup.keyValue = { email: 'test@test.com' };
      const dupRes = mockRes();
      errorHandler(dup, mockReq(), dupRes, mockNext);
      expect(dupRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'email already exists.' })
      );

      const cast = new Error('Cast error');
      cast.name = 'CastError';
      cast.path = '_id';
      cast.value = 'invalid-id';
      const castRes = mockRes();
      errorHandler(cast, mockReq(), castRes, mockNext);
      expect(castRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid _id: invalid-id' })
      );
    });

    it('should keep JWT error messages', () => {
      const err = new Error('jwt malformed');
      err.name = 'JsonWebTokenError';
      const res = mockRes();

      errorHandler(err, mockReq(), res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid token.' })
      );
    });
  });
});
