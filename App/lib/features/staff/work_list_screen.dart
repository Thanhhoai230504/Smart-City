import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_shell.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/paged_controller.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/paged_list_view.dart';
import '../../data/models/common.dart';
import '../../data/models/issue.dart';
import '../../data/repositories/issue_repository.dart';
import '../../data/repositories/meta_repository.dart';
import '../auth/auth_controller.dart';
import '../issues/issue_list_screen.dart';
import '../issues/widgets/issue_card.dart';

/// Mặc định: việc đang mở, ưu tiên cao trước.
final workQueryProvider = StateProvider.autoDispose<IssueQuery>(
  (ref) => const IssueQuery(sort: '-priorityScore'),
);

class WorkListController extends PagedController<Issue> {
  @override
  PagedState<Issue> build() {
    ref.watch(workQueryProvider);
    return super.build();
  }

  /// `/issues/work` — backend tự bó phạm vi về đơn vị của cán bộ, ghi đè mọi
  /// `departmentId` client gửi lên.
  @override
  Future<Paged<Issue>> fetchPage(int page, CancelToken cancel) =>
      ref.read(issueRepositoryProvider).work(ref.read(workQueryProvider), page: page, cancel: cancel);

  @override
  String idOf(Issue item) => item.id;
}

final workListProvider =
    AutoDisposeNotifierProvider<WorkListController, PagedState<Issue>>(WorkListController.new);

/// Tab "Công việc" của cán bộ — thay cho Trang chủ (design system mục 5).
class WorkListScreen extends ConsumerWidget {
  const WorkListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(workListProvider);
    final query = ref.watch(workQueryProvider);
    final user = ref.watch(currentUserProvider);
    final meta = ref.watch(metaProvider);
    final controller = ref.read(workListProvider.notifier);
    final textTheme = Theme.of(context).textTheme;

    void quick(IssueQuery Function(IssueQuery) change) =>
        ref.read(workQueryProvider.notifier).update(change);

    final header = Padding(
      padding: const EdgeInsets.only(bottom: Gap.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            user?.department?.name ?? 'Đơn vị của bạn',
            style: textTheme.bodySmall?.copyWith(color: context.palette.textSecondary),
          ),
          Gap.h8,
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                FilterChip(
                  label: Text(meta.slaLabel('overdue')),
                  avatar: const Icon(Icons.error_outline, size: 18),
                  selected: query.slaStatus == 'overdue',
                  onSelected: (on) => quick((q) => q.copyWith(slaStatus: on ? 'overdue' : null)),
                ),
                Gap.w8,
                FilterChip(
                  label: Text(meta.slaLabel('due_soon')),
                  avatar: const Icon(Icons.warning_amber, size: 18),
                  selected: query.slaStatus == 'due_soon',
                  onSelected: (on) => quick((q) => q.copyWith(slaStatus: on ? 'due_soon' : null)),
                ),
                Gap.w8,
                FilterChip(
                  label: const Text('Việc của tôi'),
                  avatar: const Icon(Icons.person_pin_circle_outlined, size: 18),
                  selected: query.assigneeId != null,
                  onSelected: (on) => quick((q) => q.copyWith(assigneeId: on ? user?.id : null)),
                ),
                Gap.w8,
                FilterChip(
                  label: const Text('Bị mở lại'),
                  avatar: const Icon(Icons.replay, size: 18),
                  selected: query.reopened,
                  onSelected: (on) => quick((q) => q.copyWith(reopened: on)),
                ),
              ],
            ),
          ),
        ],
      ),
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Công việc'),
        bottom: connectivityBar(context, ref),
        actions: [
          Badge(
            isLabelVisible: query.activeFilterCount > 0,
            label: Text('${query.activeFilterCount}'),
            child: IconButton(
              tooltip: 'Bộ lọc và sắp xếp',
              icon: const Icon(Icons.tune),
              onPressed: () => showIssueFilterSheet(
                context,
                ref,
                workQueryProvider,
                staffMode: true,
                currentUserId: user?.id,
              ),
            ),
          ),
        ],
      ),
      body: PagedListView<Issue>(
        state: state,
        header: header,
        onRefresh: controller.refresh,
        onLoadMore: controller.loadMore,
        itemBuilder: (context, issue) => IssueCard(
          issue: issue,
          showSla: true,
          showPriority: true,
          showAssignee: true,
          onTap: () => context.push(Routes.staffIssue(issue.id)),
        ),
        empty: EmptyState(
          icon: Icons.task_alt,
          title: query.hasFilters && query.sort == '-priorityScore' && query.activeFilterCount > 0
              ? 'Không có việc khớp bộ lọc'
              : 'Đơn vị chưa có việc nào',
          message: query.activeFilterCount > 0
              ? 'Thử bỏ bớt điều kiện lọc.'
              : 'Việc được quản trị viên phân công cho đơn vị sẽ hiện ở đây.',
          actionLabel: query.activeFilterCount > 0 ? 'Xoá bộ lọc' : 'Làm mới',
          onAction: () {
            if (query.activeFilterCount > 0) {
              ref.read(workQueryProvider.notifier).state = const IssueQuery(sort: '-priorityScore');
            } else {
              controller.refresh();
            }
          },
        ),
      ),
    );
  }
}
