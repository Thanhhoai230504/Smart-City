import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_shell.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/offline_banner.dart';
import '../../data/models/issue.dart';
import '../../data/models/user.dart';
import '../../data/repositories/issue_repository.dart';
import '../auth/auth_controller.dart';
import '../report/offline_queue.dart';

final _summaryProvider = FutureProvider.autoDispose<IssueSummary>(
  (ref) => ref.read(issueRepositoryProvider).mySummary(),
);

/// Tab Cá nhân. Khách thấy lời mời đăng nhập thay vì bị đẩy đi.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final queue = ref.watch(offlineQueueProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;

    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Cá nhân')),
        body: ListView(
          children: [
            const SizedBox(
              height: 340,
              child: EmptyState(
                icon: Icons.account_circle_outlined,
                title: 'Bạn chưa đăng nhập',
                message: 'Đăng nhập để báo cáo sự cố, theo dõi tiến độ và nhận thông báo.',
              ),
            ),
            Padding(
              padding: Gap.screenPadding,
              child: Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(onPressed: () => context.push(Routes.login), child: const Text('Đăng nhập')),
                  ),
                  Gap.h8,
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => context.push(Routes.register),
                      child: const Text('Tạo tài khoản'),
                    ),
                  ),
                ],
              ),
            ),
            Gap.h16,
            ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: const Text('Cài đặt'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push(Routes.settings),
            ),
          ],
        ),
      );
    }

    final summary = ref.watch(_summaryProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Cá nhân'), bottom: connectivityBar(context, ref)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_summaryProvider);
          await ref.read(authControllerProvider.notifier).reloadProfile();
        },
        child: ListView(
          padding: const EdgeInsets.only(bottom: Gap.xxxl),
          children: [
            Padding(
              padding: const EdgeInsets.all(Gap.screen),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: palette.primary,
                    child: Text(
                      user.name.characters.first.toUpperCase(),
                      style: textTheme.titleLarge?.copyWith(color: palette.onPrimary),
                    ),
                  ),
                  Gap.w12,
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(user.name, style: textTheme.titleLarge),
                        Text(user.email, style: textTheme.bodySmall),
                        Gap.h4,
                        Text(
                          user.isStaff
                              ? 'Cán bộ · ${user.department?.name ?? 'chưa gán đơn vị'}'
                              : user.role.label,
                          style: textTheme.labelMedium?.copyWith(color: palette.primary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (user.role == UserRole.admin)
              Padding(
                padding: Gap.screenPadding,
                child: Text(
                  'Chức năng quản trị (phân công, đơn vị, nhật ký…) dùng trên website — app phục vụ người dân '
                  'và cán bộ hiện trường.',
                  style: textTheme.bodySmall,
                ),
              ),
            Padding(
              padding: Gap.screenPadding,
              child: summary.when(
                loading: () => const SkeletonBox(height: 72),
                error: (_, _) => const SizedBox.shrink(),
                data: (s) => Row(
                  children: [
                    _Count('Đã gửi', s.total),
                    _Count('Đang xử lý', s.reported + s.processing),
                    _Count('Đã xử lý', s.resolved),
                  ],
                ),
              ),
            ),
            Gap.h12,
            const Divider(),
            ListTile(
              leading: const Icon(Icons.assignment_ind_outlined),
              title: const Text('Sự cố của tôi'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push(Routes.myIssues),
            ),
            ListTile(
              leading: PendingBadge(count: queue.count, child: const Icon(Icons.schedule_send_outlined)),
              title: const Text('Báo cáo chờ gửi'),
              subtitle: Text(queue.count == 0 ? 'Không có' : PendingBadge.describe(queue.count)),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push(Routes.pendingReports),
            ),
            ListTile(
              leading: const Icon(Icons.emoji_events_outlined),
              title: const Text('Huy hiệu & bảng xếp hạng'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push(Routes.badges),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.edit_outlined),
              title: const Text('Sửa hồ sơ & khu vực theo dõi'),
              subtitle: user.watchedDistricts.isEmpty
                  ? const Text('Chưa theo dõi khu vực nào')
                  : Text('Đang theo dõi: ${user.watchedDistricts.join(', ')}'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push(Routes.editProfile),
            ),
            if (user.isLocalAccount)
              ListTile(
                leading: const Icon(Icons.password_outlined),
                title: const Text('Đổi mật khẩu'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push(Routes.changePassword),
              ),
            ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: const Text('Cài đặt'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push(Routes.settings),
            ),
            const Divider(),
            ListTile(
              leading: Icon(Icons.logout, color: palette.error),
              title: Text('Đăng xuất', style: TextStyle(color: palette.error)),
              onTap: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Đăng xuất?'),
                    content: Text(queue.count > 0
                        ? 'Bạn còn ${queue.count} báo cáo chưa gửi. Chúng vẫn được giữ trên máy và sẽ gửi khi '
                            'bạn đăng nhập lại.'
                        : 'Chỉ đăng xuất trên thiết bị này.'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
                      FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Đăng xuất')),
                    ],
                  ),
                );
                if (ok == true) await ref.read(authControllerProvider.notifier).logout();
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _Count extends StatelessWidget {
  const _Count(this.label, this.value);

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(Gap.md),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('$value', style: Theme.of(context).textTheme.headlineSmall),
                Text(label, style: Theme.of(context).textTheme.bodySmall, textAlign: TextAlign.center),
              ],
            ),
          ),
        ),
      );
}
