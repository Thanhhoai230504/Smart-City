import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_shell.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_states.dart';
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

/// Trang chủ rút gọn (task 2.1) — **không port landing page 828 dòng của web**:
/// mobile cần vào việc nhanh. Thống kê nhanh + 4 lối vào + sự cố mới.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final stats = ref.watch(_homeStatsProvider);
    final recent = ref.watch(_recentIssuesProvider);
    final queue = ref.watch(offlineQueueProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;

    Future<void> refresh() async {
      ref.invalidate(_homeStatsProvider);
      ref.invalidate(_recentIssuesProvider);
      await ref.read(_recentIssuesProvider.future).catchError((_) => const Paged<Issue>([], Pagination.empty));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Smart City Đà Nẵng'),
        bottom: connectivityBar(context, ref),
        actions: [
          IconButton(
            tooltip: 'Trợ lý hỏi đáp',
            icon: const Icon(Icons.support_agent),
            onPressed: () => context.push(Routes.chatbot),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.lg, Gap.screen, 96),
          children: [
            Text(
              user == null ? 'Xin chào!' : 'Xin chào, ${user.name.split(' ').last}!',
              style: textTheme.headlineMedium,
            ),
            Gap.h4,
            Text(
              'Thấy ổ gà, ngập nước, đèn hỏng? Báo ngay — đơn vị phụ trách sẽ tiếp nhận.',
              style: textTheme.bodyMedium?.copyWith(color: palette.textSecondary),
            ),
            Gap.h16,
            if (queue.count > 0) ...[
              Card(
                color: palette.offline.container,
                child: ListTile(
                  leading: Icon(Icons.schedule_send_outlined, color: palette.offline.text),
                  title: Text('${queue.count} báo cáo đang chờ gửi',
                      style: textTheme.titleSmall?.copyWith(color: palette.offline.text)),
                  subtitle: Text(
                    queue.needsAttention > 0
                        ? '${queue.needsAttention} báo cáo cần bạn sửa lại'
                        : 'Sẽ tự gửi khi có mạng',
                    style: textTheme.bodySmall?.copyWith(color: palette.offline.text),
                  ),
                  trailing: Icon(Icons.chevron_right, color: palette.offline.text),
                  onTap: () => context.push(Routes.pendingReports),
                ),
              ),
              Gap.h12,
            ],
            _StatsRow(stats: stats),
            Gap.h16,
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: Gap.md,
              crossAxisSpacing: Gap.md,
              childAspectRatio: 1.9,
              children: [
                _EntryTile(
                  icon: Icons.add_a_photo_outlined,
                  label: 'Báo cáo sự cố',
                  primary: true,
                  onTap: () => context.push(Routes.report),
                ),
                _EntryTile(icon: Icons.map_outlined, label: 'Bản đồ', onTap: () => context.go(Routes.map)),
                _EntryTile(icon: Icons.list_alt, label: 'Danh sách', onTap: () => context.push(Routes.issues)),
                _EntryTile(
                  icon: Icons.assignment_ind_outlined,
                  label: 'Sự cố của tôi',
                  onTap: () => context.push(Routes.myIssues),
                ),
              ],
            ),
            Gap.h12,
            Wrap(
              spacing: Gap.sm,
              runSpacing: Gap.sm,
              children: [
                ActionChip(
                  avatar: const Icon(Icons.bar_chart, size: 18),
                  label: const Text('Thống kê'),
                  onPressed: () => context.push(Routes.statistics),
                ),
                ActionChip(
                  avatar: const Icon(Icons.videocam_outlined, size: 18),
                  label: const Text('Camera'),
                  onPressed: () => context.push(Routes.cameras),
                ),
                ActionChip(
                  avatar: const Icon(Icons.emoji_events_outlined, size: 18),
                  label: const Text('Bảng xếp hạng'),
                  onPressed: () => context.push(Routes.badges),
                ),
              ],
            ),
            Gap.h24,
            Row(
              children: [
                Expanded(child: Text('Sự cố mới', style: textTheme.titleLarge)),
                TextButton(onPressed: () => context.push(Routes.issues), child: const Text('Xem tất cả')),
              ],
            ),
            Gap.h8,
            recent.when(
              loading: () => const Column(children: [
                SkeletonBox(height: 110),
                SizedBox(height: Gap.md),
                SkeletonBox(height: 110),
              ]),
              error: (e, _) => SizedBox(
                height: 220,
                child: ErrorState(error: e, onRetry: () => ref.invalidate(_recentIssuesProvider)),
              ),
              data: (page) => page.items.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(Gap.xl),
                      child: Text('Chưa có sự cố nào được báo cáo.'),
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
    );
  }
}

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.stats});

  final AsyncValue<PublicStatistics> stats;

  @override
  Widget build(BuildContext context) {
    final s = stats.valueOrNull;
    Widget tile(String value, String label) => Expanded(
          child: Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: Gap.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (s == null && stats.isLoading)
                    const SkeletonBox(height: 28, width: 56)
                  else
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(value, style: Theme.of(context).textTheme.headlineSmall),
                    ),
                  Gap.h4,
                  Text(label, style: Theme.of(context).textTheme.bodySmall, maxLines: 2),
                ],
              ),
            ),
          ),
        );
    return Row(
      children: [
        tile(s == null ? '—' : Fmt.number(s.totalIssues), 'Sự cố đã báo'),
        Gap.w8,
        tile(s == null ? '—' : '${s.resolutionRate}%', 'Đã xử lý xong'),
        Gap.w8,
        tile(s == null ? '—' : Fmt.hours(s.avgResolutionHours), 'Xử lý trung bình'),
      ],
    );
  }
}

class _EntryTile extends StatelessWidget {
  const _EntryTile({required this.icon, required this.label, required this.onTap, this.primary = false});

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final fg = primary ? palette.onPrimary : palette.textPrimary;
    return Material(
      color: primary ? palette.primary : palette.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Radii.card),
        side: primary ? BorderSide.none : BorderSide(color: palette.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.card),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(Gap.md),
          child: Row(
            children: [
              Icon(icon, color: primary ? fg : palette.primary, size: 28),
              Gap.w12,
              Expanded(
                child: Text(label, style: Theme.of(context).textTheme.titleSmall?.copyWith(color: fg)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
