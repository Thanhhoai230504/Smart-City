import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/route_guard.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/debouncer.dart';
import '../../core/utils/paged_controller.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/paged_list_view.dart';
import '../../data/models/common.dart';
import '../../data/models/issue.dart';
import '../../data/repositories/issue_repository.dart';
import '../../data/repositories/meta_repository.dart';
import 'widgets/issue_card.dart';

final issueQueryProvider = StateProvider.autoDispose<IssueQuery>((ref) => const IssueQuery());

class IssueListController extends PagedController<Issue> {
  @override
  PagedState<Issue> build() {
    ref.watch(issueQueryProvider); // đổi bộ lọc → build lại → tải trang 1
    return super.build();
  }

  @override
  Future<Paged<Issue>> fetchPage(int page, CancelToken cancel) => ref
      .read(issueRepositoryProvider)
      .list(ref.read(issueQueryProvider), page: page, cancel: cancel);

  @override
  String idOf(Issue item) => item.id;
}

final issueListProvider =
    AutoDisposeNotifierProvider<IssueListController, PagedState<Issue>>(IssueListController.new);

/// Danh sách sự cố công khai (task 2.2): tìm kiếm + bộ lọc trong **bottom sheet**
/// (không phải panel như web) + infinite scroll.
class IssueListScreen extends ConsumerStatefulWidget {
  const IssueListScreen({super.key});

  @override
  ConsumerState<IssueListScreen> createState() => _IssueListScreenState();
}

class _IssueListScreenState extends ConsumerState<IssueListScreen> {
  final _search = TextEditingController();
  final _debounce = Debouncer(const Duration(milliseconds: 400));

  @override
  void dispose() {
    _debounce.cancel();
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(issueListProvider);
    final query = ref.watch(issueQueryProvider);
    final controller = ref.read(issueListProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sự cố trong thành phố'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(64),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(Gap.screen, 0, Gap.screen, Gap.sm),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _search,
                    textInputAction: TextInputAction.search,
                    onChanged: (v) => _debounce(() {
                      ref.read(issueQueryProvider.notifier).update((q) => q.copyWith(search: v));
                    }),
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      hintText: 'Tìm theo tiêu đề, mô tả…',
                      isDense: true,
                    ),
                  ),
                ),
                Gap.w8,
                Badge(
                  isLabelVisible: query.activeFilterCount > 0,
                  label: Text('${query.activeFilterCount}'),
                  child: IconButton.outlined(
                    tooltip: 'Bộ lọc và sắp xếp',
                    onPressed: () => showIssueFilterSheet(context, ref, issueQueryProvider),
                    icon: const Icon(Icons.tune),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      body: PagedListView<Issue>(
        state: state,
        onRefresh: controller.refresh,
        onLoadMore: controller.loadMore,
        itemBuilder: (context, issue) => IssueCard(
          issue: issue,
          onTap: () => context.push(Routes.issue(issue.id)),
        ),
        empty: EmptyState(
          icon: Icons.search_off,
          title: query.hasFilters ? 'Không có sự cố khớp bộ lọc' : 'Chưa có sự cố nào',
          message: query.hasFilters ? 'Thử bỏ bớt điều kiện lọc.' : 'Hãy là người đầu tiên báo cáo.',
          actionLabel: query.hasFilters ? 'Xoá bộ lọc' : 'Báo cáo sự cố',
          onAction: () {
            if (query.hasFilters) {
              _search.clear();
              ref.read(issueQueryProvider.notifier).state = const IssueQuery();
            } else {
              context.push(Routes.report);
            }
          },
        ),
      ),
    );
  }
}

/// Bottom sheet lọc — dùng chung cho danh sách công khai và cổng cán bộ.
Future<void> showIssueFilterSheet(
  BuildContext context,
  WidgetRef ref,
  AutoDisposeStateProvider<IssueQuery> provider, {
  bool staffMode = false,
  String? currentUserId,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => _FilterSheet(
      initial: ref.read(provider),
      staffMode: staffMode,
      currentUserId: currentUserId,
      onApply: (q) => ref.read(provider.notifier).state = q,
    ),
  );
}

class _FilterSheet extends ConsumerStatefulWidget {
  const _FilterSheet({
    required this.initial,
    required this.onApply,
    required this.staffMode,
    this.currentUserId,
  });

  final IssueQuery initial;
  final ValueChanged<IssueQuery> onApply;
  final bool staffMode;
  final String? currentUserId;

