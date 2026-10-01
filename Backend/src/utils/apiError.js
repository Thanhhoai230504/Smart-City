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

  /**
   * Lỗi nghiệp vụ có mã máy đọc được.
   *
   * Client phải phân nhánh theo trường code, KHÔNG theo message: message là chuỗi
   * tiếng Việt viết cho người đọc, đổi một chữ là mọi client so khớp chuỗi sẽ vỡ.
   * App mobile là client thứ hai nên quy ước này cần rõ ràng ngay từ đầu.
   * Danh sách mã đang dùng:
   *   INVALID_STATUS_TRANSITION - chuyển trạng thái sai luật (utils/issueStatusConfig.js)
   *   MERGED_ISSUE              - phiếu đã bị gộp, phải thao tác trên phiếu gốc
   *   NO_RESOLUTION_IMAGE       - chưa có ảnh minh chứng nên chưa được báo đã xử lý
   *   ISSUE_NOT_RESOLVED        - chỉ phiếu đã xử lý mới đánh giá được
   *   ALREADY_RATED             - mỗi phiếu chỉ được đánh giá một lần
   *   EMAIL_NOT_VERIFIED        - tài khoản chưa xác thực email (services/authService.js)
   *   TOKEN_EXPIRED             - access token hết hạn (middleware/auth.js)
   */
  static badRequestWithCode(message, code) {
    const error = new ApiError(400, message);
    error.code = code;
    return error;
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

  static serviceUnavailable(message) {
    return new ApiError(503, message || 'Service unavailable');
  }
}

module.exports = ApiError;
