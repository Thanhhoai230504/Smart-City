import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smart_city_app/core/network/api_client.dart';
import 'package:smart_city_app/core/network/app_exception.dart';
import 'package:smart_city_app/core/network/token_store.dart';

import '../../helpers/fake_http.dart';

/// Nghiệm thu task 0.4: "3 request 401 đồng thời → **chỉ 1** lần gọi refresh,
/// cả 3 được retry". Refresh có rotation nên refresh song song = một lời gọi
/// cầm token đã chết.
void main() {
  late TokenStore tokens;
  late MemorySecureStore secure;
  late int sessionExpired;

  setUp(() async {
    secure = MemorySecureStore();
    tokens = TokenStore(secure)..accessToken = 'expired-access';
    await tokens.saveRefreshToken('refresh-1');
    sessionExpired = 0;
  });

  ApiClient build(FakeAdapter adapter) => ApiClient.build(
        baseUrl: 'http://test/api',
        tokens: tokens,
        appVersion: '1.0.0',
        onSessionExpired: () => sessionExpired++,
        adapter: adapter,
      );

  /// Server giả: access token hợp lệ là `fresh-N`; refresh xoay token.
  FakeAdapter rotatingServer({Duration refreshDelay = const Duration(milliseconds: 30)}) {
    var generation = 0;
    var validRefresh = 'refresh-1';
    return FakeAdapter((o) {
      if (o.path == '/auth/refresh') {
        final body = o.data as Map;
        if (body['refreshToken'] != validRefresh) {
          return const FakeResponse(401, {'success': false, 'message': 'Invalid refresh token.'});
        }
        generation++;
        validRefresh = 'refresh-${generation + 1}';
        return FakeResponse(
          200,
          {'success': true, 'data': {'accessToken': 'fresh-$generation', 'refreshToken': validRefresh}},
          delay: refreshDelay,
        );
      }
      final auth = o.headers['Authorization'];
      if (auth is String && auth.startsWith('Bearer fresh-')) {
        return FakeResponse(200, {'success': true, 'data': {'path': o.path}});
      }
      return const FakeResponse(
        401,
        {'success': false, 'message': 'Token expired.', 'code': 'TOKEN_EXPIRED'},
      );
    });
  }

  test('3 request 401 đồng thời → đúng 1 lần refresh, cả 3 được retry thành công', () async {
    final adapter = rotatingServer();
    final dio = build(adapter).dio;

    final results = await Future.wait([
      dio.get<Object?>('/a'),
      dio.get<Object?>('/b'),
      dio.get<Object?>('/c'),
    ]);

    expect(adapter.countPath('/auth/refresh'), 1);
    expect(results.map((r) => r.statusCode), everyElement(200));
    expect(tokens.accessToken, 'fresh-1');
    // Rotation: refresh token mới phải được lưu ngay.
    expect(await tokens.readRefreshToken(), 'refresh-2');
    expect(sessionExpired, 0);
    // Mỗi request: 1 lần 401 + 1 lần retry.
    expect(adapter.countPath('/a'), 2);
  });

  test('refresh khởi động (RefreshCoordinator) chạy song song với interceptor vẫn chỉ refresh 1 lần', () async {
    final adapter = rotatingServer(refreshDelay: const Duration(milliseconds: 50));
    final client = build(adapter);

    final results = await Future.wait<Object?>([
      client.refreshCoordinator.refresh(),
      client.dio.get<Object?>('/profile'),
    ]);

    expect(adapter.countPath('/auth/refresh'), 1);
    expect(results.first, 'fresh-1');
    expect(sessionExpired, 0);
  });

  test('server từ chối refresh → báo phiên hết hạn đúng 1 lần, trả lỗi 401 gốc', () async {
    await tokens.saveRefreshToken('revoked');
    final adapter = rotatingServer();
    final dio = build(adapter).dio;

    final errors = await Future.wait([
      dio.get<Object?>('/a').then<Object?>((_) => null, onError: (Object e) => e),
      dio.get<Object?>('/b').then<Object?>((_) => null, onError: (Object e) => e),
    ]);

    expect(adapter.countPath('/auth/refresh'), 1);
    expect(sessionExpired, 1);
    for (final e in errors) {
      expect(AppException.from(e!).kind, AppErrorKind.unauthorized);
    }
  });

  test('mất mạng lúc refresh → KHÔNG đăng xuất (giữ phiên khi đang soạn phiếu offline)', () async {
    var refreshCalls = 0;
    final adapter = FakeAdapter((o) {
      if (o.path == '/auth/refresh') {
        refreshCalls++;
        throw DioException.connectionError(requestOptions: o, reason: 'offline');
      }
      return const FakeResponse(401, {'success': false, 'code': 'TOKEN_EXPIRED'});
    });
    final dio = build(adapter).dio;

    final error = await dio.get<Object?>('/a').then<Object?>((_) => null, onError: (Object e) => e);

    expect(refreshCalls, 1);
    expect(sessionExpired, 0);
    expect(AppException.from(error!).kind, AppErrorKind.network);
    expect(await tokens.readRefreshToken(), 'refresh-1');
  });

  test('401 ở /auth/login là sai mật khẩu — không được refresh', () async {
    final adapter = FakeAdapter(
      (o) => const FakeResponse(401, {'success': false, 'message': 'Invalid email or password.'}),
    );
    final dio = build(adapter).dio;

    await expectLater(dio.post<Object?>('/auth/login', data: {}), throwsA(isA<DioException>()));
    expect(adapter.countPath('/auth/refresh'), 0);
  });

  test('retry sau refresh vẫn 401 → dừng, không vòng lặp refresh vô hạn', () async {
    var refreshes = 0;
    final adapter = FakeAdapter((o) {
      if (o.path == '/auth/refresh') {
        refreshes++;
        return FakeResponse(200, {'success': true, 'data': {'accessToken': 'still-bad-$refreshes', 'refreshToken': 'r$refreshes'}});
      }
      return const FakeResponse(401, {'success': false, 'message': 'User not found or account deactivated.'});
    });
    final dio = build(adapter).dio;

    await expectLater(dio.get<Object?>('/a'), throwsA(isA<DioException>()));
    expect(refreshes, 1);
  });

  test('gắn Bearer + X-App-Version vào mọi request', () async {
    tokens.accessToken = 'fresh-9';
    final adapter = FakeAdapter((o) => const FakeResponse(200, {'success': true, 'data': <String, Object?>{}}));
    await build(adapter).dio.get<Object?>('/x');

    expect(adapter.requests.single.headers['Authorization'], 'Bearer fresh-9');
    expect(adapter.requests.single.headers['X-App-Version'], '1.0.0');
  });

  test('chưa lưu refresh token (khách) → không gọi server refresh', () async {
    await secure.delete('refresh_token');
    final adapter = rotatingServer();
    final dio = build(adapter).dio;

    await expectLater(dio.get<Object?>('/issues/work'), throwsA(isA<DioException>()));
    expect(adapter.countPath('/auth/refresh'), 0);
  });
}
