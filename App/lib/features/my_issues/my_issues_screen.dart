import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/app_exception.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/paged_controller.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/paged_list_view.dart';
import '../../core/widgets/surfaces.dart';
import '../../data/models/common.dart';
import '../../data/models/issue.dart';
import '../../data/repositories/issue_repository.dart';
import '../../data/repositories/meta_repository.dart';
import '../issues/widgets/filter_bar.dart';
import '../issues/widgets/issue_card.dart';
import '../report/offline_queue.dart';

final myStatusFilterProvider = StateProvider.autoDispose<String?>((ref) => null);

class MyIssuesController extends PagedController<Issue> {
  @override
  PagedState<Issue> build() {
    ref.watch(myStatusFilterProvider);
    // Hàng đợi vừa gửi xong phiếu nào thì danh sách cũng phải thấy.
    ref.listen(offlineQueueProvider.select((s) => s.lastSent.length), (_, _) => refresh());
    return super.build();
  }

  @override
  Future<Paged<Issue>> fetchPage(int page, CancelToken cancel) =>
      ref.read(issueRepositoryProvider).mine(status: ref.read(myStatusFilterProvider), page: page);

  @override
  String idOf(Issue item) => item.id;
}

final myIssuesProvider =
    AutoDisposeNotifierProvider<MyIssuesController, PagedState<Issue>>(MyIssuesController.new);

/// "Sự cố của tôi" (task 3.7). Sửa/xoá **chỉ khi `status === 'reported'`** —
/// đúng ràng buộc backend; phiếu `processing` không hiện nút sửa.
class MyIssuesScreen extends ConsumerWidget {
  const MyIssuesScreen({super.key});

  Future<void> _actions(BuildContext context, WidgetRef ref, Issue issue) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.visibility_outlined),
              title: const Text('Xem chi tiết'),
              onTap: () => Navigator.pop(ctx, 'view'),
            ),
            if (issue.isEditableByReporter) ...[
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: const Text('Sửa tiêu đề, mô tả'),
                onTap: () => Navigator.pop(ctx, 'edit'),
              ),
              ListTile(
                leading: const Icon(Icons.delete_outline),
                title: const Text('Xoá báo cáo'),
                onTap: () => Navigator.pop(ctx, 'delete'),
              ),
            ] else
              const ListTile(
                leading: Icon(Icons.lock_outline),
                title: Text('Không sửa được nữa'),
                subtitle: Text('Phiếu đã được tiếp nhận nên chỉ sửa/xoá được khi còn "Mới báo cáo".'),
              ),
          ],
        ),
      ),
    );
    if (!context.mounted || action == null) return;
    switch (action) {
      case 'view':
        await context.push(Routes.issue(issue.id));
      case 'edit':
        final updated = await showModalBottomSheet<Issue>(
          context: context,
          isScrollControlled: true,
          builder: (_) => _EditSheet(issue: issue),
        );
        if (updated != null) await ref.read(myIssuesProvider.notifier).refresh();
      case 'delete':
        final ok = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Xoá báo cáo?'),
            content: Text('“${issue.title}” sẽ bị xoá cùng ảnh đính kèm.'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Xoá')),
            ],
          ),
        );
        if (ok != true) return;
        try {
          await ref.read(issueRepositoryProvider).deleteMine(issue.id);
          ref.read(myIssuesProvider.notifier).removeWhere((i) => i.id == issue.id);
          if (context.mounted) showAppSnack(context, 'Đã xoá báo cáo');
        } on AppException catch (e) {
          if (context.mounted) showAppSnack(context, e.message, error: true);
        }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(myIssuesProvider);
    final filter = ref.watch(myStatusFilterProvider);
    final palette = context.palette;
    final queue = ref.watch(offlineQueueProvider);
    final controller = ref.read(myIssuesProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sự cố của tôi'),
        actions: [
          IconButton(
            tooltip: 'Báo cáo sự cố mới',
            onPressed: () => context.push(Routes.report),
            icon: const Icon(Icons.add_a_photo_outlined),
          ),
        ],
      ),
      body: PagedListView<Issue>(
        state: state,
        onRefresh: controller.refresh,
        onLoadMore: controller.loadMore,
        header: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (queue.count > 0) ...[
              AppCard(
                color: palette.offline.container,
                borderColor: Colors.transparent,
                elevated: false,
                onTap: () => context.push(Routes.pendingReports),
                child: Row(
                  children: [
                    Icon(Icons.schedule_send_outlined, color: palette.offline.text),
                    Gap.w12,
                    Expanded(
                      child: Text(
                        '${queue.count} báo cáo chưa gửi lên máy chủ',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(color: palette.offline.text),
                      ),
                    ),
                    Icon(Icons.chevron_right, color: palette.offline.text),
                  ],
                ),
              ),
              Gap.h8,
            ],
            StatusFilterChips(
              selected: filter,
              onSelected: (v) => ref.read(myStatusFilterProvider.notifier).state = v,
            ),
            Gap.h8,
          ],
        ),
        itemBuilder: (context, issue) => IssueCard(
          issue: issue,
          onTap: () => context.push(Routes.issue(issue.id)),
          trailing: IconButton(
            tooltip: 'Thao tác với “${issue.title}”',
            icon: const Icon(Icons.more_vert),
            onPressed: () => _actions(context, ref, issue),
          ),
        ),
        empty: EmptyState(
          icon: Icons.assignment_outlined,
          title: filter == null ? 'Bạn chưa báo cáo sự cố nào' : 'Không có phiếu ở trạng thái này',
          message: filter == null ? 'Thấy ổ gà, ngập nước, đèn hỏng? Báo ngay — chỉ mất một phút.' : null,
          actionLabel: filter == null ? 'Báo cáo sự cố' : 'Xem tất cả',
          onAction: () => filter == null
              ? context.push(Routes.report)
              : ref.read(myStatusFilterProvider.notifier).state = null,
        ),
      ),
    );
  }
}

class _EditSheet extends ConsumerStatefulWidget {
  const _EditSheet({required this.issue});

  final Issue issue;

  @override
  ConsumerState<_EditSheet> createState() => _EditSheetState();
}

class _EditSheetState extends ConsumerState<_EditSheet> {
  late final _title = TextEditingController(text: widget.issue.title);
  late final _description = TextEditingController(text: widget.issue.description);
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_title.text.trim().isEmpty || _description.text.trim().isEmpty) {
      setState(() => _error = 'Tiêu đề và mô tả không được để trống');
      return;
    }
    setState(() => _busy = true);
    try {
      final updated = await ref
          .read(issueRepositoryProvider)
          .updateMine(widget.issue.id, title: _title.text, description: _description.text);
      if (mounted) Navigator.pop(context, updated);
    } on AppException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final limits = ref.watch(metaProvider).limits;
    return Padding(
      padding: EdgeInsets.fromLTRB(Gap.screen, 0, Gap.screen, MediaQuery.viewInsetsOf(context).bottom + Gap.lg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Sửa báo cáo', style: Theme.of(context).textTheme.titleLarge),
          Gap.h12,
          TextField(
            controller: _title,
            maxLength: limits.maxTitleLength,
            decoration: const InputDecoration(labelText: 'Tiêu đề'),
          ),
          TextField(
            controller: _description,
            maxLength: limits.maxDescriptionLength,
            minLines: 3,
            maxLines: 6,
            decoration: InputDecoration(labelText: 'Mô tả', errorText: _error),
          ),
          Gap.h8,
          SizedBox(
            width: double.infinity,
            child: FilledButton(onPressed: _busy ? null : _save, child: const Text('Lưu')),
          ),
        ],
      ),
    );
  }
}
