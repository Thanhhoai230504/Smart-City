import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smart_city_app/core/network/api_client.dart';
import 'package:smart_city_app/core/network/token_store.dart';
import 'package:smart_city_app/core/platform/connectivity.dart';
import 'package:smart_city_app/data/local/draft_store.dart';
import 'package:smart_city_app/data/models/user.dart';
import 'package:smart_city_app/data/repositories/issue_repository.dart';
import 'package:smart_city_app/features/auth/auth_controller.dart';
import 'package:smart_city_app/features/report/offline_queue.dart';

import '../helpers/fake_http.dart';

/// Trạng thái đăng nhập do test điều khiển: bắt đầu ở "đang đọc phiên" như lúc
/// mở app, rồi chuyển sang đăng nhập / khách / đổi tài khoản theo kịch bản.
class _ScriptedAuth extends AuthController {
  @override
  AuthState build() => const AuthUnknown();

  void emit(AuthState next) => state = next;
}

AppUser _user(String id, String name) =>
    AppUser.fromJson({'_id': id, 'name': name, 'email': '$id@demo.vn', 'role': 'user'});

final _an = _user('u-an', 'Nguyễn Văn An');
final _binh = _user('u-binh', 'Trần Thị Bình');

ReportPayload _payload(String title) => ReportPayload(
      title: title,
      description: 'Mô tả $title',
      category: 'pothole',
      location: 'Hải Châu',
      latitude: 16.07,
      longitude: 108.22,
    );

/// Backend giả: token hợp lệ là `fresh-1`; ghi lại tiêu đề và header của từng
/// lần tạo phiếu. `online = false` → mọi lần tạo phiếu lỗi mạng (phiếu ở lại).
class _Backend {
  _Backend({this.refreshDelay = Duration.zero});

  final Duration refreshDelay;
  bool online = true;
  final created = <String>[];
  final uploadAuth = <Object?>[];

  late final adapter = FakeAdapter((o) {
    if (o.path == '/auth/refresh') {
      return FakeResponse(
        200,
        {'success': true, 'data': {'accessToken': 'fresh-1', 'refreshToken': 'refresh-2'}},
        delay: refreshDelay,
      );
    }
    if (o.headers['Authorization'] != 'Bearer fresh-1') {
      if (o.path == '/issues') uploadAuth.add(o.headers['Authorization']);
      return const FakeResponse(401, {'success': false, 'code': 'TOKEN_EXPIRED'});
    }
    if (o.path == '/auth/profile') {
      return FakeResponse(200, {'success': true, 'data': {'user': _an.toJson()}});
    }
    if (o.path == '/issues' && o.method == 'POST') {
      uploadAuth.add(o.headers['Authorization']);
      if (!online) throw DioException.connectionError(requestOptions: o, reason: 'offline');
      final title = (o.data as FormData).fields.firstWhere((f) => f.key == 'title').value;
      created.add(title);
      return FakeResponse(201, {
        'success': true,
        'data': {'issue': {'_id': 'srv-$title', 'title': title, 'status': 'reported'}},
      });
    }
    return const FakeResponse(404, {'success': false});
  });
}

/// Dựng đủ provider như `main()`: kho phiếu trong bộ nhớ, Dio giả, phiên giả.
ProviderContainer _app({
  required MemoryDraftStore store,
  required TokenStore tokens,
  required _Backend backend,
  _ScriptedAuth? auth,
}) {
  final container = ProviderContainer(overrides: [
    tokenStoreProvider.overrideWithValue(tokens),
    apiClientProvider.overrideWith((ref) => ApiClient.build(
          baseUrl: 'http://test/api',
          tokens: tokens,
          appVersion: '1.0.0',
          onSessionExpired: ref.read(sessionExpiryBusProvider).emit,
          adapter: backend.adapter,
        )),
    connectivityProvider.overrideWith((ref) => Stream.value(true)),
    draftStoreProvider.overrideWithValue(store),
    if (auth != null) authControllerProvider.overrideWith(() => auth),
  ]);
  addTearDown(container.dispose);
  return container;
}

/// Phiếu đã nằm sẵn trên máy (kèm 1 ảnh), [minute] quyết định thứ tự.
Future<void> _seed(MemoryDraftStore store, String title, {String? owner, int minute = 0}) => store.save(
      ReportDraft(
        id: 'd-$title',
        payload: _payload(title),
        createdAt: DateTime(2026, 10, 5, 8, minute),
        imageCount: 1,
        ownerId: owner,
      ),
      images: [Uint8List.fromList([0xFF, 0xD8, 0xFF, minute])],
    );

/// Đợi tới khi [done] đúng — các Future thật (kho, Dio giả) chạy ngoài test.
Future<void> _until(bool Function() done, {String? reason}) async {
  final deadline = DateTime.now().add(const Duration(seconds: 5));
  while (!done()) {
    if (DateTime.now().isAfter(deadline)) fail('Hết thời gian chờ: ${reason ?? ''}');
    await Future<void>.delayed(const Duration(milliseconds: 5));
  }
}

