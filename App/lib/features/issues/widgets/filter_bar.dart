import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_icons.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/issue.dart';
import '../../../data/repositories/issue_repository.dart';
import '../../../data/repositories/meta_repository.dart';

/// Kiểu sắp xếp — dùng chung cho sheet lọc và chip "đang lọc".
List<(String, String)> issueSortOptions({required bool staffMode}) => [
      ('-createdAt', 'Mới nhất'),
      ('createdAt', 'Cũ nhất'),
      ('-voteCount', 'Nhiều ủng hộ'),
      if (staffMode) ('-priorityScore', 'Ưu tiên cao'),
      if (staffMode) ('dueAt', 'Hạn gần nhất'),
    ];

String dateRangeLabel(DateTime? from, DateTime? to) {
  if (from != null && to != null) return '${Fmt.shortDate(from)} – ${Fmt.shortDate(to)}';
  if (from != null) return 'Từ ${Fmt.date(from)}';
  return 'Đến ${Fmt.date(to)}';
}

/// Đầu danh sách: chip trạng thái chạm một lần, chip các bộ lọc đang bật (bấm
/// ✕ để bỏ từng cái — như web), và số kết quả.
class IssueFilterBar extends ConsumerWidget {
  const IssueFilterBar({
    super.key,
    required this.provider,
    required this.total,
    required this.loading,
    this.staffMode = false,
    this.showStatusChips = true,
    this.onClearAll,
    this.defaultSort = '-createdAt',
  });

  final AutoDisposeStateProvider<IssueQuery> provider;
  final int total;
  final bool loading;
  final bool staffMode;
  final bool showStatusChips;

  /// Màn cha cần xoá cả ô tìm kiếm của nó khi bỏ hết bộ lọc.
  final VoidCallback? onClearAll;

  /// Kiểu sắp xếp mặc định của màn — không tính là "đang lọc" (cổng cán bộ
  /// mặc định xếp theo ưu tiên).
  final String defaultSort;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final q = ref.watch(provider);
    final meta = ref.watch(metaProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    void set(IssueQuery Function(IssueQuery) f) => ref.read(provider.notifier).update(f);

    final active = <(String, VoidCallback)>[
      if (q.category != null) (meta.categoryLabel(q.category!), () => set((x) => x.copyWith(category: null))),
      if (q.district != null)
        (
          meta.areas.where((a) => a.value == q.district).map((a) => a.label).firstOrNull ?? q.district!,
          () => set((x) => x.copyWith(district: null)),
        ),
      if (q.hasDateRange)
        (dateRangeLabel(q.dateFrom, q.dateTo), () => set((x) => x.copyWith(dateFrom: null, dateTo: null))),
      if (q.priorityLevel != null)
        ('Ưu tiên ${meta.priorityLabel(q.priorityLevel!).toLowerCase()}', () => set((x) => x.copyWith(priorityLevel: null))),
      if (q.slaStatus != null) (meta.slaLabel(q.slaStatus!), () => set((x) => x.copyWith(slaStatus: null))),
      if (q.assigneeId != null) ('Việc tôi đang nhận', () => set((x) => x.copyWith(assigneeId: null))),
      if (q.reopened) ('Bị mở lại', () => set((x) => x.copyWith(reopened: false))),
      if (q.sort != defaultSort)
        (
          issueSortOptions(staffMode: staffMode).where((o) => o.$1 == q.sort).map((o) => o.$2).firstOrNull ?? q.sort,
          () => set((x) => x.copyWith(sort: defaultSort)),
        ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showStatusChips)
          StatusFilterChips(
            selected: q.status,
            onSelected: (v) => set((x) => x.copyWith(status: v)),
          ),
        if (active.isNotEmpty) ...[
          Gap.h8,
          Wrap(
            spacing: Gap.sm,
            runSpacing: Gap.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              for (final (label, remove) in active)
                InputChip(
                  label: Text(label),
                  onDeleted: remove,
                  deleteButtonTooltipMessage: 'Bỏ lọc $label',
                ),
              TextButton(
                onPressed: () {
                  onClearAll?.call();
                  ref.read(provider.notifier).state =
                      IssueQuery(search: onClearAll == null ? q.search : null, sort: defaultSort);
                },
                child: const Text('Xoá lọc'),
              ),
            ],
          ),
        ],
        Padding(
          padding: const EdgeInsets.only(top: Gap.sm, bottom: Gap.xs),
          child: Text(
            loading ? 'Đang tải…' : '${Fmt.number(total)} sự cố',
            style: textTheme.labelMedium?.copyWith(color: palette.textSecondary),
          ),
        ),
      ],
    );
  }
}

/// Hàng chip trạng thái cuộn ngang: "Tất cả" + từng trạng thái kèm icon màu.
class StatusFilterChips extends ConsumerWidget {
  const StatusFilterChips({super.key, required this.selected, required this.onSelected});

  final String? selected;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = ref.watch(metaProvider);
    final palette = context.palette;
    return SizedBox(
      height: 48,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _StatusChoice(label: 'Tất cả', selected: selected == null, onTap: () => onSelected(null)),
          for (final s in meta.statuses)
            _StatusChoice(
              label: s.label,
              icon: AppIcons.status(IssueStatus.parse(s.value)),
              colors: palette.statusColors(IssueStatus.parse(s.value)),
              selected: selected == s.value,
              onTap: () => onSelected(s.value),
            ),
        ],
      ),
    );
  }
}

class _StatusChoice extends StatelessWidget {
  const _StatusChoice({
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
    this.colors,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;
  final ChipColors? colors;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(right: Gap.sm),
        child: ChoiceChip(
          showCheckmark: false,
          avatar: icon == null ? null : Icon(icon, size: 16, color: colors?.text),
          label: Text(label),
          selected: selected,
          onSelected: (_) => onTap(),
        ),
      );
}
