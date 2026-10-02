import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../platform/app_info.dart';
import 'interceptors.dart';
import 'token_store.dart';

/// Báo cho tầng auth biết phiên đã chết (refresh bị server từ chối). Tách ra
/// thành một kênh riêng để Dio không phải phụ thuộc vào AuthController (sẽ
/// thành vòng: AuthController cần Dio để gọi API).
class SessionExpiryBus {
  final _controller = StreamController<void>.broadcast();

  Stream<void> get stream => _controller.stream;

  void emit() => _controller.add(null);

  Future<void> dispose() => _controller.close();
}

/// Dio chính + bộ điều phối refresh dùng chung.
class ApiClient {
  ApiClient._(this.dio, this.refreshCoordinator);

  final Dio dio;
  final RefreshCoordinator refreshCoordinator;

  /// [adapter] để test thay tầng HTTP; [refresher] để test thay việc gọi
  /// `/auth/refresh`.
  factory ApiClient.build({
    required String baseUrl,
    required TokenStore tokens,
    required String appVersion,
    required void Function() onSessionExpired,
    TokenRefresher? refresher,
    HttpClientAdapter? adapter,
  }) {
    BaseOptions options() => BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 30),
          sendTimeout: const Duration(seconds: 30),
          headers: {'Accept': 'application/json'},
        );

    final dio = Dio(options());
    // Dio thô cho /auth/refresh: KHÔNG có interceptor để tránh đệ quy.
    final rawDio = Dio(options());
    if (adapter != null) {
      dio.httpClientAdapter = adapter;
      rawDio.httpClientAdapter = adapter;
    }

    final coordinator = RefreshCoordinator(
      refresher ?? AuthTokenRefresher(rawDio, tokens),
      onSessionExpired: onSessionExpired,
    );

    dio.interceptors.addAll([
      AuthInterceptor(tokens, appVersion: appVersion),
      // Refresh phải đứng TRƯỚC ErrorInterceptor: khi refresh + retry thành
      // công thì lỗi 401 không bao giờ tới tầng map lỗi.
      RefreshInterceptor(dio: dio, coordinator: coordinator),
      ErrorInterceptor(),
    ]);
    return ApiClient._(dio, coordinator);
  }
}

final secureStoreProvider = Provider<SecureStore>((ref) => FlutterSecureStore());

final tokenStoreProvider = Provider<TokenStore>(
  (ref) => TokenStore(ref.watch(secureStoreProvider)),
);

final sessionExpiryBusProvider = Provider<SessionExpiryBus>((ref) {
  final bus = SessionExpiryBus();
  ref.onDispose(bus.dispose);
  return bus;
});

final apiClientProvider = Provider<ApiClient>((ref) {
  final bus = ref.watch(sessionExpiryBusProvider);
  return ApiClient.build(
    baseUrl: AppConfig.apiUrl,
    tokens: ref.watch(tokenStoreProvider),
    appVersion: ref.watch(appInfoProvider).version,
    onSessionExpired: bus.emit,
  );
});

final apiDioProvider = Provider<Dio>((ref) => ref.watch(apiClientProvider).dio);
