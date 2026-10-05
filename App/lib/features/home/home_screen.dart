import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/platform/connectivity.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/feature_styles.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/offline_banner.dart';
import '../../core/widgets/surfaces.dart';
import '../../data/models/common.dart';
import '../../data/models/issue.dart';
import '../../data/models/public_info.dart';
import '../../data/repositories/issue_repository.dart';
import '../../data/repositories/support_repositories.dart';
import '../auth/auth_controller.dart';
import '../issues/widgets/issue_card.dart';
import '../report/offline_queue.dart';

final _homeStatsProvider =
    FutureProvider.autoDispose<PublicStatistics>((ref) => ref.read(publicRepositoryProvider).statistics());

final _recentIssuesProvider = FutureProvider.autoDispose<Paged<Issue>>(
  (ref) => ref.read(issueRepositoryProvider).list(const IssueQuery(), limit: 5),
);

/// "Chào buổi sáng, An" — lời chào theo giờ trong ngày.
String homeGreeting(String? name, {DateTime? now}) {
  final hour = (now ?? DateTime.now()).hour;
  final part = hour < 11
      ? 'Chào buổi sáng'
      : hour < 13
          ? 'Chào buổi trưa'
          : hour < 18
              ? 'Chào buổi chiều'
              : 'Chào buổi tối';
  final given = Fmt.givenName(name);
  return given.isEmpty ? '$part!' : '$part, $given';
}

/// Lối tắt trên trang chủ. Icon + màu lấy từ [AppFeatures] — cùng một tính năng
/// ở màn Cá nhân mang đúng icon/màu đó; tông được chỉnh qua [CategoryTone].
class _Shortcut {
  const _Shortcut(this.style, this.label, this.onTap);

  final FeatureStyle style;
  final String label;
  final void Function(BuildContext) onTap;
}

final _shortcuts = <_Shortcut>[
  _Shortcut(AppFeatures.map, 'Bản đồ', (c) => c.go(Routes.map)),
  _Shortcut(AppFeatures.issues, 'Danh sách', (c) => c.push(Routes.issues)),
  _Shortcut(AppFeatures.myIssues, 'Của tôi', (c) => c.push(Routes.myIssues)),
  _Shortcut(AppFeatures.statistics, 'Thống kê', (c) => c.push(Routes.statistics)),
  _Shortcut(AppFeatures.cameras, 'Camera', (c) => c.push(Routes.cameras)),
  _Shortcut(AppFeatures.badges, 'Xếp hạng', (c) => c.push(Routes.badges)),
  _Shortcut(AppFeatures.chatbot, 'Trợ lý AI', (c) => c.push(Routes.chatbot)),
  _Shortcut(AppFeatures.pending, 'Chờ gửi', (c) => c.push(Routes.pendingReports)),
];

