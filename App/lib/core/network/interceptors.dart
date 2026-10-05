import 'dart:async';

import 'package:dio/dio.dart';

import 'app_exception.dart';
import 'token_store.dart';

/// Cờ trong `RequestOptions.extra`.
abstract final class RequestFlags {
  /// Không gắn Bearer token (ví dụ gọi `/auth/refresh`).
  static const skipAuth = 'skipAuth';

  /// Đã thử lại một lần sau refresh — 401 lần nữa thì không refresh tiếp.
  static const retried = 'retriedAfterRefresh';
}

/// Gắn `Authorization: Bearer` và `X-App-Version`.
class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._tokens, {required this.appVersion});

  final TokenStore _tokens;
  final String appVersion;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // Backend log header này để biết còn bao nhiêu máy chạy bản cũ (task 0.8).
    options.headers['X-App-Version'] = appVersion;
    final token = _tokens.accessToken;
    if (token != null && options.extra[RequestFlags.skipAuth] != true) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }
}

/// Lấy access token mới. Bản thật gọi `POST /auth/refresh` bằng Dio **thô**
/// (không có interceptor) — gọi qua client chính sẽ đệ quy vô hạn, đúng lý do
/// web gọi bằng `axios` thô (kế hoạch mục 4.4).
abstract class TokenRefresher {
  Future<String> refresh();
}

class AuthTokenRefresher implements TokenRefresher {
  AuthTokenRefresher(this._rawDio, this._tokens);

  final Dio _rawDio;
  final TokenStore _tokens;

  @override
  Future<String> refresh() async {
    final refreshToken = await _tokens.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      throw const AppException(
        kind: AppErrorKind.unauthorized,
        statusCode: 401,
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }

    final res = await _rawDio.post<Map<String, dynamic>>(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
      options: Options(extra: {RequestFlags.skipAuth: true}),
    );
    final data = res.data?['data'];
    if (data is! Map || data['accessToken'] is! String) {
      throw const AppException(
        kind: AppErrorKind.unknown,
        message: 'Phản hồi làm mới phiên không hợp lệ.',
      );
    }

    final accessToken = data['accessToken'] as String;
    _tokens.accessToken = accessToken;
    // Rotation: token cũ đã bị thu hồi ở server, phải ghi đè ngay.
    final rotated = data['refreshToken'];
    if (rotated is String && rotated.isNotEmpty) {
      await _tokens.saveRefreshToken(rotated);
    }
    return accessToken;
  }
}

/// Port nguyên logic `Frontend/src/api/axiosClient.ts`: cờ `isRefreshing` +
/// hàng đợi `failedQueue`.
///
/// Đây **không phải tối ưu mà là điều kiện đúng đắn**: refresh token có
/// rotation, nên hai lời gọi refresh song song thì lời gọi sau cầm token đã chết
/// và nhận 401. Mọi nơi cần refresh — interceptor khi gặp 401, và bước khôi
/// phục phiên lúc mở app — đều phải đi qua MỘT bộ điều phối này. (Web từng mắc
/// đúng lỗi này giữa `useSocket` và `axiosClient`, xem G-B1.)
class RefreshCoordinator {
  RefreshCoordinator(this._refresher, {required void Function() onSessionExpired})
      : _onSessionExpired = onSessionExpired;

  final TokenRefresher _refresher;
  final void Function() _onSessionExpired;

  bool _isRefreshing = false;
  final List<Completer<String>> _failedQueue = [];

  bool get isRefreshing => _isRefreshing;

  Future<String> refresh() async {
    if (_isRefreshing) {
      final waiter = Completer<String>();
      _failedQueue.add(waiter);
      return waiter.future;
    }

    _isRefreshing = true;
    try {
      final token = await _refresher.refresh();
      _processQueue(token: token);
      return token;
    } catch (e) {
      _processQueue(error: e);
      // Chỉ đăng xuất khi server TỪ CHỐI phiên. Lỗi mạng lúc đang refresh thì
      // giữ phiên — mất sóng không được làm người dân bị đăng xuất giữa lúc
      // soạn phiếu.
      if (isRejection(e)) _onSessionExpired();
      rethrow;
    } finally {
      _isRefreshing = false;
    }
  }

  static bool isRejection(Object e) {
    if (e is AppException) return e.kind == AppErrorKind.unauthorized;
    if (e is DioException) {
      final status = e.response?.statusCode;
      return status == 401 || status == 403;
    }
    return false;
  }

  void _processQueue({String? token, Object? error}) {
    final waiters = List.of(_failedQueue);
    _failedQueue.clear();
    for (final waiter in waiters) {
      if (error != null) {
        waiter.completeError(error);
      } else {
        waiter.complete(token!);
      }
    }
  }
}

/// Gặp 401 → xin token mới qua [RefreshCoordinator] → gửi lại request đúng một
/// lần. Các request 401 đồng thời cùng chờ một lần refresh (nghiệm thu 0.4).
class RefreshInterceptor extends Interceptor {
  RefreshInterceptor({required Dio dio, required RefreshCoordinator coordinator})
      : _dio = dio,
        _coordinator = coordinator;

  final Dio _dio;
  final RefreshCoordinator _coordinator;

  /// Cùng danh sách loại trừ với web: lỗi 401 ở đây là sai mật khẩu (hay ID
  /// token Google bị từ chối), không phải token hết hạn.
  static const _authPaths = [
    '/auth/login',
    '/auth/google/id-token',
    '/auth/register',
    '/auth/refresh',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];

  bool _shouldRefresh(DioException err) {
    if (err.response?.statusCode != 401) return false;
    final options = err.requestOptions;
    if (options.extra[RequestFlags.retried] == true) return false;
    if (options.extra[RequestFlags.skipAuth] == true) return false;
    return !_authPaths.any(options.path.contains);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    if (!_shouldRefresh(err)) return handler.next(err);

    final String token;
    try {
      token = await _coordinator.refresh();
    } on DioException catch (refreshError) {
      // Lỗi mạng khi refresh → trả lỗi mạng (phiếu vào hàng đợi); server từ
      // chối → trả lỗi 401 gốc (phiên đã chết, coordinator đã báo đăng xuất).
      return handler.next(RefreshCoordinator.isRejection(refreshError) ? err : refreshError);
    } catch (_) {
      return handler.next(err);
    }

    try {
      handler.resolve(await _retry(err.requestOptions, token));
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  Future<Response<dynamic>> _retry(RequestOptions options, String token) {
    options.headers['Authorization'] = 'Bearer $token';
    options.extra[RequestFlags.retried] = true;
    // Thân multipart (ảnh báo cáo, ảnh minh chứng, ảnh gửi AI) chỉ gửi được MỘT
    // lần: lần gửi đầu dio đã "finalize" FormData, gửi lại đúng object đó thì dio
    // ném StateError ngay trên máy — lỗi không có response nên bị map thành "Không
    // có kết nối mạng" và phiếu kẹt trong hàng đợi dù mạng vẫn tốt. `clone()` dựng
    // lại thân từ cùng dữ liệu, cùng boundary; MultipartFile `fromBytes` (cách app
    // tạo ảnh) đọc lại được nhiều lần nên bản clone gửi đủ ảnh.
    final data = options.data;
    if (data is FormData) options.data = data.clone();
    return _dio.fetch<dynamic>(options);
  }
}

/// Map mọi lỗi về [AppException] nằm trong `DioException.error`. Repository
/// dùng `AppException.from(e)` để lấy ra.
class ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.error is AppException) return handler.next(err);
    handler.next(err.copyWith(error: AppException.fromDio(err)));
  }
}
