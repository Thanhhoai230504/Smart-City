import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_sign_in_platform_interface/google_sign_in_platform_interface.dart';
import 'package:smart_city_app/core/network/api_client.dart';
import 'package:smart_city_app/core/network/app_exception.dart';
import 'package:smart_city_app/core/network/token_store.dart';
import 'package:smart_city_app/core/platform/app_info.dart';
import 'package:smart_city_app/core/platform/google_sign_in_gateway.dart';
import 'package:smart_city_app/core/router/route_guard.dart';
import 'package:smart_city_app/data/repositories/auth_repository.dart';
import 'package:smart_city_app/features/auth/auth_controller.dart';
import 'package:smart_city_app/features/auth/google_sign_in.dart';
import 'package:smart_city_app/features/auth/login_screen.dart';
import 'package:smart_city_app/features/auth/register_screen.dart';

import '../helpers/app_harness.dart';
import '../helpers/fake_http.dart';
import '../helpers/fixtures.dart';

/// Gateway giả — plugin thật cần Google Play Services.
class FakeGateway implements GoogleSignInGateway {
  FakeGateway(this.result);

  final Future<String?> Function() result;
  final List<String> clientIds = [];
  int signOuts = 0;

  @override
  Future<String?> obtainIdToken({required String serverClientId}) {
    clientIds.add(serverClientId);
    return result();
  }

  @override
  Future<void> signOut() async => signOuts++;
}

/// Platform giả cho [PluginGoogleSignInGateway] — thay đúng lớp mà plugin gọi
/// xuống Credential Manager.
class FakeGooglePlatform extends GoogleSignInPlatform {
  FakeGooglePlatform(this.onAuthenticate);

  final Future<AuthenticationResults> Function() onAuthenticate;
  final List<InitParameters> inits = [];
  int signOuts = 0;

  @override
  Future<void> init(InitParameters params) async => inits.add(params);

  @override
  Future<AuthenticationResults> authenticate(AuthenticateParameters params) => onAuthenticate();

  @override
  Future<void> signOut(SignOutParams params) async => signOuts++;

  @override
  Future<AuthenticationResults?>? attemptLightweightAuthentication(AttemptLightweightAuthenticationParameters params) =>
      null;

  @override
  bool supportsAuthenticate() => true;

  @override
  bool authorizationRequiresUserInteraction() => false;

  @override
  Future<ClientAuthorizationTokenData?> clientAuthorizationTokensForScopes(
    ClientAuthorizationTokensForScopesParameters params,
  ) async =>
      null;

  @override
  Future<ServerAuthorizationTokenData?> serverAuthorizationTokensForScopes(
    ServerAuthorizationTokensForScopesParameters params,
  ) async =>
      null;

  @override
  Future<void> disconnect(DisconnectParams params) async {}
}

AuthenticationResults _signedIn(String? idToken) => AuthenticationResults(
      user: const GoogleSignInUserData(email: 'an@gmail.com', id: 'google-sub-1'),
      authenticationTokens: AuthenticationTokenData(idToken: idToken),
    );

const _clientId = 'test-web-client.apps.googleusercontent.com';

