/**
 * Custom API Error class
 * Use to throw errors with specific status codes
 */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }

  static badRequest(message) {
    return new ApiError(400, message);
  }

  static unauthorized(message) {
    return new ApiError(401, message || 'Unauthorized');
  }

  static forbidden(message) {
    return new ApiError(403, message || 'Forbidden');
  }

  static notFound(message) {
    return new ApiError(404, message || 'Not found');
  }

  static internal(message) {
    return new ApiError(500, message || 'Internal server error');
  }
}

module.exports = ApiError;
