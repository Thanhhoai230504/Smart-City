import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/app_exception.dart';
import '../../core/router/app_shell.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_states.dart';
import '../../data/models/notification.dart';
import '../../data/models/user.dart';
import '../../data/repositories/meta_repository.dart';
import '../auth/auth_controller.dart';
import 'notifications_controller.dart';

/// Loại thông báo đưa cán bộ thẳng tới cổng xử lý thay vì trang công khai.
const _staffTypes = {
  'issue_assigned',
  'sla_reminder',
  'sla_escalated',
  'issue_reopened',
  'issue_rated',
  'issue_unassigned',
};

String routeForNotification(AppNotification n, UserRole? role) {
  final id = n.issueId;
  if (id == null) return Routes.notifications;
  if (role == UserRole.staff && _staffTypes.contains(n.type)) return Routes.staffIssue(id);
  return Routes.issue(id);
}

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final state = ref.watch(notificationsProvider);
    final controller = ref.read(notificationsProvider.notifier);
    final meta = ref.watch(metaProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;

    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Thông báo')),
        body: EmptyState(
          icon: Icons.notifications_none,
          title: 'Đăng nhập để nhận thông báo',
          message: 'Bạn sẽ được báo khi sự cố mình báo cáo được tiếp nhận, xử lý hoặc có bình luận.',
          actionLabel: 'Đăng nhập',
          onAction: () => context.push(Routes.login),
        ),
      );
    }

    Widget body;
    if (!state.loaded && state.loading) {
      body = const SkeletonList(count: 6, itemHeight: 72);
    } else if (state.error != null && state.items.isEmpty) {
      body = ErrorState(error: state.error!, onRetry: controller.refresh);
    } else if (state.items.isEmpty) {
      body = RefreshIndicator(
        onRefresh: controller.refresh,
        child: ListView(children: [
          SizedBox(
            height: 420,
            child: EmptyState(
              icon: Icons.notifications_off_outlined,
              title: 'Chưa có thông báo',
              message: 'Báo cáo một sự cố để theo dõi tiến độ xử lý tại đây.',
              actionLabel: user.isStaff ? null : 'Báo cáo sự cố',
              onAction: user.isStaff ? null : () => context.push(Routes.report),
            ),
          ),
        ]),
      );
    } else {
      body = NotificationListener<ScrollNotification>(
        onNotification: (n) {
          if (n.metrics.extentAfter < 400) controller.loadMore();
          return false;
        },
        child: RefreshIndicator(
          onRefresh: controller.refresh,
          child: ListView.separated(
            itemCount: state.items.length + 1,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, i) {
              if (i == state.items.length) {
                return state.loadingMore
                    ? const Padding(padding: EdgeInsets.all(Gap.lg), child: Center(child: CircularProgressIndicator()))
                    : const SizedBox(height: Gap.xxl);
              }
              final n = state.items[i];
              return Material(
                color: n.isRead ? palette.surface : Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.45),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: palette.surfaceAlt,
                    child: Icon(AppIcons.notification(n.type), color: palette.primary),
                  ),
                  title: Text(n.title, style: textTheme.titleSmall?.copyWith(
                    fontWeight: n.isRead ? FontWeight.w500 : FontWeight.w700,
                  )),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(n.message, style: textTheme.bodySmall, maxLines: 3, overflow: TextOverflow.ellipsis),
                      Gap.h4,
                      Text('${meta.notificationTypeLabel(n.type)} · ${Fmt.relative(n.createdAt)}',
                          style: textTheme.labelSmall?.copyWith(color: palette.textSecondary)),
                    ],
                  ),
                  trailing: n.isRead
                      ? null
                      : Semantics(
                          label: 'Chưa đọc',
                          child: Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(color: palette.primary, shape: BoxShape.circle),
                          ),
                        ),
                  onTap: () {
                    controller.markRead(n);
                    if (n.issueId != null) context.push(routeForNotification(n, user.role));
                  },
                ),
              );
            },
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(state.unreadCount > 0 ? 'Thông báo (${state.unreadCount})' : 'Thông báo'),
        bottom: connectivityBar(context, ref),
        actions: [
          if (state.unreadCount > 0)
            TextButton(
              onPressed: () async {
                try {
                  await controller.markAllRead();
                } on AppException catch (e) {
                  if (context.mounted) showAppSnack(context, e.message, error: true);
                }
              },
              child: const Text('Đọc tất cả'),
            ),
        ],
      ),
      body: body,
    );
  }
}
