import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/app_exception.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/photo_evidence_strip.dart';
import '../../core/widgets/sla_countdown.dart';
import '../../core/widgets/status_chips.dart';
import '../../data/models/issue.dart';
import '../../data/models/user.dart';
import '../../data/repositories/meta_repository.dart';
import '../auth/auth_controller.dart';
import '../public_info/camera_player.dart';
import 'issue_detail_controller.dart';
import 'issue_rules.dart';
import 'widgets/detail_sections.dart';

/// Chi tiết sự cố (task 2.3). Người dân thường **không** thấy `phone` —
/// backend che ở tầng truy vấn, app chỉ hiển thị theo field có mặt hay không.
class IssueDetailScreen extends ConsumerWidget {
  const IssueDetailScreen({super.key, required this.issueId});

  final String issueId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(issueDetailProvider(issueId));
    final controller = ref.read(issueDetailProvider(issueId).notifier);

    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết sự cố')),
      body: async.when(
        skipLoadingOnRefresh: true,
        loading: () => const SkeletonList(count: 3, itemHeight: 140),
        error: (e, _) {
          final err = AppException.from(e);
          if (err.kind == AppErrorKind.notFound) {
            return EmptyState(
              icon: Icons.search_off,
              title: 'Không tìm thấy sự cố',
              message: 'Sự cố có thể đã bị xoá.',
              actionLabel: 'Về danh sách',
              onAction: () => context.go(Routes.issues),
            );
          }
          return ErrorState(error: e, onRetry: () => ref.invalidate(issueDetailProvider(issueId)));
        },
        data: (issue) => RefreshIndicator(
          onRefresh: controller.reload,
          child: _DetailBody(issue: issue),
        ),
      ),
    );
  }
}

class _DetailBody extends ConsumerWidget {
  const _DetailBody({required this.issue});

  final Issue issue;

  Future<void> _vote(BuildContext context, WidgetRef ref) async {
    if (ref.read(currentUserProvider) == null) {
      await context.push(Uri(path: Routes.login, queryParameters: {'from': Routes.issue(issue.id)}).toString());
      return;
    }
    try {
      await ref.read(issueDetailProvider(issue.id).notifier).toggleVote();
    } on AppException catch (e) {
      if (context.mounted) showAppSnack(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = ref.watch(metaProvider);
    final user = ref.watch(currentUserProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final category = meta.category(issue.category);
    final voted = issue.hasVoted(user?.id);
    final isStaffHere = user?.role == UserRole.staff &&
        staffCanHandle(issue, departmentId: user?.department?.id);

    return ListView(
      padding: const EdgeInsets.only(bottom: Gap.xxxl),
      children: [
        if (issue.mergedInto != null)
          MaterialBanner(
            backgroundColor: palette.offline.container,
            leading: Icon(Icons.merge_type, color: palette.offline.text),
            content: Text(
              'Báo cáo này đã được gộp vào “${issue.mergedInto!.title ?? 'sự cố gốc'}”. '
              'Mọi cập nhật diễn ra trên sự cố gốc.',
              style: textTheme.bodyMedium?.copyWith(color: palette.offline.text),
            ),
            actions: [
              TextButton(
                onPressed: () => context.pushReplacement(Routes.issue(issue.mergedInto!.id)),
                child: const Text('Xem sự cố gốc'),
              ),
            ],
          ),
        if (isStaffHere)
          Padding(
            padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.md, Gap.screen, 0),
            child: FilledButton.icon(
              onPressed: () => context.push(Routes.staffIssue(issue.id)),
              icon: const Icon(Icons.engineering),
              label: const Text('Mở cổng xử lý của cán bộ'),
            ),
          ),
        Padding(
          padding: const EdgeInsets.all(Gap.screen),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${category.icon} ${category.label}',
                  style: textTheme.labelMedium?.copyWith(color: palette.textSecondary)),
              Gap.h4,
              Text(issue.title, style: textTheme.headlineSmall),
              Gap.h8,
              Wrap(
                spacing: Gap.sm,
                runSpacing: Gap.sm,
                children: [
                  StatusChip(issue.status),
                  if (issue.priorityLevel != null)
                    PriorityChip(issue.priorityLevel!, score: issue.priorityScore),
                  if (issue.dueAt != null) SlaCountdown(issue: issue),
                  if (issue.reopenCount > 0) ReopenedChip(issue.reopenCount),
                ],
              ),
              Gap.h8,
              Text(
                'Báo cáo ${Fmt.relative(issue.createdAt)}'
                '${issue.reporter?.name != null ? ' bởi ${issue.reporter!.name}' : ''}',
                style: textTheme.bodySmall,
              ),
              Gap.h16,
              PhotoEvidenceStrip(
                label: 'Người dân chụp',
                photos: [for (final u in issue.photoUrls) PhotoSource.url(u)],
                emptyText: 'Người báo cáo không đính kèm ảnh.',
              ),
              if (issue.resolutionImages.isNotEmpty || issue.status == IssueStatus.resolved) ...[
                Gap.h16,
                PhotoEvidenceStrip(
                  label: 'Đơn vị chụp sau xử lý',
                  icon: Icons.verified_outlined,
                  photos: [for (final i in issue.resolutionImages) PhotoSource.url(i.url)],
                  emptyText: 'Chưa có ảnh minh chứng.',
                ),
              ],
              Gap.h16,
              Text(issue.description, style: textTheme.bodyLarge),
              Gap.h16,
              Row(
                children: [
                  Expanded(
                    child: (voted ? FilledButton.tonalIcon : OutlinedButton.icon)(
                      onPressed: issue.isMerged ? null : () => _vote(context, ref),
                      icon: Icon(voted ? Icons.thumb_up_alt : Icons.thumb_up_alt_outlined),
                      label: Text(voted
                          ? 'Đã ủng hộ · ${issue.voteCount}'
                          : 'Tôi cũng gặp · ${issue.voteCount}'),
                    ),
                  ),
                ],
              ),
              if (issue.duplicateCount > 0) ...[
                Gap.h8,
                Text('${issue.duplicateCount} báo cáo trùng đã được gộp vào sự cố này.',
                    style: textTheme.bodySmall),
              ],
              if (issue.phone != null && issue.phone!.isNotEmpty) ...[
                Gap.h8,
                Text('Số liên hệ của người báo cáo: ${issue.phone}', style: textTheme.bodySmall),
              ],
              Gap.h24,
              const SectionTitle('Vị trí', icon: Icons.place_outlined),
              Text(issue.location, style: textTheme.bodyMedium),
              Gap.h8,
              MiniMap(lat: issue.latitude, lng: issue.longitude, color: hexColor(category.color)),
              Gap.h24,
              DepartmentCard(issue: issue),
              Gap.h12,
              RatingCard(issue: issue),
              ReopenCard(issue: issue),
              Gap.h24,
              TimelineSection(issue: issue),
              NearbyCamerasSection(issue: issue, onOpen: (c) => CameraPlayer.open(context, c)),
              Gap.h16,
              NearbySection(issue: issue),
              Gap.h16,
              CommentsSection(issueId: issue.id),
            ],
          ),
        ),
      ],
    );
  }
}
