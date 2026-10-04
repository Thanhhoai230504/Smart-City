import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smart_city_app/core/network/api_client.dart';
import 'package:smart_city_app/core/network/token_store.dart';
import 'package:smart_city_app/core/platform/connectivity.dart';
import 'package:smart_city_app/core/storage/prefs.dart';
import 'package:smart_city_app/core/theme/app_theme.dart';
import 'package:smart_city_app/core/widgets/app_map.dart';
import 'package:smart_city_app/data/local/draft_store.dart';
import 'package:smart_city_app/data/models/user.dart';
import 'package:smart_city_app/features/auth/auth_controller.dart';
import 'package:smart_city_app/features/report/offline_queue.dart';

import 'fake_http.dart';
import 'fixtures.dart';

/// Backend giả trả fixture THẬT theo đường dẫn — widget test đi qua đủ tầng
/// repository + parse model thay vì nhét object dựng tay.
FakeAdapter fixtureBackend() {
  final guest = fixtureData('issue_detail_guest')['issue'] as Map<String, dynamic>;
  final staff = fixtureData('issue_detail_staff')['issue'] as Map<String, dynamic>;
  final rejected = fixtureData('issue_detail_rejected_reporter')['issue'] as Map<String, dynamic>;
  final details = {
    guest['_id']: 'issue_detail_guest',
    staff['_id']: 'issue_detail_staff',
    rejected['_id']: 'issue_detail_rejected_reporter',
  };

  return FakeAdapter((o) {
    final p = o.path;
    final q = o.queryParameters;
    String? name = switch (p) {
      '/statistics' => 'statistics',
      '/issues' when q['view'] == 'map' => 'issues_map',
      '/issues' => 'issues_list_guest',
      '/issues/work' => 'work_list_staff',
      '/issues/my' => 'my_issues',
      '/issues/my/summary' => 'my_summary',
      '/issues/nearby' => 'nearby',
      '/notifications' => 'notifications',
      '/meta/enums' => 'meta_enums',
      '/cameras' || '/cameras/nearby' => 'cameras',
      '/badges/me' => 'badges_me',
      '/badges/leaderboard' => 'leaderboard',
      '/app/config' => 'app_config',
      // Cùng hình dạng phản hồi với /auth/login (backend dùng chung một hàm cấp phiên).
      '/auth/google/id-token' => 'login_mobile',
      _ => null,
    };
    if (p.endsWith('/comments')) name = 'comments';
    final detailMatch = RegExp(r'^/issues/([0-9a-f]{24})$').firstMatch(p);
    if (detailMatch != null) name = details[detailMatch.group(1)] ?? 'issue_detail_guest';

    if (p == '/notifications/unread-count') {
      return const FakeResponse(200, {'success': true, 'data': {'count': 1}});
    }
    if (p == '/places') {
      return const FakeResponse(200, {'success': true, 'data': {'places': <Object>[], 'total': 0}});
    }
    if (name == null) return const FakeResponse(404, {'success': false, 'message': 'not found'});
    return FakeResponse(200, fixture(name));
  });
}

class _FakeAuth extends AuthController {
  _FakeAuth(this._state);

  final AuthState _state;

  @override
  AuthState build() => _state;
}

/// Id của "Lê Minh Cường" (canbo.giaothong@demo.vn) trong fixture `/issues/work`.
const staffDemoId = '6abf1d2e954088cb98914221';

AppUser demoUser(UserRole role) {
  final login = fixtureData('login_mobile')['user'] as Map<String, dynamic>;
  if (role == UserRole.user) return AppUser.fromJson(login);
  final staff = fixtureData('work_list_staff')['issues'] as List;
  final dept = (staff.first as Map)['departmentId'];
  return AppUser.fromJson({
    // Đúng cán bộ đang phụ trách vài phiếu trong fixture → test được "việc của tôi".
    '_id': staffDemoId,
    'name': 'Lê Minh Cường',
    'email': 'canbo.giaothong@demo.vn',
    'role': 'staff',
    'departmentId': dept,
  });
}

/// Dựng một màn trong MaterialApp có theme thật, provider giả, cỡ chữ tuỳ chọn.
Future<ProviderContainer> pumpScreen(
  WidgetTester tester,
  Widget screen, {
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  Size size = const Size(360, 720),
  AppUser? user,
  bool online = true,
  List<Override> overrides = const [],
  FakeAdapter? backend,
}) async {
  mapTilesEnabled = false;
  await initializeDateFormatting('vi');
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final tokens = TokenStore(MemorySecureStore());

  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
    tester.platformDispatcher.clearTextScaleFactorTestValue();
  });

  final container = ProviderContainer(overrides: [
    sharedPrefsProvider.overrideWithValue(prefs),
    tokenStoreProvider.overrideWithValue(tokens),
    apiClientProvider.overrideWithValue(ApiClient.build(
      baseUrl: 'http://test/api',
      tokens: tokens,
      appVersion: '1.0.0',
      onSessionExpired: () {},
      adapter: backend ?? fixtureBackend(),
    )),
    connectivityProvider.overrideWith((ref) => Stream.value(online)),
    draftStoreProvider.overrideWithValue(MemoryDraftStore()),
    authControllerProvider.overrideWith(
      () => _FakeAuth(user == null ? const AuthGuest() : AuthSignedIn(user)),
    ),
    ...overrides,
  ]);
  addTearDown(container.dispose);

  // Màn dùng go_router (`context.push`, `canPop`) nên cần một GoRouter thật;
  // điều hướng sang route khác rơi vào errorBuilder (màn giữ chỗ).
  final router = GoRouter(
    routes: [GoRoute(path: '/', builder: (_, _) => screen)],
    errorBuilder: (_, state) => Scaffold(body: Text('route:${state.uri}')),
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(UncontrolledProviderScope(
    container: container,
    child: MaterialApp.router(
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: brightness == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
      locale: const Locale('vi'),
      supportedLocales: const [Locale('vi')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      routerConfig: router,
    ),
  ));
  await settle(tester);
  return container;
}

/// Không dùng pumpAndSettle: skeleton lặp animation nên không bao giờ "settle".
Future<void> settle(WidgetTester tester, {int frames = 12}) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

/// Đợi các Future thật (đọc file fixture, Dio) chạy xong ngoài fake clock.
Future<void> settleReal(WidgetTester tester) async {
  await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
  await settle(tester);
  unawaited(Future<void>.value());
}