  @override
  ConsumerState<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends ConsumerState<_FilterSheet> {
  late IssueQuery _q = widget.initial;

  @override
  Widget build(BuildContext context) {
    final meta = ref.watch(metaProvider);
    final textTheme = Theme.of(context).textTheme;

    Widget section(String title, List<Widget> chips) => Padding(
          padding: const EdgeInsets.only(bottom: Gap.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: textTheme.titleSmall),
              Gap.h8,
              Wrap(spacing: Gap.sm, runSpacing: Gap.sm, children: chips),
            ],
          ),
        );

    ChoiceChip choice(String label, bool selected, VoidCallback onTap) =>
        ChoiceChip(label: Text(label), selected: selected, onSelected: (_) => onTap());

    final sorts = <(String, String)>[
      ('-createdAt', 'Mới nhất'),
      ('createdAt', 'Cũ nhất'),
      ('-voteCount', 'Nhiều ủng hộ'),
      if (widget.staffMode) ('-priorityScore', 'Ưu tiên cao'),
      if (widget.staffMode) ('dueAt', 'Hạn gần nhất'),
    ];

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      builder: (context, scroll) => Column(
        children: [
          Expanded(
            child: ListView(
              controller: scroll,
              padding: const EdgeInsets.fromLTRB(Gap.screen, 0, Gap.screen, Gap.lg),
              children: [
                Text('Bộ lọc', style: textTheme.titleLarge),
                Gap.h16,
                if (widget.staffMode)
                  section('Phân công', [
                    choice('Tất cả việc của đơn vị', _q.assigneeId == null,
                        () => setState(() => _q = _q.copyWith(assigneeId: null))),
                    if (widget.currentUserId != null)
                      choice('Việc tôi đang nhận', _q.assigneeId == widget.currentUserId,
                          () => setState(() => _q = _q.copyWith(assigneeId: widget.currentUserId))),
                  ]),
                if (widget.staffMode)
                  section('Hạn xử lý', [
                    choice('Tất cả', _q.slaStatus == null,
                        () => setState(() => _q = _q.copyWith(slaStatus: null))),
                    choice(meta.slaLabel('overdue'), _q.slaStatus == 'overdue',
                        () => setState(() => _q = _q.copyWith(slaStatus: 'overdue'))),
                    choice(meta.slaLabel('due_soon'), _q.slaStatus == 'due_soon',
                        () => setState(() => _q = _q.copyWith(slaStatus: 'due_soon'))),
                    choice('Bị người dân mở lại', _q.reopened,
                        () => setState(() => _q = _q.copyWith(reopened: !_q.reopened))),
                  ]),
                section('Trạng thái', [
                  choice('Tất cả', _q.status == null, () => setState(() => _q = _q.copyWith(status: null))),
                  for (final s in meta.statuses)
                    choice(s.label, _q.status == s.value,
                        () => setState(() => _q = _q.copyWith(status: s.value))),
                ]),
                if (widget.staffMode)
                  section('Mức ưu tiên', [
                    choice('Tất cả', _q.priorityLevel == null,
                        () => setState(() => _q = _q.copyWith(priorityLevel: null))),
                    for (final p in meta.priorities.reversed)
                      choice(p.label, _q.priorityLevel == p.value,
                          () => setState(() => _q = _q.copyWith(priorityLevel: p.value))),
                  ]),
                section('Loại sự cố', [
                  choice('Tất cả', _q.category == null,
                      () => setState(() => _q = _q.copyWith(category: null))),
                  for (final c in meta.categories)
                    choice('${c.icon} ${c.label}', _q.category == c.value,
                        () => setState(() => _q = _q.copyWith(category: c.value))),
                ]),
                if (!widget.staffMode)
                  section('Khu vực', [
                    choice('Tất cả', _q.district == null,
                        () => setState(() => _q = _q.copyWith(district: null))),
                    for (final a in meta.areas)
                      choice(a.label, _q.district == a.value,
                          () => setState(() => _q = _q.copyWith(district: a.value))),
                  ]),
                section('Sắp xếp', [
                  for (final (value, label) in sorts)
                    choice(label, _q.sort == value, () => setState(() => _q = _q.copyWith(sort: value))),
                ]),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.screen, Gap.md),
              child: Row(
                children: [
                  OutlinedButton(
                    onPressed: () => setState(() => _q = IssueQuery(search: _q.search)),
                    child: const Text('Đặt lại'),
                  ),
                  Gap.w12,
                  Expanded(
                    child: FilledButton(
                      onPressed: () {
                        widget.onApply(_q);
                        Navigator.pop(context);
                      },
                      child: const Text('Áp dụng'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