/// Đợi các lượt nạp/gửi đang dở chạy xong (không có điều kiện cụ thể để chờ).
Future<void> _idle() => Future<void>.delayed(const Duration(milliseconds: 60));

List<String> _titles(ProviderContainer c) =>
    [for (final d in c.read(offlineQueueProvider).drafts) d.payload.title];

/// Task 3.6 + phiếu có chủ: máy dùng chung (người nhà, máy demo đổi người dân ↔
/// cán bộ) không được thấy hay gửi phiếu chờ của tài khoản khác.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized(); // AppLifecycleListener của hàng đợi

  late MemoryDraftStore store;
  late TokenStore tokens;

  setUp(() async {
    store = MemoryDraftStore();
    tokens = TokenStore(MemorySecureStore())..accessToken = 'fresh-1';
    await tokens.saveRefreshToken('refresh-1');
  });

  test('đổi tài khoản trên cùng máy: danh sách / badge chỉ có phiếu của người đang đăng nhập', () async {
    await _seed(store, 'Của An', owner: _an.id, minute: 1);
    await _seed(store, 'Của Bình', owner: _binh.id, minute: 2);
    final backend = _Backend()..online = false; // để phiếu nằm lại mà xem danh sách
    final auth = _ScriptedAuth();
    final c = _app(store: store, tokens: tokens, backend: backend, auth: auth);
    final queue = c.read(offlineQueueProvider.notifier);
    await _idle();
    expect(_titles(c), isEmpty, reason: 'chưa biết ai đăng nhập thì không hiện gì');

    auth.emit(AuthSignedIn(_an));
    await _until(() => backend.uploadAuth.length == 1 && !c.read(offlineQueueProvider).flushing,
        reason: 'An đăng nhập → thử gửi phiếu của An (lỗi mạng, phiếu ở lại)');
    expect(_titles(c), ['Của An']);
    expect(c.read(offlineQueueProvider).count, 1);

    auth.emit(const AuthGuest());
    await _until(() => _titles(c).isEmpty, reason: 'đăng xuất → khách không thấy phiếu nào');
    expect(store.drafts, hasLength(2), reason: 'đăng xuất vẫn giữ phiếu trên máy');

    auth.emit(AuthSignedIn(_binh));
    await _until(() => backend.uploadAuth.length == 2 && !c.read(offlineQueueProvider).flushing);
    expect(_titles(c), ['Của Bình']);
    expect(await queue.imagesOf('d-Của An'), isEmpty, reason: 'không đọc được ảnh phiếu người khác');
    expect(await queue.imagesOf('d-Của Bình'), hasLength(1));
  });

  test('sửa / xoá chỉ tác động lên phiếu của người đang đăng nhập', () async {
    await _seed(store, 'Của An', owner: _an.id, minute: 1);
    await _seed(store, 'Của Bình', owner: _binh.id, minute: 2);
    final backend = _Backend()..online = false; // phiếu nằm lại để còn sửa / xoá
    final auth = _ScriptedAuth();
    final c = _app(store: store, tokens: tokens, backend: backend, auth: auth);
    final queue = c.read(offlineQueueProvider.notifier);

    auth.emit(AuthSignedIn(_binh));
    await _until(() => _titles(c).isNotEmpty && !c.read(offlineQueueProvider).flushing);
    final anDraft = store.drafts['d-Của An']!;

    // Phiếu của An (vd. sheet sửa còn mở từ trước khi đổi tài khoản) → không đụng tới.
    await queue.update(anDraft, _payload('Bị sửa trộm'));
    await queue.remove('d-Của An');
    expect(store.drafts['d-Của An']!.payload.title, 'Của An');

    // Phiếu của chính Bình thì xoá được như thường.
    await queue.remove('d-Của Bình');
    expect(store.drafts.keys, ['d-Của An']);
    expect(_titles(c), isEmpty);
  });

  test('vừa đăng nhập → tự gửi phiếu của CHÍNH mình, phiếu người trước vẫn nằm chờ chủ', () async {
    await _seed(store, 'Của An', owner: _an.id, minute: 1);
    await _seed(store, 'Của Bình', owner: _binh.id, minute: 2);
    final backend = _Backend();
    final auth = _ScriptedAuth();
    final c = _app(store: store, tokens: tokens, backend: backend, auth: auth);
    c.read(offlineQueueProvider);

    auth.emit(AuthSignedIn(_binh));
    await _until(() => c.read(offlineQueueProvider).lastSent.isNotEmpty);

    expect(backend.created, ['Của Bình']);
    expect(store.drafts.values.single.ownerId, _an.id);
    expect(_titles(c), isEmpty);
    expect(c.read(offlineQueueProvider).lastSent.single.title, 'Của Bình');

    // An đăng nhập lại (sau khi Bình đăng xuất) → phiếu của An mới được gửi.
    c.read(offlineQueueProvider.notifier).consumeLastSent();
    auth.emit(const AuthGuest());
    auth.emit(AuthSignedIn(_an));
    await _until(() => c.read(offlineQueueProvider).lastSent.isNotEmpty);
    expect(backend.created, ['Của Bình', 'Của An']);
    expect(store.drafts, isEmpty);
  });

  test('xoá tài khoản → xoá phiếu chờ + ảnh của tài khoản đó, không đụng phiếu người khác', () async {
    await _seed(store, 'Của An 1', owner: _an.id, minute: 1);
    await _seed(store, 'Của An 2', owner: _an.id, minute: 2);
    await _seed(store, 'Của Bình', owner: _binh.id, minute: 3);
    final backend = _Backend()..online = false;
    final auth = _ScriptedAuth();
    final c = _app(store: store, tokens: tokens, backend: backend, auth: auth);
    final queue = c.read(offlineQueueProvider.notifier);
    auth.emit(AuthSignedIn(_an));
    await _until(() => backend.uploadAuth.isNotEmpty && !c.read(offlineQueueProvider).flushing);
    expect(_titles(c), ['Của An 1', 'Của An 2']);

    await queue.purgeAccount(_an.id);

    expect(store.drafts.keys, ['d-Của Bình']);
    expect(store.imageData.keys, ['d-Của Bình'], reason: 'ảnh của phiếu bị xoá cũng xoá theo');
    expect(c.read(offlineQueueProvider).count, 0);
  });

  test('phiếu vô chủ (bản cũ) + mở app đã đăng nhập → thành phiếu của tài khoản đó', () async {
    await _seed(store, 'Phiếu cũ', minute: 1); // không có ownerId
    final backend = _Backend()..online = false;
    final auth = _ScriptedAuth();
    final c = _app(store: store, tokens: tokens, backend: backend, auth: auth);
    c.read(offlineQueueProvider);

    auth.emit(AuthSignedIn(_an));
    await _until(() => backend.uploadAuth.isNotEmpty && !c.read(offlineQueueProvider).flushing,
        reason: 'phiếu đã nhận chủ thì được gửi như phiếu của An');

    expect(_titles(c), ['Phiếu cũ']);
    expect(store.drafts['d-Phiếu cũ']?.ownerId, _an.id);
    expect(store.imageData['d-Phiếu cũ'], hasLength(1), reason: 'giao chủ giữ nguyên ảnh');
  });

  test('phiếu vô chủ (bản cũ) + mở app là khách → xoá; người đăng nhập sau không thấy, không gửi', () async {
    await _seed(store, 'Phiếu cũ', minute: 1);
    final backend = _Backend();
    final auth = _ScriptedAuth();
    final c = _app(store: store, tokens: tokens, backend: backend, auth: auth);
    c.read(offlineQueueProvider);

    auth.emit(const AuthGuest());
    await _until(() => store.drafts.isEmpty, reason: 'phiếu vô chủ bị xoá khi mở app là khách');
    expect(store.imageData, isEmpty);

    auth.emit(AuthSignedIn(_binh));
    await _idle();
    expect(backend.created, isEmpty);
    expect(_titles(c), isEmpty);
  });

  test('mở app (khôi phục phiên thật) với phiếu chờ → gửi ĐÚNG MỘT lần, sau khi có token', () async {
    // Phiên đã lưu như lúc đóng app: refresh token + hồ sơ cache; access token chỉ
    // ở RAM nên lúc mở app là chưa có.
    tokens.accessToken = null;
    await tokens.saveCachedUser(_an.encode());
    await _seed(store, 'Soạn lúc mất mạng', owner: _an.id, minute: 1);
    // Refresh chậm: hàng đợi chạy (khi hồ sơ cache vừa vào) TRƯỚC lúc có token.
    final backend = _Backend(refreshDelay: const Duration(milliseconds: 40));
    final c = _app(store: store, tokens: tokens, backend: backend);

    c.read(offlineQueueProvider); // như main(): dựng hàng đợi trước khi khôi phục phiên
    await _until(() => store.drafts.isEmpty, reason: 'phiếu chờ tự lên server khi mở app');
    await _idle();

    expect(backend.created, ['Soạn lúc mất mạng']);
    expect(backend.uploadAuth, ['Bearer fresh-1'], reason: 'không tải ảnh lên lần nào khi chưa có token');
    expect(backend.adapter.countPath('/auth/refresh'), 1, reason: 'hàng đợi nhập chung lượt refresh của bước khôi phục');
    expect(c.read(authControllerProvider), isA<AuthSignedIn>());
    expect(c.read(offlineQueueProvider).lastSent.single.title, 'Soạn lúc mất mạng');
  });
}
