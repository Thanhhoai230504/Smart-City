import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/platform/connectivity.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/offline_banner.dart';
import '../../core/widgets/surfaces.dart';
import '../../data/models/issue.dart';
import '../../data/models/user.dart';
import '../../data/repositories/issue_repository.dart';
import '../../data/repositories/meta_repository.dart';
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
    final online = ref.watch(isOnlineProvider);
    final palette = context.palette;

    if (user == null) return const _GuestProfile();

    final summary = ref.watch(_summaryProvider);
    return Scaffold(
      body: RefreshIndicator(
        edgeOffset: MediaQuery.paddingOf(context).top,
        onRefresh: () async {
          ref.invalidate(_summaryProvider);
          await ref.read(authControllerProvider.notifier).reloadProfile();
        },
        child: ListView(
          padding: const EdgeInsets.only(bottom: 120),
          children: [
            _ProfileHero(user: user),
            if (OfflineBanner.isVisible(online: online, pendingCount: queue.count))
              Padding(
                padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.md, Gap.screen, 0),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(Radii.tile),
                  child: OfflineBanner(
                    online: online,
                    pendingCount: queue.count,
                    onTap: queue.count > 0 ? () => context.push(Routes.pendingReports) : null,
                  ),
                ),
              ),
            Padding(
              padding: Gap.screenPadding,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (user.role == UserRole.admin) ...[
                    Gap.h16,
                    Text(
                      'Chức năng quản trị (phân công, đơn vị, nhật ký…) dùng trên website — app phục vụ người dân '
                      'và cán bộ hiện trường.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                  const SectionHeader('Báo cáo của tôi'),
                  summary.when(
                    loading: () => const SkeletonBox(height: 168),
                    error: (_, _) => const SizedBox.shrink(),
                    data: (s) => _SummaryCard(summary: s),
                  ),
                  const SectionHeader('Hoạt động'),
                  _MenuGroup(children: [
                    _MenuTile(
                      icon: Icons.assignment_ind_outlined,
                      color: const Color(0xFF14B8A6),
                      title: 'Sự cố của tôi',
                      onTap: () => context.push(Routes.myIssues),
                    ),
                    _MenuTile(
                      icon: Icons.schedule_send_outlined,
                      color: const Color(0xFFF59E0B),
                      title: 'Báo cáo chờ gửi',
                      subtitle: queue.count == 0 ? 'Không có' : PendingBadge.describe(queue.count),
                      onTap: () => context.push(Routes.pendingReports),
                    ),
                    _MenuTile(
                      icon: Icons.emoji_events_outlined,
                      color: const Color(0xFF8B5CF6),
                      title: 'Huy hiệu & bảng xếp hạng',
                      onTap: () => context.push(Routes.badges),
                    ),
                  ]),
                  const SectionHeader('Tài khoản'),
                  _MenuGroup(children: [
                    _MenuTile(
                      icon: Icons.edit_outlined,
                      color: const Color(0xFF0EA5E9),
                      title: 'Sửa hồ sơ & khu vực theo dõi',
                      subtitle: user.watchedDistricts.isEmpty
                          ? 'Chưa theo dõi khu vực nào'
                          : 'Đang theo dõi: ${user.watchedDistricts.join(', ')}',
                      onTap: () => context.push(Routes.editProfile),
                    ),
                    if (user.isLocalAccount)
                      _MenuTile(
                        icon: Icons.password_outlined,
                        color: const Color(0xFF6366F1),
                        title: 'Đổi mật khẩu',
                        onTap: () => context.push(Routes.changePassword),
                      ),
                    _MenuTile(
                      icon: Icons.settings_outlined,
                      color: const Color(0xFF64748B),
                      title: 'Cài đặt',
                      subtitle: 'Giao diện sáng/tối, phiên bản',
                      onTap: () => context.push(Routes.settings),
                    ),
                  ]),
                  Gap.h16,
                  _MenuGroup(children: [
                    _MenuTile(
                      icon: Icons.logout,
                      color: palette.error,
                      title: 'Đăng xuất',
                      danger: true,
                      showChevron: false,
                      onTap: () => _logout(context, ref, queue.count),
                    ),
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _logout(BuildContext context, WidgetRef ref, int pending) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Đăng xuất?'),
        // Phiếu chờ gắn với tài khoản (ReportDraft.ownerId): người khác đăng nhập
        // trên máy này không thấy và không gửi được chúng.
        content: Text(pending > 0
            ? 'Bạn còn $pending báo cáo chưa gửi. Chúng vẫn được giữ trên máy và sẽ tự gửi khi '
                'bạn đăng nhập lại bằng chính tài khoản này.'
            : 'Chỉ đăng xuất trên thiết bị này.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Đăng xuất')),
        ],
      ),
    );
    if (ok == true) await ref.read(authControllerProvider.notifier).logout();
  }
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final role = user.isStaff ? 'Cán bộ · ${user.department?.name ?? 'chưa gán đơn vị'}' : user.role.label;

    Widget pill(IconData icon, String text) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: palette.onBrand.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(Radii.chip),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: palette.onBrand),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  text,
                  style: textTheme.labelSmall?.copyWith(color: palette.onBrand),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        );

    return HeroHeader(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Cá nhân', style: textTheme.labelMedium?.copyWith(color: palette.onBrandMuted)),
          Gap.h16,
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: palette.onBrand.withValues(alpha: 0.7), width: 2),
                ),
                child: CircleAvatar(
                  radius: 34,
                  backgroundColor: palette.onBrand,
                  foregroundImage: user.avatar == null || user.avatar!.isEmpty ? null : NetworkImage(user.avatar!),
                  child: Text(Fmt.initial(user.name), style: textTheme.headlineSmall?.copyWith(color: palette.primary)),
                ),
              ),
              Gap.w16,
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user.name, style: textTheme.headlineSmall?.copyWith(color: palette.onBrand)),
                    Text(user.email, style: textTheme.bodySmall?.copyWith(color: palette.onBrandMuted)),
                  ],
                ),
              ),
            ],
          ),
          Gap.h16,
          Wrap(
            spacing: Gap.sm,
            runSpacing: Gap.sm,
            children: [
              pill(user.isStaff ? Icons.engineering_outlined : Icons.person_outline, role),
              if (user.provider == 'google') pill(Icons.verified_user_outlined, 'Tài khoản Google'),
              pill(
                user.isActive ? Icons.check_circle_outline : Icons.block,
                user.isActive ? 'Đang hoạt động' : 'Đã vô hiệu hoá',
              ),
              if (user.createdAt != null) pill(Icons.event_outlined, 'Tham gia ${Fmt.date(user.createdAt)}'),
            ],
          ),
        ],
      ),
    );
  }
}

