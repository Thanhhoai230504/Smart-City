import 'package:flutter/material.dart' hide Badge;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/surfaces.dart';
import '../../data/models/public_info.dart';
import '../../data/repositories/support_repositories.dart';
import '../auth/auth_controller.dart';

final _myBadgesProvider =
    FutureProvider.autoDispose<BadgeProgress>((ref) => ref.read(publicRepositoryProvider).myBadges());
final _leaderboardProvider = FutureProvider.autoDispose<List<LeaderboardEntry>>(
  (ref) => ref.read(publicRepositoryProvider).leaderboard(),
);

/// Huy hiệu + bảng xếp hạng (task 6.2). Ngưỡng 1/5/10/20/50 do server quyết.
/// Bảng xếp hạng công khai như web — khách xem được, chỉ phần huy hiệu riêng
/// cần đăng nhập.
class BadgesScreen extends ConsumerWidget {
  const BadgesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(currentUserProvider) != null;
    final leaderboard = ref.watch(_leaderboardProvider);
    final myBadges = signedIn ? ref.watch(_myBadgesProvider) : null;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      body: RefreshIndicator(
        edgeOffset: MediaQuery.paddingOf(context).top,
        onRefresh: () async {
          ref.invalidate(_leaderboardProvider);
          if (signedIn) ref.invalidate(_myBadgesProvider);
        },
        child: ListView(
          padding: const EdgeInsets.only(bottom: Gap.xxxl),
          children: [
            _BadgesHero(progress: myBadges?.valueOrNull, signedIn: signedIn),
            Padding(
              padding: Gap.screenPadding,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (myBadges != null) ...[
                    const SectionHeader('Huy hiệu của bạn'),
                    myBadges.when(
                      loading: () => const SkeletonBox(height: 160),
                      error: (e, _) => SizedBox(
                        height: 200,
                        child: ErrorState(error: e, onRetry: () => ref.invalidate(_myBadgesProvider)),
                      ),
                      data: (p) => _BadgeGrid(badges: p.allBadges),
                    ),
                  ],
                  const SectionHeader('Bảng xếp hạng người dân'),
                  Text('Chỉ tính phiếu không bị từ chối.', style: textTheme.bodySmall),
                  Gap.h12,
                  leaderboard.when(
                    loading: () => const SkeletonBox(height: 240),
                    error: (e, _) => SizedBox(
                      height: 220,
                      child: ErrorState(error: e, onRetry: () => ref.invalidate(_leaderboardProvider)),
                    ),
                    data: (list) => list.isEmpty
                        ? const EmptyState(
                            icon: Icons.emoji_events_outlined,
                            title: 'Chưa có ai trên bảng',
                            message: 'Báo cáo sự cố hợp lệ đầu tiên để ghi tên mình.',
                          )
                        : _Leaderboard(entries: list),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BadgesHero extends StatelessWidget {
  const _BadgesHero({required this.progress, required this.signedIn});

  final BadgeProgress? progress;
  final bool signedIn;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final p = progress;
    final next = p?.nextBadge;

    return HeroHeader(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: kMinTouchTarget,
            child: Align(
              alignment: Alignment.centerLeft,
              child: IconButton(
                tooltip: 'Quay lại',
                style: IconButton.styleFrom(backgroundColor: palette.onBrand.withValues(alpha: 0.14)),
                icon: Icon(Icons.arrow_back, color: palette.onBrand),
                onPressed: () => Navigator.of(context).maybePop(),
              ),
            ),
          ),
          Gap.h12,
          Row(
            children: [
              Icon(Icons.emoji_events, size: 40, color: palette.onBrand),
              Gap.w12,
              Expanded(
                child: Text('Huy hiệu & xếp hạng', style: textTheme.headlineSmall?.copyWith(color: palette.onBrand)),
              ),
            ],
          ),
          Gap.h12,
          if (!signedIn) ...[
            Text(
              'Mỗi báo cáo hợp lệ đưa bạn lên gần huy hiệu tiếp theo.',
              style: textTheme.bodyMedium?.copyWith(color: palette.onBrandMuted),
            ),
            Gap.h12,
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: palette.onBrand, foregroundColor: palette.primary),
              onPressed: () => context.push(Uri(path: Routes.login, queryParameters: {'from': Routes.badges}).toString()),
              child: const Text('Đăng nhập để xem huy hiệu của bạn'),
            ),
          ] else if (p != null) ...[
            Text(
              '${Fmt.number(p.issueCount)} sự cố hợp lệ',
              style: textTheme.displaySmall?.copyWith(color: palette.onBrand),
            ),
            if (next != null) ...[
              Gap.h8,
              Text(
                'Còn ${next.remaining ?? (next.threshold - p.issueCount)} sự cố nữa để đạt ${next.icon} ${next.label}',
                style: textTheme.bodyMedium?.copyWith(color: palette.onBrandMuted),
              ),
              Gap.h8,
              ClipRRect(
                borderRadius: BorderRadius.circular(Radii.chip),
                child: LinearProgressIndicator(
                  minHeight: 8,
                  backgroundColor: palette.onBrand.withValues(alpha: 0.2),
                  color: palette.accent,
                  value: next.threshold == 0 ? 0 : (p.issueCount / next.threshold).clamp(0, 1).toDouble(),
                ),
              ),
            ] else ...[
              Gap.h8,
              Text('Bạn đã đạt mọi huy hiệu — cảm ơn đóng góp của bạn!',
                  style: textTheme.bodyMedium?.copyWith(color: palette.onBrandMuted)),
            ],
          ],
        ],
      ),
    );
  }
}

