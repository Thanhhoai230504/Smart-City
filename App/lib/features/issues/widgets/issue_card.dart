import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_icons.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/photo_evidence_strip.dart';
import '../../../core/widgets/sla_countdown.dart';
import '../../../core/widgets/status_chips.dart';
import '../../../core/widgets/surfaces.dart';
import '../../../data/models/issue.dart';
import '../../../data/repositories/meta_repository.dart';

/// Card sự cố dùng chung (danh sách công khai, của tôi, việc của cán bộ).
/// **Không hardcode height** — card phải giãn được khi chữ phóng to 1.6×
/// (design system 4.3).
class IssueCard extends StatelessWidget {
  const IssueCard({
    super.key,
    required this.issue,
    required this.onTap,
    this.showSla = true,
    this.showPriority = false,
    this.showAssignee = false,
    this.showDepartment = true,
    this.trailing,
    this.footer,
  });

  final Issue issue;
  final VoidCallback onTap;

  /// Hạn xử lý — web hiện cả ở danh sách công khai để người dân biết khi nào
  /// phiếu được giải quyết.
  final bool showSla;
  final bool showPriority;
  final bool showAssignee;
  final bool showDepartment;
  final Widget? trailing;

  /// Hành động ngay trên card (ví dụ "Nhận việc" ở danh sách của cán bộ).
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final dept = issue.department?.name;

    Widget metaRow(IconData icon, String text) => Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(icon, size: 15, color: palette.textSecondary),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(text, style: textTheme.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
            ],
          ),
        );

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(Gap.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Thumb(issue: issue),
              Gap.w12,
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: CategoryLabel(
                            issue.category,
                            style: textTheme.labelMedium?.copyWith(color: palette.textSecondary),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(Fmt.relative(issue.createdAt), style: textTheme.bodySmall),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      issue.title,
                      style: textTheme.titleMedium,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (issue.location.isNotEmpty) metaRow(Icons.place_outlined, issue.location),
                    if (showDepartment && dept != null) metaRow(Icons.account_balance_outlined, dept),
                  ],
                ),
              ),
              ?trailing,
            ],
          ),
          Gap.h12,
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    StatusChip(issue.status, dense: true),
                    if (showPriority && issue.priorityLevel != null)
                      PriorityChip(issue.priorityLevel!, score: issue.priorityScore, dense: true),
                    if (showSla && issue.dueAt != null) SlaCountdown(issue: issue, dense: true),
                    if (issue.reopenCount > 0) ReopenedChip(issue.reopenCount, dense: true),
                  ],
                ),
              ),
              if (issue.voteCount > 0) ...[
                Gap.w8,
                Semantics(
                  label: '${issue.voteCount} người ủng hộ',
                  excludeSemantics: true,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.thumb_up_alt_outlined, size: 15, color: palette.textSecondary),
                      const SizedBox(width: 3),
                      Text(
                        '${issue.voteCount}',
                        style: textTheme.labelMedium?.copyWith(color: palette.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
          if (showAssignee) ...[
            Gap.h8,
            Row(
              children: [
                Icon(
                  issue.assignee == null ? Icons.person_add_alt_outlined : Icons.person_outline,
                  size: 16,
                  color: issue.assignee == null ? palette.primary : palette.textSecondary,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    issue.assignee?.name != null
                        ? 'Phụ trách: ${issue.assignee!.name}'
                        : issue.assignee != null
                            ? 'Đã có cán bộ nhận'
                            : 'Chưa có cán bộ nhận',
                    style: textTheme.bodySmall?.copyWith(
                      color: issue.assignee == null ? palette.primary : palette.textSecondary,
                      fontWeight: issue.assignee == null ? FontWeight.w600 : null,
                    ),
                  ),
                ),
              ],
            ),
          ],
          if (footer != null) ...[Gap.h12, footer!],
        ],
      ),
    );
  }
}

/// Ảnh bìa 88dp; phiếu không ảnh hiện ô màu của danh mục thay vì ô xám.
class _Thumb extends ConsumerWidget {
  const _Thumb({required this.issue});

  final Issue issue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = ref.watch(metaProvider).category(issue.category);
    final tone = CategoryTone.of(hexColor(c.color), context.palette);
    const size = 88.0;
    return ClipRRect(
      borderRadius: BorderRadius.circular(Radii.image),
      child: SizedBox.square(
        dimension: size,
        child: issue.coverUrl == null
            ? ColoredBox(
                color: tone.container,
                child: Icon(AppIcons.category(issue.category), color: tone.ink, size: 38),
              )
            : Stack(
                fit: StackFit.expand,
                children: [
                  AppImage(PhotoSource.url(issue.coverUrl!), semanticLabel: 'Ảnh sự cố ${issue.title}'),
                  Positioned(left: 6, bottom: 6, child: CategoryBadge(issue.category, size: 26)),
                ],
              ),
      ),
    );
  }
}
