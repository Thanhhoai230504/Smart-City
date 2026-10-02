import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/photo_evidence_strip.dart';
import '../../../core/widgets/sla_countdown.dart';
import '../../../core/widgets/status_chips.dart';
import '../../../data/models/issue.dart';
import '../../../data/repositories/meta_repository.dart';

/// Card sự cố dùng chung (danh sách công khai, của tôi, việc của cán bộ).
/// **Không hardcode height** — card phải giãn được khi chữ phóng to 1.6×
/// (design system 4.3).
class IssueCard extends ConsumerWidget {
  const IssueCard({
    super.key,
    required this.issue,
    required this.onTap,
    this.showSla = false,
    this.showPriority = false,
    this.showAssignee = false,
    this.trailing,
  });

  final Issue issue;
  final VoidCallback onTap;
  final bool showSla;
  final bool showPriority;
  final bool showAssignee;
  final Widget? trailing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = ref.watch(metaProvider);
    final category = meta.category(issue.category);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(Gap.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(Radii.image),
                    child: SizedBox.square(
                      dimension: 72,
                      child: issue.coverUrl != null
                          ? AppImage(PhotoSource.url(issue.coverUrl!),
                              semanticLabel: 'Ảnh sự cố ${issue.title}')
                          : ColoredBox(
                              color: palette.surfaceAlt,
                              child: Center(
                                child: Text(category.icon, style: const TextStyle(fontSize: 28)),
                              ),
                            ),
                    ),
                  ),
                  Gap.w12,
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          issue.title,
                          style: textTheme.titleMedium,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Gap.h4,
                        Text(
                          '${category.icon} ${category.label} · ${Fmt.relative(issue.createdAt)}',
                          style: textTheme.bodySmall,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (issue.location.isNotEmpty) ...[
                          Gap.h4,
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(Icons.place_outlined, size: 16, color: palette.textSecondary),
                              const SizedBox(width: 2),
                              Expanded(
                                child: Text(
                                  issue.location,
                                  style: textTheme.bodySmall,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  ?trailing,
                ],
              ),
              Gap.h8,
              Wrap(
                spacing: Gap.sm,
                runSpacing: Gap.xs,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  StatusChip(issue.status, dense: true),
                  if (showPriority && issue.priorityLevel != null)
                    PriorityChip(issue.priorityLevel!, score: issue.priorityScore, dense: true),
                  if (showSla && issue.dueAt != null) SlaCountdown(issue: issue, dense: true),
                  if (issue.reopenCount > 0) ReopenedChip(issue.reopenCount, dense: true),
                  if (issue.voteCount > 0)
                    Semantics(
                      label: '${issue.voteCount} người ủng hộ',
                      excludeSemantics: true,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.thumb_up_alt_outlined, size: 14, color: palette.textSecondary),
                          const SizedBox(width: 2),
                          Text('${issue.voteCount}', style: textTheme.labelSmall?.copyWith(color: palette.textSecondary)),
                        ],
                      ),
                    ),
                ],
              ),
              if (showAssignee) ...[
                Gap.h8,
                Text(
                  issue.assignee?.name != null
                      ? 'Cán bộ phụ trách: ${issue.assignee!.name}'
                      : issue.assignee != null
                          ? 'Đã có cán bộ nhận'
                          : 'Chưa có cán bộ nhận',
                  style: textTheme.bodySmall?.copyWith(
                    color: issue.assignee == null ? palette.primary : palette.textSecondary,
                    fontWeight: issue.assignee == null ? FontWeight.w600 : null,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