/// Trang chủ (task 2.1) — **không port landing page 828 dòng của web**: mobile
/// cần vào việc nhanh. Header thương hiệu + số liệu thật + nút Báo cáo lớn, lối
/// tắt, rồi sự cố mới nhất.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final recent = ref.watch(_recentIssuesProvider);
    final queue = ref.watch(offlineQueueProvider);
    final online = ref.watch(isOnlineProvider);
    final palette = context.palette;

    Future<void> refresh() async {
      ref.invalidate(_homeStatsProvider);
      ref.invalidate(_recentIssuesProvider);
      await ref.read(_recentIssuesProvider.future).catchError((_) => const Paged<Issue>([], Pagination.empty));
    }

    return HeroScrollScope(
      child: Scaffold(
        body: RefreshIndicator(
          onRefresh: refresh,
          edgeOffset: MediaQuery.paddingOf(context).top,
          child: ListView(
            padding: const EdgeInsets.only(bottom: 120),
            children: [
              _HomeHero(name: user?.name),
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
                    if (queue.needsAttention > 0) ...[
                      Gap.h16,
                      AppCard(
                        color: palette.offline.container,
                        borderColor: Colors.transparent,
                        elevated: false,
                        onTap: () => context.push(Routes.pendingReports),
                        child: Row(
                          children: [
                            Icon(Icons.edit_note, color: palette.offline.text),
                            Gap.w12,
                            Expanded(
                              child: Text(
                                '${queue.needsAttention} báo cáo cần bạn sửa lại trước khi gửi',
                                style: Theme.of(context).textTheme.titleSmall?.copyWith(color: palette.offline.text),
                              ),
                            ),
                            Icon(Icons.chevron_right, color: palette.offline.text),
                          ],
                        ),
                      ),
                    ],
                    const SectionHeader('Lối tắt'),
                    const _ShortcutGrid(),
                    SectionHeader(
                      'Sự cố mới',
                      actionLabel: 'Xem tất cả',
                      onAction: () => context.push(Routes.issues),
                    ),
                    recent.when(
                      loading: () => const Column(children: [
                        SkeletonBox(height: 120),
                        SizedBox(height: Gap.md),
                        SkeletonBox(height: 120),
                      ]),
                      error: (e, _) => SizedBox(
                        height: 220,
                        child: ErrorState(error: e, onRetry: () => ref.invalidate(_recentIssuesProvider)),
                      ),
                      data: (page) => page.items.isEmpty
                          ? const EmptyState(
                              icon: Icons.verified_outlined,
                              title: 'Chưa có sự cố nào',
                              message: 'Thành phố đang yên ổn. Thấy sự cố, hãy là người báo đầu tiên.',
                            )
                          : Column(
                              children: [
                                for (final issue in page.items) ...[
                                  IssueCard(issue: issue, onTap: () => context.push(Routes.issue(issue.id))),
                                  Gap.h12,
                                ],
                              ],
                            ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeHero extends ConsumerWidget {
  const _HomeHero({required this.name});

  final String? name;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final stats = ref.watch(_homeStatsProvider);
    final s = stats.valueOrNull;
    String value(String Function(PublicStatistics) f) => s == null ? '—' : f(s);

    return HeroHeader(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const BrandLogo(),
              Gap.w12,
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Smart City', style: textTheme.titleMedium?.copyWith(color: palette.onBrand)),
                    Text('Đà Nẵng', style: textTheme.bodySmall?.copyWith(color: palette.onBrandMuted)),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Trợ lý hỏi đáp',
                style: IconButton.styleFrom(backgroundColor: palette.onBrand.withValues(alpha: 0.14)),
                icon: Icon(AppFeatures.chatbot.icon, color: palette.onBrand),
                onPressed: () => context.push(Routes.chatbot),
              ),
            ],
          ),
          Gap.h24,
          Text(homeGreeting(name), style: textTheme.headlineMedium?.copyWith(color: palette.onBrand)),
          Gap.h4,
          Text(
            'Cùng giữ Đà Nẵng an toàn, sạch đẹp — thấy sự cố, báo ngay.',
            style: textTheme.bodyMedium?.copyWith(color: palette.onBrandMuted),
          ),
          Gap.h16,
          // Ba ô cao bằng nhau dù nhãn xuống 2 dòng.
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: GlassTile(
                    icon: Icons.campaign_outlined,
                    value: value((s) => Fmt.number(s.totalIssues)),
                    label: 'Sự cố đã báo',
                  ),
                ),
                Gap.w8,
                Expanded(
                  child: GlassTile(
                    icon: Icons.task_alt,
                    value: value((s) => '${s.resolutionRate}%'),
                    label: 'Đã xử lý xong',
                  ),
                ),
                Gap.w8,
                Expanded(
                  child: GlassTile(
                    icon: Icons.timer_outlined,
                    value: value((s) => Fmt.hours(s.avgResolutionHours)),
                    label: 'Xử lý trung bình',
                  ),
                ),
              ],
            ),
          ),
          Gap.h16,
          _ReportCta(onTap: () => context.push(Routes.report)),
        ],
      ),
    );
  }
}

/// Nút Báo cáo cỡ lớn trong header — hành động chính, nhắc lại nút giữa thanh
/// điều hướng cho người dùng lần đầu chưa để ý tới nó.
class _ReportCta extends StatelessWidget {
  const _ReportCta({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      label: 'Báo cáo sự cố mới',
      excludeSemantics: true,
      child: Material(
        color: palette.surface,
        borderRadius: BorderRadius.circular(Radii.tile),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(Gap.md),
            child: Row(
              children: [
                IconBubble(
                  icon: Icons.add_a_photo_rounded,
                  ink: palette.onAccent,
                  container: palette.accent,
                  size: 48,
                ),
                Gap.w12,
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Báo cáo sự cố', style: textTheme.titleMedium),
                      Text(
                        'Chụp ảnh — AI gợi ý loại sự cố, bạn chỉ cần xác nhận',
                        style: textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                Icon(Icons.arrow_forward_rounded, color: palette.primary),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ShortcutGrid extends StatelessWidget {
  const _ShortcutGrid();

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;

    Widget tile(_Shortcut s) {
      final tone = CategoryTone.of(s.style.color, palette);
      return Semantics(
        button: true,
        label: s.label,
        excludeSemantics: true,
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.tile),
          onTap: () => s.onTap(context),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: Gap.sm, horizontal: 2),
            child: Column(
              children: [
                IconBubble(icon: s.style.icon, ink: tone.ink, container: tone.container, size: 52),
                Gap.h8,
                Text(
                  s.label,
                  style: textTheme.labelMedium,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      );
    }

    // Hàng 4 ô, chiều cao tự giãn: chữ phóng to 1.6× xuống 2 dòng vẫn không cắt.
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: Gap.sm, vertical: Gap.sm),
      child: Column(
        children: [
          for (var i = 0; i < _shortcuts.length; i += 4)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final s in _shortcuts.skip(i).take(4)) Expanded(child: tile(s)),
              ],
            ),
        ],
      ),
    );
  }
}
