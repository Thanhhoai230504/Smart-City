import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smart_city_app/core/network/app_exception.dart';

import '../../helpers/fixtures.dart';

DioException _bad(int status, Object? body, {Map<String, List<String>> headers = const {}}) {
  final options = RequestOptions(path: '/x');
  return DioException.badResponse(
    statusCode: status,
    requestOptions: options,
    response: Response<dynamic>(
      requestOptions: options,
      statusCode: status,
      data: body,
      headers: Headers.fromMap(headers),
    ),
  );
}

/// App phân nhánh theo `code`, **không so chuỗi** message (Phụ lục E.1).
void main() {
  test('mã nghiệp vụ lấy thẳng từ response thật', () {
    expect(AppException.from(_bad(400, fixture('error_reject_reason_required'))).code,
        'REJECT_REASON_REQUIRED');
    expect(AppException.from(_bad(400, fixture('error_invalid_transition'))).code,
        'INVALID_STATUS_TRANSITION');
    final reopen = AppException.from(_bad(403, fixture('error_reopen_not_reporter')));
    expect(reopen.code, 'NOT_REPORTER');
    expect(reopen.kind, AppErrorKind.forbidden);
  });

  test('lỗi validation map vào từng field, message chung đổi sang câu tiếng Việt của field đầu', () {
    final e = AppException.from(_bad(400, fixture('error_validation')));
    expect(e.kind, AppErrorKind.badRequest);
    expect(e.errorFor('email'), isNotNull);
    expect(e.errorFor('password'), isNotNull);
    expect(e.message, isNot('Validation failed'));
  });

  test('401 đăng nhập sai không có code', () {
    final e = AppException.from(_bad(401, fixture('error_login_wrong_password')));
    expect(e.kind, AppErrorKind.unauthorized);
    expect(e.code, isNull);
  });

  test('429: đọc Retry-After, đổi message tiếng Anh sang tiếng Việt', () {
    final e = AppException.from(_bad(
      429,
      {'success': false, 'message': 'Too many requests, please try again later.'},
      headers: {'retry-after': ['600']},
    ));
    expect(e.kind, AppErrorKind.rateLimited);
    expect(e.retryAfter, const Duration(minutes: 10));
    expect(e.message, contains('thử lại'));
    expect(e.isTransient, isTrue);
  });

  test('429 của createIssueLimiter giữ nguyên message tiếng Việt', () {
    final e = AppException.from(_bad(429, {
      'success': false,
      'message': 'Bạn đã gửi quá nhiều báo cáo trong thời gian ngắn. Vui lòng thử lại sau.',
    }));
    expect(e.message, startsWith('Bạn đã gửi quá nhiều báo cáo'));
  });

  test('mất mạng / timeout là lỗi tạm thời → phiếu vào hàng đợi', () {
    final o = RequestOptions(path: '/issues');
    expect(AppException.from(DioException.connectionError(requestOptions: o, reason: 'x')).kind,
        AppErrorKind.network);
    expect(AppException.from(DioException.receiveTimeout(timeout: Duration.zero, requestOptions: o)).kind,
        AppErrorKind.timeout);
    expect(AppException.from(DioException.connectionError(requestOptions: o, reason: 'x')).isTransient, isTrue);
    expect(AppException.from(_bad(400, {'message': 'x'})).isTransient, isFalse);
  });

  test('5xx không lộ chi tiết hạ tầng', () {
    final e = AppException.from(_bad(500, {'message': 'MongoServerError: connection to 10.0.0.3 closed'}));
    expect(e.kind, AppErrorKind.server);
    expect(e.message, isNot(contains('10.0.0.3')));
  });
}
