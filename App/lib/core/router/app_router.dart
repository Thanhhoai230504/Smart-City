import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/auth_controller.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/register_screen.dart';
import '../../features/auth/verify_and_forgot_screens.dart';
import '../../features/home/home_screen.dart';
import '../../features/issues/issue_detail_screen.dart';
import '../../features/issues/issue_list_screen.dart';
import '../../features/map/map_screen.dart';
import '../../features/my_issues/my_issues_screen.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/profile/account_screens.dart';
import '../../features/profile/badges_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/public_info/cameras_screen.dart';
import '../../features/public_info/chatbot_screen.dart';
import '../../features/public_info/statistics_screen.dart';
import '../../features/report/pending_reports_screen.dart';
import '../../features/report/report_screen.dart';
import '../../features/settings/settings_screen.dart';
import '../../features/staff/staff_issue_screen.dart';
import '../../features/staff/work_list_screen.dart';
import '../../features/update/app_update.dart';
import 'app_shell.dart';
import 'route_guard.dart';

/// Cầu nối Riverpod → `refreshListenable` của go_router: trạng thái đăng nhập
/// hoặc yêu cầu cập nhật đổi thì chạy lại redirect.
class _RouterRefresh extends ChangeNotifier {
  _RouterRefresh(Ref ref) {
    ref.listen(authControllerProvider, (_, _) => notifyListeners());
    ref.listen(appUpdateProvider.select((u) => u.force), (_, _) => notifyListeners());
  }
}

/// Tab đầu: Trang chủ với người dân, **Công việc** với cán bộ.
class RoleHome extends ConsumerWidget {
  const RoleHome({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      ref.watch(isStaffProvider) ? const WorkListScreen() : const HomeScreen();
}

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: scheme.primary,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.location_city, size: 64, color: scheme.onPrimary),
            const SizedBox(height: 16),
            Text('Smart City Đà Nẵng',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(color: scheme.onPrimary)),
          ],
        ),
      ),
    );
  }
}

final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefresh(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: Routes.splash,
    refreshListenable: refresh,
    redirect: (context, state) => resolveRedirect(
      auth: ref.read(authControllerProvider),
      location: state.uri,
      forceUpdate: ref.read(appUpdateProvider).force,
    ),
    routes: [
      GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen()),
      GoRoute(path: Routes.forceUpdate, builder: (_, _) => const ForceUpdateScreen()),
      GoRoute(
        path: Routes.login,
        builder: (_, s) => LoginScreen(from: s.uri.queryParameters['from']),
      ),
      GoRoute(path: Routes.register, builder: (_, _) => const RegisterScreen()),
      GoRoute(
        path: Routes.verifyPending,
        builder: (_, s) => VerifyPendingScreen(
          email: s.uri.queryParameters['email'] ?? '',
          sendFailed: s.uri.queryParameters['sendFailed'] == '1',
        ),
      ),
      GoRoute(
        path: Routes.forgotPassword,
        builder: (_, s) => ForgotPasswordScreen(initialEmail: s.uri.queryParameters['email']),
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => AppShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: Routes.home, builder: (_, _) => const RoleHome())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.map, builder: (_, _) => const MapScreen())]),
          StatefulShellBranch(
            routes: [GoRoute(path: Routes.notifications, builder: (_, _) => const NotificationsScreen())],
          ),
          StatefulShellBranch(routes: [GoRoute(path: Routes.profile, builder: (_, _) => const ProfileScreen())]),
        ],
      ),
      GoRoute(
        path: Routes.report,
        parentNavigatorKey: _rootKey,
        pageBuilder: (_, s) => MaterialPage(key: s.pageKey, fullscreenDialog: true, child: const ReportScreen()),
      ),
      GoRoute(path: Routes.pendingReports, builder: (_, _) => const PendingReportsScreen()),
      GoRoute(path: Routes.myIssues, builder: (_, _) => const MyIssuesScreen()),
      GoRoute(
        path: Routes.issues,
        builder: (_, _) => const IssueListScreen(),
        routes: [
          GoRoute(path: ':id', builder: (_, s) => IssueDetailScreen(issueId: s.pathParameters['id']!)),
        ],
      ),
      GoRoute(
        path: '${Routes.staffPrefix}/issues/:id',
        builder: (_, s) => StaffIssueScreen(issueId: s.pathParameters['id']!),
      ),
      GoRoute(path: Routes.statistics, builder: (_, _) => const StatisticsScreen()),
      GoRoute(path: Routes.cameras, builder: (_, _) => const CamerasScreen()),
      GoRoute(path: Routes.chatbot, builder: (_, _) => const ChatbotScreen()),
      GoRoute(path: Routes.settings, builder: (_, _) => const SettingsScreen()),
      GoRoute(path: Routes.badges, builder: (_, _) => const BadgesScreen()),
      GoRoute(path: Routes.editProfile, builder: (_, _) => const EditProfileScreen()),
      GoRoute(path: Routes.changePassword, builder: (_, _) => const ChangePasswordScreen()),
      GoRoute(path: Routes.deleteAccount, builder: (_, _) => const DeleteAccountScreen()),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(title: const Text('Không tìm thấy trang')),
      body: Center(
        child: TextButton(onPressed: () => context.go(Routes.home), child: const Text('Về trang chủ')),
      ),
    ),
  );
});