/// Báo cáo của tôi theo trạng thái — biểu đồ tròn như trang hồ sơ của web.
class _SummaryCard extends ConsumerWidget {
  const _SummaryCard({required this.summary});

  final IssueSummary summary;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = ref.watch(metaProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final parts = [
      (IssueStatus.reported, summary.reported),
      (IssueStatus.processing, summary.processing),
      (IssueStatus.resolved, summary.resolved),
      (IssueStatus.rejected, summary.rejected),
    ];

    if (summary.total == 0) {
      return AppCard(
        child: Row(
          children: [
            IconBubble(icon: Icons.add_a_photo_outlined, ink: palette.accentInk, container: palette.accentSoft),
            Gap.w12,
            Expanded(
              child: Text('Bạn chưa gửi báo cáo nào. Thấy sự cố, hãy báo ngay — chỉ mất một phút.',
                  style: textTheme.bodyMedium),
            ),
          ],
        ),
      );
    }

    return AppCard(
      child: Row(
        children: [
          SizedBox.square(
            dimension: 132,
            child: Stack(
              alignment: Alignment.center,
              children: [
                PieChart(
                  PieChartData(
                    sectionsSpace: 2,
                    centerSpaceRadius: 42,
                    startDegreeOffset: -90,
                    sections: [
                      for (final (status, count) in parts)
                        if (count > 0)
                          PieChartSectionData(
                            value: count.toDouble(),
                            color: palette.statusColors(status).text,
                            radius: 20,
                            showTitle: false,
                          ),
                    ],
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(Fmt.number(summary.total), style: textTheme.headlineSmall),
                    Text('đã gửi', style: textTheme.bodySmall),
                  ],
                ),
              ],
            ),
          ),
          Gap.w16,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final (status, count) in parts)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Icon(AppIcons.status(status), size: 16, color: palette.statusColors(status).text),
                        Gap.w8,
                        Expanded(child: Text(meta.statusLabel(status.name), style: textTheme.bodySmall)),
                        Text('$count', style: textTheme.titleSmall),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuGroup extends StatelessWidget {
  const _MenuGroup({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => AppCard(
        padding: const EdgeInsets.symmetric(vertical: Gap.xs),
        child: Column(
          children: [
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0) const Divider(indent: 68),
              children[i],
            ],
          ],
        ),
      );
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({
    required this.icon,
    required this.color,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.danger = false,
    this.showChevron = true,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;
  final bool danger;
  final bool showChevron;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final tone = danger ? ChipColors(palette.error, palette.danger.container) : null;
    final category = tone == null ? CategoryTone.of(color, palette) : null;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: Gap.md),
      leading: IconBubble(
        icon: icon,
        ink: tone?.text ?? category!.ink,
        container: tone?.container ?? category!.container,
        size: 40,
      ),
      title: Text(title, style: danger ? TextStyle(color: palette.error) : null),
      subtitle: subtitle == null ? null : Text(subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis),
      trailing: showChevron ? Icon(Icons.chevron_right, color: palette.textSecondary) : null,
      onTap: onTap,
    );
  }
}

class _GuestProfile extends StatelessWidget {
  const _GuestProfile();

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      body: ListView(
        padding: const EdgeInsets.only(bottom: 120),
        children: [
          HeroHeader(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Cá nhân', style: textTheme.labelMedium?.copyWith(color: palette.onBrandMuted)),
                Gap.h16,
                Icon(Icons.account_circle_outlined, size: 56, color: palette.onBrand),
                Gap.h12,
                Text('Bạn chưa đăng nhập', style: textTheme.headlineSmall?.copyWith(color: palette.onBrand)),
                Gap.h4,
                Text(
                  'Đăng nhập để báo cáo sự cố, theo dõi tiến độ và nhận thông báo khi sự cố được xử lý.',
                  style: textTheme.bodyMedium?.copyWith(color: palette.onBrandMuted),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.xl, Gap.screen, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                FilledButton(onPressed: () => context.push(Routes.login), child: const Text('Đăng nhập')),
                Gap.h8,
                OutlinedButton(onPressed: () => context.push(Routes.register), child: const Text('Tạo tài khoản')),
                Gap.h24,
                _MenuGroup(children: [
                  _MenuTile(
                    icon: Icons.emoji_events_outlined,
                    color: const Color(0xFF8B5CF6),
                    title: 'Bảng xếp hạng người dân',
                    onTap: () => context.push(Routes.badges),
                  ),
                  _MenuTile(
                    icon: Icons.settings_outlined,
                    color: const Color(0xFF64748B),
                    title: 'Cài đặt',
                    onTap: () => context.push(Routes.settings),
                  ),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
