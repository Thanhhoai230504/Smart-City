import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smart_city_app/core/network/api_client.dart';
import 'package:smart_city_app/core/network/app_exception.dart';
import 'package:smart_city_app/core/network/token_store.dart';
import 'package:smart_city_app/data/repositories/issue_repository.dart';

import '../../helpers/fake_http.dart';

/// [needle] có nằm liền một khối trong [haystack] không.
bool _containsBytes(List<int> haystack, List<int> needle) {
  for (var i = 0; i + needle.length <= haystack.length; i++) {
    var j = 0;
    while (j < needle.length && haystack[i + j] == needle[j]) {
      j++;
    }
    if (j == needle.length) return true;
  }
  return false;
}

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

  test('401 ở /auth/google/id-token là token Google bị từ chối — không refresh, không đá phiên', () async {
    final adapter = FakeAdapter(
      (o) => const FakeResponse(401, {'success': false, 'code': 'GOOGLE_TOKEN_INVALID'}),
    );
    final dio = build(adapter).dio;

    await expectLater(dio.post<Object?>('/auth/google/id-token', data: {}), throwsA(isA<DioException>()));
    expect(adapter.countPath('/auth/refresh'), 0);
    expect(sessionExpired, 0);
    expect(await tokens.readRefreshToken(), 'refresh-1');
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

  /// Hồi quy: thân multipart (FormData) chỉ gửi được một lần — trước đây lần gửi
  /// lại sau refresh ném StateError ngay trên máy, bị map thành "Không có kết nối
  /// mạng", phiếu báo cáo kẹt trong hàng đợi và cán bộ không tải được ảnh minh chứng.
  group('ảnh (multipart) gặp 401 → refresh → gửi lại', () {
    final photo = Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x7F]);
    const payload = ReportPayload(
      title: 'Ổ gà trước chợ Hàn',
      description: 'Ổ gà sâu khoảng 20cm',
      category: 'pothole',
      location: 'Bạch Đằng, Hải Châu',
      latitude: 16.07,
      longitude: 108.22,
    );

    /// Server giả: token hợp lệ là `fresh-1`; tạo phiếu trả phiếu mới. Ghi lại
    /// header `Authorization` của từng lần tạo phiếu ngay lúc gửi — lần gửi lại
    /// dùng lại (và sửa tại chỗ) chính RequestOptions của lần đầu.
    (FakeAdapter, List<Object?>) server() {
      final auth = <Object?>[];
      final adapter = FakeAdapter(
        (o) {
          if (o.path == '/auth/refresh') {
            return const FakeResponse(
              200,
              {'success': true, 'data': {'accessToken': 'fresh-1', 'refreshToken': 'refresh-2'}},
            );
          }
          if (o.path == '/issues') auth.add(o.headers['Authorization']);
          if (o.headers['Authorization'] != 'Bearer fresh-1') {
            return const FakeResponse(401, {'success': false, 'message': 'Token expired.', 'code': 'TOKEN_EXPIRED'});
          }
          return const FakeResponse(
            201,
            {'success': true, 'data': {'issue': {'_id': 'issue-moi', 'title': 'Ổ gà trước chợ Hàn', 'status': 'reported'}}},
          );
        },
        captureBodies: true,
      );
      return (adapter, auth);
    }

    /// Chỉ số các lần gọi tới [path] trong `adapter.requests`.
    List<int> callsTo(FakeAdapter adapter, String path) =>
        [for (var i = 0; i < adapter.requests.length; i++) if (adapter.requests[i].path == path) i];

    void expectPhotoDelivered(FakeAdapter adapter) {
      final uploads = callsTo(adapter, '/issues');
      expect(uploads, hasLength(2), reason: 'lần đầu 401, lần gửi lại phải tới được server');
      final body = adapter.bodies[uploads.last];
      expect(_containsBytes(body, photo), isTrue, reason: 'đủ byte ảnh trong lần gửi lại');
      final text = utf8.decode(body, allowMalformed: true);
      expect(text, contains('name="images"; filename="photo.jpg"'));
      expect(text, contains('Ổ gà trước chợ Hàn'), reason: 'các trường của phiếu đi cùng');
      expect(adapter.countPath('/auth/refresh'), 1);
      expect(sessionExpired, 0);
    }

    test('access token hết hạn (sau 15 phút) → tạo phiếu thành công, server nhận lại đủ ảnh', () async {
      final (adapter, auth) = server();

      final issue = await IssueRepository(build(adapter).dio).create(payload, [UploadImage(photo)]);

      expect(issue.id, 'issue-moi');
      expect(auth, ['Bearer expired-access', 'Bearer fresh-1']);
      expectPhotoDelivered(adapter);
    });

    test('mở app: access token chưa có trong RAM → refresh rồi gửi lại, không báo "mất mạng"', () async {
      tokens.accessToken = null;
      final (adapter, auth) = server();

      final issue = await IssueRepository(build(adapter).dio).create(payload, [UploadImage(photo)]);

      expect(issue.id, 'issue-moi');
      expect(auth, [null, 'Bearer fresh-1']);
      expectPhotoDelivered(adapter);
    });

    test('ảnh minh chứng của cán bộ đi cùng đường → cũng gửi lại được', () async {
      final adapter = FakeAdapter(
        (o) => switch (o.path) {
          '/auth/refresh' => const FakeResponse(
              200,
              {'success': true, 'data': {'accessToken': 'fresh-1', 'refreshToken': 'refresh-2'}},
            ),
          _ when o.headers['Authorization'] != 'Bearer fresh-1' =>
            const FakeResponse(401, {'success': false, 'code': 'TOKEN_EXPIRED'}),
          _ => const FakeResponse(200, {
              'success': true,
              'data': {
                'resolutionImages': [
                  {'url': 'https://res.cloudinary.com/demo/after.jpg', 'publicId': 'after'},
                ],
              },
            }),
        },
        captureBodies: true,
      );

      final images = await IssueRepository(build(adapter).dio)
          .uploadResolutionImages('issue-1', [UploadImage(photo, filename: 'photo_1.jpg')]);

      expect(images.single.url, 'https://res.cloudinary.com/demo/after.jpg');
      final uploads = callsTo(adapter, '/issues/issue-1/resolution-images');
      expect(uploads, hasLength(2));
      expect(_containsBytes(adapter.bodies[uploads.last], photo), isTrue);
    });

    test('đối chứng: request JSON vẫn gửi lại đúng thân sau refresh', () async {
      final adapter = FakeAdapter(
        (o) => o.path == '/auth/refresh'
            ? const FakeResponse(200, {'success': true, 'data': {'accessToken': 'fresh-1', 'refreshToken': 'refresh-2'}})
            : o.headers['Authorization'] != 'Bearer fresh-1'
                ? const FakeResponse(401, {'success': false, 'code': 'TOKEN_EXPIRED'})
                : const FakeResponse(200, {'success': true, 'data': {'issue': {'_id': 'x', 'title': 'Tiêu đề mới'}}}),
        captureBodies: true,
      );

      final issue = await IssueRepository(build(adapter).dio)
          .updateMine('x', title: 'Tiêu đề mới', description: 'Mô tả mới');

      expect(issue.title, 'Tiêu đề mới');
      final puts = callsTo(adapter, '/issues/x/my');
      expect(puts, hasLength(2));
      expect(jsonDecode(utf8.decode(adapter.bodies[puts.last])), {'title': 'Tiêu đề mới', 'description': 'Mô tả mới'});
    });
  });
}
