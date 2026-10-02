import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/socket/socket_service.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/notifications/notifications_controller.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/report/offline_queue.dart';
import '../platform/connectivity.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import '../widgets/offline_banner.dart';
import 'route_guard.dart';

/// Mục bottom nav — **5 mục, đổi theo vai** (design system mục 5). Mục 3
/// "Báo cáo" là nút giữa nổi, không phải tab.
class NavItem {
  const NavItem(this.label, this.icon, this.selectedIcon);

  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

/// Cán bộ đổi mục 1 (Trang chủ → **Công việc**) chứ không thêm mục 6: năm là
/// trần mà nhãn còn đọc được trên màn 5.5", và giữ cơ bắp ghi nhớ cho các mục
/// còn lại.
List<NavItem> navItemsFor({required bool staff}) => [
      staff
          ? const NavItem('Công việc', Icons.assignment_outlined, Icons.assignment)
          : const NavItem('Trang chủ', Icons.home_outlined, Icons.home),
      const NavItem('Bản đồ', Icons.map_outlined, Icons.map),
      const NavItem('Thông báo', Icons.notifications_outlined, Icons.notifications),
      const NavItem('Cá nhân', Icons.person_outline, Icons.person),
    ];

class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  StreamSubscription<Object>? _incoming;

  @override
  void initState() {
    super.initState();
    // Khởi động vòng đời socket (nối khi đăng nhập + foreground).
    ref.read(socketLifecycleProvider);
    _incoming = ref.read(socketServiceProvider).incoming.listen((n) {
      if (!mounted) return;
      final role = ref.read(currentUserProvider)?.role;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(n.title.isEmpty ? n.message : '${n.title}: ${n.message}', maxLines: 3),
        action: n.issueId == null
            ? null
            : SnackBarAction(label: 'Xem', onPressed: () => context.push(routeForNotification(n, role))),
      ));
    });
  }

  @override
  void dispose() {
    _incoming?.cancel();
    super.dispose();
  }

  void _goBranch(int index) => widget.shell.goBranch(index, initialLocation: index == widget.shell.currentIndex);

  @override
  Widget build(BuildContext context) {
    final staff = ref.watch(isStaffProvider);
    final queue = ref.watch(offlineQueueProvider);
    final unread = ref.watch(unreadCountProvider);
    final items = navItemsFor(staff: staff);

    // Phiếu chờ vừa được tự gửi → báo một lần.
    ref.listen(offlineQueueProvider.select((s) => s.lastSent), (_, sent) {
      if (sent.isEmpty) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Đã tự gửi ${sent.length} báo cáo đang chờ.'),
        action: SnackBarAction(label: 'Xem', onPressed: () => context.push(Routes.myIssues)),
      ));
      ref.read(offlineQueueProvider.notifier).consumeLastSent();
    });

    Widget slot(int branch) {
      final item = items[branch];
      final selected = widget.shell.currentIndex == branch;
      Widget icon = Icon(selected ? item.selectedIcon : item.icon);
      if (branch == 2 && unread > 0) {
        icon = Badge(label: Text(unread > 99 ? '99+' : '$unread'), child: icon);
      }
      if (branch == 3 && queue.count > 0) icon = PendingBadge(count: queue.count, child: icon);
      return Expanded(
        child: _NavButton(
          label: item.label,
          icon: icon,
          selected: selected,
          semanticsLabel: branch == 2 && unread > 0 ? '${item.label}, $unread chưa đọc' : item.label,
          onTap: () => _goBranch(branch),
        ),
      );
    }

    return Scaffold(
      body: widget.shell,
      bottomNavigationBar: _BottomBar(
        children: [slot(0), slot(1), const _ReportSlot(), slot(2), slot(3)],
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Material(
      color: palette.surface,
      child: Container(
        decoration: BoxDecoration(border: Border(top: BorderSide(color: palette.border))),
        child: SafeArea(
          top: false,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 68),
            child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: children),
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
    required this.semanticsLabel,
  });

  final String label;
  final Widget icon;
  final bool selected;
  final VoidCallback onTap;
  final String semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final color = selected ? palette.primary : palette.textSecondary;
    return Semantics(
      button: true,
      selected: selected,
      label: semanticsLabel,
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        radius: 40,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: Gap.sm),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedContainer(
                duration: Motion.of(context, Motion.fast),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                decoration: BoxDecoration(
                  color: selected ? Theme.of(context).colorScheme.primaryContainer : Colors.transparent,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: IconTheme(data: IconThemeData(color: color, size: 24), child: icon),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(color: color),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// ⭐ `ReportFab` — nút giữa nổi. Đó là hành động app tồn tại để phục vụ, và vị
/// trí giữa đáy là nơi ngón cái với tới dễ nhất khi cầm một tay (design system 5).
class _ReportSlot extends StatelessWidget {
  const _ReportSlot();

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Expanded(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            button: true,
            label: 'Báo cáo sự cố',
            excludeSemantics: true,
            child: Material(
              color: palette.primary,
              shape: const CircleBorder(),
              elevation: 4,
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => context.push(Routes.report),
                child: SizedBox.square(
                  dimension: 56,
                  child: Icon(Icons.add_a_photo, color: palette.onPrimary, size: 26),
                ),
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'Báo cáo',
            maxLines: 1,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: palette.primary),
          ),
        ],
      ),
    );
  }
}

/// `AppBar.bottom` cho các tab: dải trạng thái mạng + phiếu chờ gửi, cố định
/// ngay dưới app bar (design system 6.6). `null` khi có mạng và không có phiếu chờ.
PreferredSizeWidget? connectivityBar(BuildContext context, WidgetRef ref) {
  final online = ref.watch(isOnlineProvider);
  final pending = ref.watch(offlineQueueProvider.select((s) => s.count));
  if (!OfflineBanner.isVisible(online: online, pendingCount: pending)) return null;
  return OfflineBannerBar(
    online: online,
    pendingCount: pending,
    height: OfflineBannerBar.heightFor(context),
    onTap: pending > 0 ? () => context.push(Routes.pendingReports) : null,
  );
}
