import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smart_city_app/core/config/app_config.dart';
import 'package:smart_city_app/core/router/route_guard.dart';
import 'package:smart_city_app/data/models/common.dart';
import 'package:smart_city_app/data/models/user.dart';
import 'package:smart_city_app/features/auth/auth_controller.dart';

AppUser _user(UserRole role) => AppUser(
      id: 'u1',
      name: 'A',
      email: 'a@demo.vn',
      role: role,
      department: role == UserRole.staff ? const DepartmentRef(id: 'd1') : null,
    );

String? _go(AuthState auth, String path, {bool force = false}) =>
    resolveRedirect(auth: auth, location: Uri.parse(path), forceUpdate: force);

/// Nghiệm thu 1.7: `user` vào route cán bộ → bị đẩy về home. Mirror
/// `hocs/ProtectedRoute.tsx` của web.
void main() {
  const guest = AuthGuest();
  final citizen = AuthSignedIn(_user(UserRole.user));
  final staff = AuthSignedIn(_user(UserRole.staff));
  final admin = AuthSignedIn(_user(UserRole.admin));

  test('đang đọc phiên → giữ ở splash', () {
    expect(_go(const AuthUnknown(), Routes.home), Routes.splash);
    expect(_go(const AuthUnknown(), Routes.splash), isNull);
  });

  test('người dân vào cổng cán bộ → về home', () {
    expect(_go(citizen, Routes.staffIssue('abc')), Routes.home);
  });

  test('admin cũng không vào cổng cán bộ trên app (admin dùng web, không có đơn vị)', () {
    expect(_go(admin, Routes.staffIssue('abc')), Routes.home);
  });

  test('cán bộ vào được cổng cán bộ', () {
    expect(_go(staff, Routes.staffIssue('abc')), isNull);
  });

  test('khách xem được dữ liệu công khai', () {
    for (final p in [Routes.home, Routes.map, Routes.issues, Routes.issue('x'), Routes.statistics, Routes.cameras]) {
      expect(_go(guest, p), isNull, reason: p);
    }
  });

  test('khách bấm Báo cáo → đăng nhập, kèm đường quay lại', () {
    final target = _go(guest, Routes.report)!;
    expect(Uri.parse(target).path, Routes.login);
    expect(Uri.parse(target).queryParameters['from'], Routes.report);
  });

  test('khách vào route con của hồ sơ → đăng nhập; tab Cá nhân thì vẫn mở (hiện lời mời)', () {
    expect(Uri.parse(_go(guest, Routes.changePassword)!).path, Routes.login);
    expect(_go(guest, Routes.profile), isNull);
  });

  test('đã đăng nhập mà mở màn đăng nhập → về home', () {
    expect(_go(citizen, Routes.login), Routes.home);
    expect(_go(citizen, Routes.splash), Routes.home);
  });

  test('vừa đăng nhập xong → quay lại đúng nơi định tới (?from=), đã lọc', () {
    expect(_go(citizen, '${Routes.login}?from=%2Freport'), Routes.report);
    expect(_go(citizen, '${Routes.login}?from=https%3A%2F%2Fevil.com'), Routes.home);
  });

  test('buộc cập nhật (0.8) chặn mọi route', () {
    expect(_go(citizen, Routes.home, force: true), Routes.forceUpdate);
    expect(_go(guest, Routes.forceUpdate, force: true), isNull);
    expect(_go(citizen, Routes.forceUpdate), Routes.home);
  });

  test('?from= chỉ nhận đường dẫn nội bộ', () {
    expect(safeReturnPath('/issues/1'), '/issues/1');
    expect(safeReturnPath('https://evil.com'), Routes.home);
    expect(safeReturnPath('//evil.com/x'), Routes.home);
    expect(safeReturnPath(Routes.login), Routes.home);
    expect(safeReturnPath(null), Routes.home);
  });

  group('API_URL (task 0.3)', () {
    test('Android emulator dùng 10.0.2.2 — localhost trỏ vào chính emulator', () {
      expect(
        AppConfig.resolveApiUrl(defined: '', platform: TargetPlatform.android, isWeb: false),
        'http://10.0.2.2:5000/api',
      );
    });

    test('iOS simulator / web dùng localhost', () {
      expect(AppConfig.resolveApiUrl(defined: '', platform: TargetPlatform.iOS, isWeb: false),
          'http://localhost:5000/api');
      expect(AppConfig.resolveApiUrl(defined: '', platform: TargetPlatform.android, isWeb: true),
          'http://localhost:5000/api');
    });

    test('--dart-define thắng mọi mặc định, bỏ dấu / thừa', () {
      expect(
        AppConfig.resolveApiUrl(defined: 'https://x.onrender.com/api/', platform: TargetPlatform.android, isWeb: false),
        'https://x.onrender.com/api',
      );
      expect(AppConfig.originOf('https://x.onrender.com/api'), 'https://x.onrender.com');
    });
  });
}
