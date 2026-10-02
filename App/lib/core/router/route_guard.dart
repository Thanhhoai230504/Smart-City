import '../../data/models/user.dart';
import '../../features/auth/auth_controller.dart';

/// Đường dẫn của app.
abstract final class Routes {
  static const splash = '/splash';
  static const forceUpdate = '/force-update';

  static const login = '/login';
  static const register = '/register';
  static const verifyPending = '/verify-pending';
  static const forgotPassword = '/forgot-password';

  // Bốn tab của shell (tab giữa "Báo cáo" mở wizard, không phải tab).
  static const home = '/home';
  static const map = '/map';
  static const notifications = '/notifications';
  static const profile = '/profile';

  static const report = '/report';
  static const pendingReports = '/pending-reports';
  static const myIssues = '/my-issues';
  static const issues = '/issues';
  static String issue(String id) => '/issues/$id';

  static const statistics = '/statistics';
  static const cameras = '/cameras';
  static const chatbot = '/chatbot';
  static const settings = '/settings';
  static const badges = '/badges';
  static const editProfile = '/profile/edit';
  static const changePassword = '/profile/password';
  static const deleteAccount = '/profile/delete';

  /// Cổng cán bộ — chỉ vai `staff`.
  static const staffPrefix = '/staff';
  static String staffIssue(String id) => '/staff/issues/$id';
}

const _publicPrefixes = <String>[
  Routes.home,
  Routes.map,
  Routes.notifications, // màn tự hiện lời mời đăng nhập khi là khách
  Routes.profile, // như trên — nhưng các route con /profile/* cần đăng nhập
  Routes.issues,
  Routes.statistics,
  Routes.cameras,
  Routes.chatbot,
  Routes.settings,
];

const _authScreens = <String>[
  Routes.login,
  Routes.register,
  Routes.verifyPending,
  Routes.forgotPassword,
];

bool _matches(String path, String prefix) =>
    path == prefix || path.startsWith('$prefix/');

/// Hàm thuần — mirror `hocs/ProtectedRoute.tsx` (prop `roles`) của web, test
/// được không cần dựng router (nghiệm thu 1.7).
///
/// Trả `null` nghĩa là cho đi tiếp.
String? resolveRedirect({
  required AuthState auth,
  required Uri location,
  bool forceUpdate = false,
}) {
  final path = location.path;

  if (forceUpdate) return path == Routes.forceUpdate ? null : Routes.forceUpdate;
  if (path == Routes.forceUpdate) return Routes.home;

  if (auth is AuthUnknown) return path == Routes.splash ? null : Routes.splash;

  final signedIn = auth is AuthSignedIn;
  final role = signedIn ? auth.user.role : null;

  if (path == Routes.splash || path == '/') return Routes.home;

  if (_authScreens.any((p) => _matches(path, p))) {
    // Vừa đăng nhập xong: router chạy lại redirect NGAY khi trạng thái auth đổi,
    // trước khi màn đăng nhập kịp tự điều hướng — nên phải tôn trọng `?from=` ở
    // đây, nếu không người dân bấm "Báo cáo" → đăng nhập → bị đưa về Trang chủ.
    return signedIn ? safeReturnPath(location.queryParameters['from']) : null;
  }

  if (!signedIn) {
    final isPublic = _publicPrefixes.any((p) => _matches(path, p)) &&
        !path.startsWith('${Routes.profile}/');
    if (isPublic) return null;
    return Uri(path: Routes.login, queryParameters: {'from': location.toString()}).toString();
  }

  // Cổng cán bộ: chỉ `staff`. Admin dùng web (kế hoạch 1.3) và không có đơn vị
  // nên không nhận việc được.
  if (_matches(path, Routes.staffPrefix) && role != UserRole.staff) {
    return Routes.home;
  }
  return null;
}

/// Chỉ nhận đường dẫn nội bộ cho `?from=` — không cho chuyển tới URL lạ.
String safeReturnPath(String? from) {
  if (from == null || !from.startsWith('/') || from.startsWith('//')) return Routes.home;
  if (_authScreens.any((p) => _matches(Uri.parse(from).path, p))) return Routes.home;
  return from;
}
