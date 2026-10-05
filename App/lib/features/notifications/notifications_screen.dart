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
import '../../core/widgets/surfaces.dart';
import '../../data/models/issue.dart';
import '../../data/models/notification.dart';
import '../../data/models/user.dart';
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

/// Màu icon theo ý nghĩa của loại thông báo — kèm icon riêng, không chỉ màu.
ChipColors notificationTone(String type, AppPalette p, ColorScheme scheme) => switch (type) {
      'issue_resolved' || 'issue_rated' => p.success,
      'issue_rejected' || 'sla_escalated' || 'issue_reopened' => p.statusColors(IssueStatus.reported),
      'sla_reminder' || 'intake_overdue' || 'area_alert' => p.slaColors(SlaStatus.dueSoon),
      'comment' => ChipColors(p.accentInk, p.accentSoft),
      _ => ChipColors(scheme.onPrimaryContainer, scheme.primaryContainer),
    };

/// Nhóm theo ngày để quét nhanh: "Hôm nay", "Hôm qua", "Trước đó".
String notificationBucket(DateTime? at, {DateTime? now}) {
  if (at == null) return 'Trước đó';
  final today = DateUtils.dateOnly(now ?? DateTime.now());
  final day = DateUtils.dateOnly(at.toLocal());
  if (day == today) return 'Hôm nay';
  if (day == today.subtract(const Duration(days: 1))) return 'Hôm qua';
  return 'Trước đó';
}

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final state = ref.watch(notificationsProvider);
    final controller = ref.read(notificationsProvider.notifier);
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
      final scheme = Theme.of(context).colorScheme;
      body = NotificationListener<ScrollNotification>(
        onNotification: (n) {
          if (n.metrics.extentAfter < 400) controller.loadMore();
          return false;
        },
        child: RefreshIndicator(
          onRefresh: controller.refresh,
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.screen, 120),
            itemCount: state.items.length + 1,
            itemBuilder: (context, i) {
              if (i == state.items.length) {
                return state.loadingMore
                    ? const Padding(padding: EdgeInsets.all(Gap.lg), child: Center(child: CircularProgressIndicator()))
                    : const SizedBox(height: Gap.xxl);
              }
              final n = state.items[i];
              final bucket = notificationBucket(n.createdAt);
              final showHeader = i == 0 || notificationBucket(state.items[i - 1].createdAt) != bucket;
              final tone = notificationTone(n.type, palette, scheme);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (showHeader)
                    Padding(
                      padding: EdgeInsets.only(top: i == 0 ? Gap.sm : Gap.xl, bottom: Gap.sm),
                      child: Text(bucket, style: textTheme.titleSmall?.copyWith(color: palette.textSecondary)),
                    ),
                  Padding(
                    padding: const EdgeInsets.only(bottom: Gap.sm),
                    child: AppCard(
                      elevated: !n.isRead,
                      color: n.isRead ? palette.surface : Color.alphaBlend(scheme.primaryContainer.withValues(alpha: 0.35), palette.surface),
                      padding: const EdgeInsets.all(Gap.md),
                      onTap: () {
                        controller.markRead(n);
                        if (n.issueId != null) context.push(routeForNotification(n, user.role));
                      },
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          IconBubble(
                            icon: AppIcons.notification(n.type),
                            ink: tone.text,
                            container: tone.container,
                            size: 42,
                          ),
                          Gap.w12,
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  n.displayTitle,
                                  style: textTheme.titleSmall?.copyWith(
                                    fontWeight: n.isRead ? FontWeight.w500 : FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(n.message, style: textTheme.bodySmall, maxLines: 3, overflow: TextOverflow.ellipsis),
                                Gap.h4,
                                // Chỉ thời gian: nhãn loại ("Sự cố đã xử lý") lặp lại
                                // tiêu đề, còn loại đã có icon riêng ở bên trái.
                                Text(
                                  Fmt.relative(n.createdAt),
                                  style: textTheme.labelSmall?.copyWith(color: palette.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          if (!n.isRead)
                            Semantics(
                              label: 'Chưa đọc',
                              child: Container(
                                width: 10,
                                height: 10,
                                margin: const EdgeInsets.only(left: Gap.sm, top: 6),
                                decoration: BoxDecoration(color: palette.accent, shape: BoxShape.circle),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
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