class _BadgeGrid extends StatelessWidget {
  const _BadgeGrid({required this.badges});

  final List<Badge> badges;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;

    Widget tile(Badge b) => Semantics(
          label: '${b.label}, ${b.earned ? 'đã đạt' : 'chưa đạt'} — ${b.threshold} sự cố',
          excludeSemantics: true,
          child: Tooltip(
            message: b.description,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: Gap.sm),
              child: Column(
                children: [
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        width: 60,
                        height: 60,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: b.earned ? palette.accentSoft : palette.field,
                          border: Border.all(color: b.earned ? palette.accent : palette.border, width: 2),
                        ),
                        child: Opacity(
                          opacity: b.earned ? 1 : 0.35,
                          child: Text(b.icon, style: const TextStyle(fontSize: 28)),
                        ),
                      ),
                      if (!b.earned)
                        Positioned(
                          right: -2,
                          bottom: -2,
                          child: CircleAvatar(
                            radius: 11,
                            backgroundColor: scheme.surface,
                            child: Icon(Icons.lock_outline, size: 14, color: palette.textSecondary),
                          ),
                        ),
                    ],
                  ),
                  Gap.h8,
                  Text(b.label, style: textTheme.labelMedium, textAlign: TextAlign.center, maxLines: 2),
                  Text('${b.threshold} sự cố', style: textTheme.bodySmall),
                ],
              ),
            ),
          ),
        );

    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: Gap.sm, vertical: Gap.sm),
      child: Column(
        children: [
          for (var i = 0; i < badges.length; i += 3)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var j = i; j < i + 3; j++) Expanded(child: j < badges.length ? tile(badges[j]) : const SizedBox()),
              ],
            ),
        ],
      ),
    );
  }
}

class _Leaderboard extends StatelessWidget {
  const _Leaderboard({required this.entries});

  final List<LeaderboardEntry> entries;

  static const _medals = [Color(0xFFF59E0B), Color(0xFF94A3B8), Color(0xFFB45309)];

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: Gap.xs),
      child: Column(
        children: [
          for (var i = 0; i < entries.length; i++) ...[
            if (i > 0) const Divider(indent: 72),
            ListTile(
              leading: entries[i].rank <= 3
                  ? Builder(builder: (context) {
                      final tone = CategoryTone.of(_medals[entries[i].rank - 1], palette);
                      return IconBubble(icon: Icons.military_tech, ink: tone.ink, container: tone.container, size: 42);
                    })
                  : CircleAvatar(
                      radius: 21,
                      backgroundColor: palette.field,
                      child: Text('${entries[i].rank}', style: textTheme.titleSmall),
                    ),
              title: Text(entries[i].name, maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: entries[i].topBadge == null
                  ? null
                  : Text('${entries[i].topBadge!.icon} ${entries[i].topBadge!.label}'),
              trailing: Text('${entries[i].issueCount} sự cố', style: textTheme.labelLarge),
            ),
          ],
        ],
      ),
    );
  }
}
