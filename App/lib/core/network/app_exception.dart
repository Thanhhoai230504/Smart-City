import 'package:dio/dio.dart';

/// Loại lỗi để màn hình chọn cách hiển thị (mục 6.5 design system: mỗi màn có
/// trạng thái error và offline riêng).
enum AppErrorKind {
  /// Không có kết nối / DNS / socket đóng — phiếu báo cáo phải vào hàng đợi.
  network,
  timeout,
  cancelled,

  /// 401 sau khi đã thử refresh — phiên hết hạn thật.
  unauthorized,
  forbidden,
  notFound,

  /// 400 — lỗi nghiệp vụ hoặc validation.
  badRequest,

  /// 429 — chạm rate limit (7 limiter, Phụ lục E.2).
  rateLimited,
  server,
  unknown,
}

/// Lỗi theo từng field, cùng shape `errors: [{field, message}]` của backend
/// (`middleware/validate.js` và `errorHandler` sau task E8).
class FieldError {
  const FieldError(this.field, this.message);

  final String field;
  final String message;

  @override
  String toString() => '$field: $message';
}

/// Lỗi thống nhất cho toàn app.
///
/// Màn hình phân nhánh theo [code] (mã máy đọc, Phụ lục E.1) — **không bao giờ
/// so khớp [message]**: message là chuỗi tiếng Việt viết cho người đọc, backend
/// đổi một chữ là mọi phép so chuỗi vỡ.
class AppException implements Exception {
  const AppException({
    required this.kind,
    required this.message,
    this.statusCode,
    this.code,
    this.fieldErrors = const [],
    this.retryAfter,
  });

  final AppErrorKind kind;
  final String message;
  final int? statusCode;
  final String? code;
  final List<FieldError> fieldErrors;

  /// Chỉ có khi [kind] là [AppErrorKind.rateLimited] và server gửi header.
  final Duration? retryAfter;

  /// Lỗi mà gửi lại sau có thể thành công — dùng cho hàng đợi offline (3.6).
  bool get isTransient =>
      kind == AppErrorKind.network ||
      kind == AppErrorKind.timeout ||
      kind == AppErrorKind.rateLimited ||
      kind == AppErrorKind.server;

  /// Lỗi ở field [field], nếu có.
  String? errorFor(String field) {
    for (final e in fieldErrors) {
      if (e.field == field) return e.message;
    }
    return null;
  }

  /// Rút [AppException] ra từ bất kỳ lỗi nào repository có thể nhận.
  static AppException from(Object error) {
    if (error is AppException) return error;
    if (error is DioException) {
      final inner = error.error;
      if (inner is AppException) return inner;
      return fromDio(error);
    }
    return const AppException(kind: AppErrorKind.unknown, message: _genericMessage);
  }

  static const _genericMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại.';

  /// Ánh xạ một [DioException] về [AppException]. Đặt ở đây (không phải trong
  /// interceptor) để test độc lập và để [from] dùng lại khi lỗi chưa đi qua
  /// interceptor (ví dụ request bằng Dio thô lúc refresh).
  static AppException fromDio(DioException e) {
    switch (e.type) {
      case DioExceptionType.cancel:
        return const AppException(
          kind: AppErrorKind.cancelled,
          message: 'Đã huỷ yêu cầu.',
        );
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return const AppException(
          kind: AppErrorKind.timeout,
          message: 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.',
        );
      case DioExceptionType.connectionError:
        return const AppException(
          kind: AppErrorKind.network,
          message: 'Không có kết nối mạng.',
        );
      case DioExceptionType.badCertificate:
        return const AppException(
          kind: AppErrorKind.network,
          message: 'Kết nối không an toàn tới máy chủ.',
        );
      case DioExceptionType.badResponse:
        return _fromResponse(e.response);
      case DioExceptionType.unknown:
        // SocketException/HttpException của dart:io rơi vào đây khi mất mạng
        // giữa chừng — coi như lỗi mạng để phiếu báo cáo vào hàng đợi.
        if (e.response != null) return _fromResponse(e.response);
        return const AppException(
          kind: AppErrorKind.network,
          message: 'Không có kết nối mạng.',
        );
    }
  }

  static AppException _fromResponse(Response<dynamic>? response) {
    final status = response?.statusCode ?? 0;
    final body = response?.data;
    String? serverMessage;
    String? code;
    var fields = const <FieldError>[];

    if (body is Map) {
      final m = body['message'];
      if (m is String && m.trim().isNotEmpty) serverMessage = m;
      final c = body['code'];
      if (c is String && c.isNotEmpty) code = c;
      final errs = body['errors'];
      if (errs is List) {
        fields = [
          for (final item in errs)
            if (item is Map && item['field'] is String)
              FieldError(
                item['field'] as String,
                item['message'] is String ? item['message'] as String : '',
              ),
        ];
      }
    }

    final kind = switch (status) {
      400 || 422 => AppErrorKind.badRequest,
      401 => AppErrorKind.unauthorized,
      403 => AppErrorKind.forbidden,
      404 => AppErrorKind.notFound,
      409 => AppErrorKind.badRequest,
      429 => AppErrorKind.rateLimited,
      >= 500 => AppErrorKind.server,
      _ => AppErrorKind.unknown,
    };

    // Một số message của backend là tiếng Anh ("Too many requests…", "Validation
    // failed"). Thay bằng câu tiếng Việt cho các trường hợp chung; message riêng
    // của nghiệp vụ (tiếng Việt) thì giữ nguyên.
    final message = switch (kind) {
      AppErrorKind.rateLimited => _isEnglish(serverMessage)
          ? 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.'
          : serverMessage!,
      AppErrorKind.server => 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.',
      AppErrorKind.badRequest when fields.isNotEmpty &&
              (serverMessage == null || serverMessage == 'Validation failed') =>
        fields.first.message,
      _ => serverMessage ?? _genericMessage,
    };

    return AppException(
      kind: kind,
      message: message,
      statusCode: status,
      code: code,
      fieldErrors: fields,
      retryAfter: kind == AppErrorKind.rateLimited
          ? _parseRetryAfter(response?.headers)
          : null,
    );
  }

  static bool _isEnglish(String? message) =>
      message == null || RegExp(r'^[\x00-\x7F]*$').hasMatch(message);

  /// express-rate-limit v7 với `standardHeaders: true` gửi `RateLimit-Reset`
  /// (giây) và `Retry-After` khi đã chạm trần.
  static Duration? _parseRetryAfter(Headers? headers) {
    if (headers == null) return null;
    for (final name in const ['retry-after', 'ratelimit-reset']) {
      final raw = headers.value(name);
      final seconds = int.tryParse(raw ?? '');
      if (seconds != null && seconds >= 0) return Duration(seconds: seconds);
    }
    return null;
  }

  @override
  String toString() =>
      'AppException($kind, ${statusCode ?? '-'}, ${code ?? '-'}): $message';
}
