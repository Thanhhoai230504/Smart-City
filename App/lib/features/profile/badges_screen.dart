import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/widgets/async_states.dart';
import '../../data/models/public_info.dart';
import '../../data/repositories/support_repositories.dart';
import '../auth/auth_controller.dart';

final _myBadgesProvider =
    FutureProvider.autoDispose<BadgeProgress>((ref) => ref.read(publicRepositoryProvider).myBadges());
final _leaderboardProvider = FutureProvider.autoDispose<List<LeaderboardEntry>>(
  (ref) => ref.read(publicRepositoryProvider).leaderboard(),
);

/// Huy hiệu + bảng xếp hạng (task 6.2). Ngưỡng 1/5/10/20/50 do server quyết.
class BadgesScreen extends ConsumerWidget {
  const BadgesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(currentUserProvider) != null;
    final leaderboard = ref.watch(_leaderboardProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Huy hiệu & xếp hạng')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_leaderboardProvider);
          if (signedIn) ref.invalidate(_myBadgesProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(Gap.screen),
          children: [
            if (signedIn) ...[
              ref.watch(_myBadgesProvider).when(
                    loading: () => const SkeletonBox(height: 120),
                    error: (e, _) => SizedBox(
                      height: 200,
                      child: ErrorState(error: e, onRetry: () => ref.invalidate(_myBadgesProvider)),
                    ),
                    data: (p) => Card(
                      child: Padding(
                        padding: const EdgeInsets.all(Gap.card),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('Bạn đã báo cáo ${p.issueCount} sự cố hợp lệ', style: textTheme.titleMedium),
                            if (p.nextBadge != null) ...[
                              Gap.h8,
                              Text(
                                'Còn ${p.nextBadge!.remaining ?? (p.nextBadge!.threshold - p.issueCount)} sự cố nữa để đạt '
                                '${p.nextBadge!.icon} ${p.nextBadge!.label}',
                                style: textTheme.bodySmall,
                              ),
                              Gap.h8,
                              LinearProgressIndicator(
                                value: p.nextBadge!.threshold == 0
                                    ? 0
                                    : (p.issueCount / p.nextBadge!.threshold).clamp(0, 1).toDouble(),
                              ),
                            ],
                            Gap.h16,
                            Wrap(
                              spacing: Gap.sm,
                              runSpacing: Gap.sm,
                              children: [
                                for (final b in p.allBadges)
                                  Tooltip(
                                    message: '${b.description} (${b.threshold} sự cố)',
                                    child: Opacity(
                                      opacity: b.earned ? 1 : 0.4,
                                      child: Chip(
                                        avatar: Text(b.icon),
                                        label: Text(b.label),
                                        side: BorderSide(color: b.earned ? palette.primary : palette.border),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              Gap.h24,
            ],
            Text('Bảng xếp hạng người dân', style: textTheme.titleLarge),
            Gap.h4,
            Text('Chỉ tính phiếu không bị từ chối.', style: textTheme.bodySmall),
            Gap.h12,
            leaderboard.when(
              loading: () => const SkeletonBox(height: 240),
              error: (e, _) => SizedBox(
                height: 220,
                child: ErrorState(error: e, onRetry: () => ref.invalidate(_leaderboardProvider)),
              ),
              data: (list) => list.isEmpty
                  ? const Text('Chưa có dữ liệu.')
                  : Card(
                      child: Column(
                        children: [
                          for (final e in list)
                            ListTile(
                              leading: CircleAvatar(
                                backgroundColor: e.rank <= 3 ? palette.primary : palette.surfaceAlt,
                                child: Text(
                                  '${e.rank}',
                                  style: TextStyle(
                                    color: e.rank <= 3 ? palette.onPrimary : palette.textPrimary,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              title: Text(e.name),
                              subtitle: e.topBadge == null ? null : Text('${e.topBadge!.icon} ${e.topBadge!.label}'),
                              trailing: Text('${e.issueCount}', style: textTheme.titleMedium),
                            ),
                        ],
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
