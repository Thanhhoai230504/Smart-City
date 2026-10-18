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
   *   GOOGLE_TOKEN_INVALID      - ID token Google sai chữ ký/hết hạn/sai `aud` (services/googleAuthService.js)
   *   GOOGLE_EMAIL_NOT_VERIFIED - Google chưa xác minh email của tài khoản đó
   *   GOOGLE_SIGN_IN_DISABLED   - máy chủ chưa cấu hình GOOGLE_CLIENT_ID
   *   DEVIATION_REASON_REQUIRED - quyết định đánh giá đơn vị khác gợi ý mà chưa nêu lý do
   *   EVALUATION_REVOKED        - quyết định đánh giá đã huỷ rồi
   *   EVALUATION_EXISTS (409)   - đơn vị đã có quyết định còn hiệu lực cho đúng kỳ đó
   *   REOPEN_ADMIN_ONLY (403)   - phiếu đã đóng chỉ quản trị viên mở lại (services/issueService.js)
   *   MERGED_INTO_THIS (409)    - phiếu đã có phiếu khác gộp vào, người báo cáo không xoá/sửa được
   *   SELF_RATING (403)         - cán bộ tự đánh giá phiếu do đơn vị mình xử lý (services/ratingService.js)
   *   DEPARTMENT_INACTIVE (403) - đơn vị của cán bộ đã bị vô hiệu hoá (middleware/auth.js)
   *   NOT_IN_DEPARTMENT (403)   - phiếu không thuộc đơn vị của cán bộ (services/assignmentService.js)
   *   NOT_ASSIGNEE (403)        - cán bộ chưa nhận việc / phiếu đang do cán bộ khác phụ trách
   *   EMAIL_NOT_CONFIGURED (503)- máy chủ chưa cấu hình SMTP nên không gửi được thư (services/reportService.js)
   *   EMAIL_SEND_FAILED (502)   - máy chủ thư từ chối hoặc không kết nối được, không thư nào đi
   *   NO_RECIPIENTS (409)       - không có quản trị viên nào đang hoạt động để nhận báo cáo
   */
  static badRequestWithCode(message, code) {
    const error = new ApiError(400, message);
    error.code = code;
    return error;
  }

  /** Xung đột với dữ liệu đã có (409), kèm mã máy đọc được như badRequestWithCode. */
  static conflictWithCode(message, code) {
    const error = new ApiError(409, message);
    error.code = code;
    return error;
  }

  static unauthorized(message) {
    return new ApiError(401, message || 'Unauthorized');
  }

  static forbidden(message) {
    return new ApiError(403, message || 'Forbidden');
  }

  /** Không đủ quyền (403), kèm mã máy đọc được như badRequestWithCode. */
  static forbiddenWithCode(message, code) {
    const error = new ApiError(403, message);
    error.code = code;
    return error;
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

  /** Tính năng chưa sẵn sàng trên máy chủ (503), kèm mã máy đọc được. */
  static serviceUnavailableWithCode(message, code) {
    const error = new ApiError(503, message);
    error.code = code;
    return error;
  }

  /** Dịch vụ bên ngoài (máy chủ thư...) từ chối hoặc không trả lời (502), kèm mã. */
  static badGatewayWithCode(message, code) {
    const error = new ApiError(502, message);
    error.code = code;
    return error;
  }
}

module.exports = ApiError;
