const ApiError = require('../../src/utils/apiError');

describe('ApiError', () => {
  describe('constructor', () => {
    it('should create error with statusCode and message', () => {
      const error = new ApiError(400, 'Bad request');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad request');
      expect(error.name).toBe('ApiError');
    });
  });

  describe('static badRequest()', () => {
    it('should create 400 error with message', () => {
      const error = ApiError.badRequest('Invalid input');

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
    });
  });

  describe('static unauthorized()', () => {
    it('should create 401 error with custom message', () => {
      const error = ApiError.unauthorized('Token invalid');

      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Token invalid');
    });

    it('should create 401 error with default message', () => {
      const error = ApiError.unauthorized();

      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
    });
  });

  describe('static forbidden()', () => {
    it('should create 403 error with custom message', () => {
      const error = ApiError.forbidden('Admin only');

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Admin only');
    });

    it('should create 403 error with default message', () => {
      const error = ApiError.forbidden();

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Forbidden');
    });
  });

  describe('static notFound()', () => {
    it('should create 404 error with custom message', () => {
      const error = ApiError.notFound('User not found');

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('User not found');
    });

    it('should create 404 error with default message', () => {
      const error = ApiError.notFound();

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not found');
    });
  });

  describe('static internal()', () => {
    it('should create 500 error with custom message', () => {
      const error = ApiError.internal('DB connection failed');

      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('DB connection failed');
    });

    it('should create 500 error with default message', () => {
      const error = ApiError.internal();

      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Internal server error');
    });
  });
});