void main() {
  group('googleSignInFailure — câu báo lỗi theo kết quả Credential Manager', () {
    test('SHA-1/package chưa đăng ký (28444) → báo chưa đăng ký, bản dev kèm chi tiết', () {
      final e = googleSignInFailure(
        const GoogleSignInException(
          code: GoogleSignInExceptionCode.unknownError,
          description: '[28444] Developer console is not set up correctly.',
        ),
        withDetail: true,
      );
      expect(e.message, contains('Google chưa chấp nhận ứng dụng này'));
      expect(e.message, contains('28444'));
    });

    test('lỗi cấu hình client → cùng thông điệp; bản production không lộ chi tiết', () {
      final e = googleSignInFailure(
        const GoogleSignInException(
          code: GoogleSignInExceptionCode.clientConfigurationError,
          description: 'serverClientId must be provided on Android',
        ),
        withDetail: false,
      );
      expect(e.message, contains('Google chưa chấp nhận ứng dụng này'));
      expect(e.message, isNot(contains('serverClientId')));
      expect(e.code, 'GOOGLE_clientConfigurationError');
    });

    test('"[16] Account reauth failed" đến dưới dạng huỷ nhưng là lỗi cấu hình — không được nuốt im lặng', () {
      const reauth = GoogleSignInException(
        code: GoogleSignInExceptionCode.canceled,
        description: '[16] Account reauth failed.',
      );
      expect(isUserCancellation(reauth), isFalse);
      expect(googleSignInFailure(reauth, withDetail: false).message, contains('Google chưa chấp nhận'));

      const userClosed = GoogleSignInException(
        code: GoogleSignInExceptionCode.canceled,
        description: 'activity is cancelled by the user.',
      );
      expect(isUserCancellation(userClosed), isTrue);
    });

    test('máy chưa có tài khoản Google → hướng dẫn thêm tài khoản', () {
      final e = googleSignInFailure(
        const GoogleSignInException(
          code: GoogleSignInExceptionCode.unknownError,
          description: 'No credential available: no accounts',
        ),
        withDetail: false,
      );
      expect(e.message, contains('Thêm tài khoản'));
    });

    test('bị gián đoạn → mời thử lại', () {
      final e = googleSignInFailure(
        const GoogleSignInException(code: GoogleSignInExceptionCode.interrupted),
        withDetail: false,
      );
      expect(e.message, contains('gián đoạn'));
    });
  });

  group('googleLoginErrorMessage — phân nhánh theo code của backend', () {
    AppException err(AppErrorKind kind, [String? code]) =>
        AppException(kind: kind, message: 'server message', code: code);

    test('mỗi mã Google một câu riêng, không dùng chuỗi của server', () {
      expect(googleLoginErrorMessage(err(AppErrorKind.unauthorized, 'GOOGLE_TOKEN_INVALID')),
          contains('Google không xác nhận'));
      expect(googleLoginErrorMessage(err(AppErrorKind.unauthorized, 'GOOGLE_EMAIL_NOT_VERIFIED')),
          contains('chưa xác minh email'));
      expect(googleLoginErrorMessage(err(AppErrorKind.server, 'GOOGLE_SIGN_IN_DISABLED')),
          contains('chưa bật'));
    });

    test('tài khoản bị khoá / quá nhiều lần / mất mạng', () {
      expect(googleLoginErrorMessage(err(AppErrorKind.forbidden)), contains('vô hiệu hoá'));
      expect(googleLoginErrorMessage(err(AppErrorKind.rateLimited)), contains('quá nhiều lần'));
      expect(googleLoginErrorMessage(err(AppErrorKind.network)), contains('kết nối mạng'));
    });
  });

  group('PluginGoogleSignInGateway', () {
    late GoogleSignInPlatform original;
    setUp(() => original = GoogleSignInPlatform.instance);
    tearDown(() => GoogleSignInPlatform.instance = original);

    test('initialize đúng một lần với serverClientId, trả ID token', () async {
      final platform = FakeGooglePlatform(() async => _signedIn('id-token-1'));
      GoogleSignInPlatform.instance = platform;
      final gateway = PluginGoogleSignInGateway();

      expect(await gateway.obtainIdToken(serverClientId: _clientId), 'id-token-1');
      expect(await gateway.obtainIdToken(serverClientId: _clientId), 'id-token-1');

      expect(platform.inits, hasLength(1));
      expect(platform.inits.single.serverClientId, _clientId);
    });

    test('người dùng đóng bảng chọn → null, không phải lỗi', () async {
      GoogleSignInPlatform.instance = FakeGooglePlatform(
        () => throw const GoogleSignInException(code: GoogleSignInExceptionCode.canceled),
      );

      expect(await PluginGoogleSignInGateway().obtainIdToken(serverClientId: _clientId), isNull);
    });

    test('huỷ kiểu "[16] Account reauth failed" → báo lỗi, không trả null', () async {
      GoogleSignInPlatform.instance = FakeGooglePlatform(
        () => throw const GoogleSignInException(
          code: GoogleSignInExceptionCode.canceled,
          description: '[16] Account reauth failed.',
        ),
      );

      await expectLater(
        PluginGoogleSignInGateway().obtainIdToken(serverClientId: _clientId),
        throwsA(isA<AppException>()),
      );
    });

    test('lỗi Credential Manager → AppException có thông điệp hiển thị được', () async {
      GoogleSignInPlatform.instance = FakeGooglePlatform(
        () => throw const GoogleSignInException(
          code: GoogleSignInExceptionCode.unknownError,
          description: '[28444] Developer console is not set up correctly.',
        ),
      );

      await expectLater(
        PluginGoogleSignInGateway().obtainIdToken(serverClientId: _clientId),
        throwsA(isA<AppException>().having((e) => e.message, 'message', contains('Google chưa chấp nhận'))),
      );
    });

    test('Google không trả ID token → lỗi, không gửi chuỗi rỗng lên server', () async {
      GoogleSignInPlatform.instance = FakeGooglePlatform(() async => _signedIn(null));

      await expectLater(
        PluginGoogleSignInGateway().obtainIdToken(serverClientId: _clientId),
        throwsA(isA<AppException>()),
      );
    });

    test('signOut trước khi từng đăng nhập không gọi xuống plugin', () async {
      final platform = FakeGooglePlatform(() async => _signedIn('id-token-1'));
      GoogleSignInPlatform.instance = platform;
      final gateway = PluginGoogleSignInGateway();

      await gateway.signOut();
      expect(platform.signOuts, 0);

      await gateway.obtainIdToken(serverClientId: _clientId);
      await gateway.signOut();
      expect(platform.signOuts, 1);
    });
  });

  group('AuthRepository.loginWithGoogle', () {
    test('gửi ID token + thiết bị, lưu phiên như đăng nhập email', () async {
      final tokens = TokenStore(MemorySecureStore());
      final adapter = FakeAdapter((o) => switch (o.path) {
            '/auth/google/id-token' => FakeResponse(200, {
                'success': true,
                'data': {
                  'accessToken': 'access-1',
                  'refreshToken': 'refresh-1',
                  'user': (fixtureData('login_mobile')['user'] as Map).cast<String, dynamic>(),
                },
              }),
            _ => const FakeResponse(404, {'success': false, 'message': 'not found'}),
          });
      final client = ApiClient.build(
        baseUrl: 'http://test/api',
        tokens: tokens,
        appVersion: '1.0.0',
        onSessionExpired: () {},
        adapter: adapter,
      );
      final repo = AuthRepository(
        client.dio,
        tokens,
        const AppInfo(version: '1.0.0', buildNumber: '1', deviceType: 'android', deviceName: 'Pixel 9a'),
        client.refreshCoordinator,
      );

      final user = await repo.loginWithGoogle('id-token-1');

      final sent = adapter.requests.firstWhere((r) => r.path == '/auth/google/id-token');
      final body = sent.data is String ? jsonDecode(sent.data as String) : sent.data;
      expect(body, {'idToken': 'id-token-1', 'deviceType': 'android', 'deviceName': 'Pixel 9a'});
      expect(tokens.accessToken, 'access-1');
      expect(await tokens.readRefreshToken(), 'refresh-1');
      expect(user.email, 'nguoidan@demo.vn');
    });
  });

  group('Màn đăng nhập / đăng ký', () {
    testWidgets('máy chủ có client ID → hiện "Tiếp tục với Google" ở cả hai màn', (tester) async {
      await pumpScreen(tester, const LoginScreen());
      await settleReal(tester);
      expect(find.text('Tiếp tục với Google'), findsOneWidget);

      await pumpScreen(tester, const RegisterScreen());
      await settleReal(tester);
      expect(find.text('Tiếp tục với Google'), findsOneWidget);
    });

    testWidgets('máy chủ chưa cấu hình (hoặc không phải Android) → ẩn nút', (tester) async {
      await pumpScreen(
        tester,
        const LoginScreen(),
        overrides: [googleSignInClientIdProvider.overrideWithValue(null)],
      );
      await settleReal(tester);
      expect(find.text('Tiếp tục với Google'), findsNothing);
    });

    testWidgets('chạm → lấy token bằng client ID của máy chủ → đăng nhập → về trang chủ', (tester) async {
      final gateway = FakeGateway(() async => 'id-token-1');
      final backend = fixtureBackend();
      final container = await pumpScreen(
        tester,
        const LoginScreen(),
        backend: backend,
        overrides: [googleSignInGatewayProvider.overrideWithValue(gateway)],
      );
      await settleReal(tester);

      await tester.tap(find.text('Tiếp tục với Google'));
      await settleReal(tester);
      await settleReal(tester);

      expect(gateway.clientIds, [_clientId]);
      expect(backend.countPath('/auth/google/id-token'), 1);
      expect(container.read(authControllerProvider), isA<AuthSignedIn>());
      expect(find.text('route:${Routes.home}'), findsOneWidget);
    });

    testWidgets('đóng bảng chọn tài khoản → ở lại, không báo lỗi', (tester) async {
      final backend = fixtureBackend();
      final container = await pumpScreen(
        tester,
        const LoginScreen(),
        backend: backend,
        overrides: [googleSignInGatewayProvider.overrideWithValue(FakeGateway(() async => null))],
      );
      await settleReal(tester);

      await tester.tap(find.text('Tiếp tục với Google'));
      await settleReal(tester);

      expect(backend.countPath('/auth/google/id-token'), 0);
      expect(container.read(authControllerProvider), isA<AuthGuest>());
      expect(find.byIcon(Icons.error_outline), findsNothing);
      expect(find.text('Đăng nhập'), findsWidgets);
    });

    testWidgets('máy chủ từ chối token → thông báo theo code, vẫn ở màn đăng nhập', (tester) async {
      final fixtures = fixtureBackend();
      final backend = FakeAdapter((o) => o.path == '/auth/google/id-token'
          ? const FakeResponse(401, {
              'success': false,
              'message': 'Không xác thực được tài khoản Google. Vui lòng thử lại.',
              'code': 'GOOGLE_TOKEN_INVALID',
            })
          : fixtures.handler(o));
      await pumpScreen(
        tester,
        const LoginScreen(),
        backend: backend,
        overrides: [googleSignInGatewayProvider.overrideWithValue(FakeGateway(() async => 'bad-token'))],
      );
      await settleReal(tester);

      await tester.tap(find.text('Tiếp tục với Google'));
      await settleReal(tester);
      await settleReal(tester);

      expect(find.textContaining('Google không xác nhận được tài khoản'), findsOneWidget);
      // 401 ở endpoint đăng nhập không được coi là phiên hết hạn.
      expect(backend.countPath('/auth/refresh'), 0);
    });

    testWidgets('lỗi trên máy (chưa đăng ký SHA-1) → hiện đúng câu của gateway', (tester) async {
      await pumpScreen(
        tester,
        const LoginScreen(),
        overrides: [
          googleSignInGatewayProvider.overrideWithValue(FakeGateway(() async => throw const AppException(
                kind: AppErrorKind.unknown,
                message: 'Google chưa chấp nhận ứng dụng này. Kiểm tra OAuth client Android (package + SHA-1) trong Google Cloud.',
              ))),
        ],
      );
      await settleReal(tester);

      await tester.tap(find.text('Tiếp tục với Google'));
      await settleReal(tester);

      expect(find.textContaining('Google chưa chấp nhận ứng dụng này'), findsOneWidget);
    });
  });
}
