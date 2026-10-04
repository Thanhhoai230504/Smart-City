import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/app_exception.dart';
import '../../core/platform/connectivity.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/paged_controller.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/offline_banner.dart';
import '../../core/widgets/paged_list_view.dart';
import '../../core/widgets/surfaces.dart';
import '../../data/models/common.dart';
import '../../data/models/issue.dart';
import '../../data/repositories/issue_repository.dart';
import '../auth/auth_controller.dart';
import '../home/home_screen.dart';
import '../issues/issue_list_screen.dart';
import '../issues/widgets/filter_bar.dart';
import '../issues/widgets/issue_card.dart';
import '../report/offline_queue.dart';

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

/// Số liệu đầu trang — đếm thật trên toàn đơn vị (mỗi ô một truy vấn `limit=1`
/// đọc `pagination.total`), không chỉ trên trang đang tải như web.
class WorkSummary {
  const WorkSummary({required this.mineInProgress, required this.overdue, required this.dueSoon});

  final int mineInProgress;
  final int overdue;
  final int dueSoon;
}

final workSummaryProvider = FutureProvider.autoDispose<WorkSummary>((ref) async {
  final repo = ref.read(issueRepositoryProvider);
  final me = ref.read(currentUserProvider)?.id;
  Future<int> count(IssueQuery q) async => (await repo.work(q, limit: 1)).pagination.total;
  final results = await Future.wait([
    if (me != null) count(IssueQuery(assigneeId: me, status: 'processing')) else Future.value(0),
    count(const IssueQuery(slaStatus: 'overdue')),
    count(const IssueQuery(slaStatus: 'due_soon')),
  ]);
  return WorkSummary(mineInProgress: results[0], overdue: results[1], dueSoon: results[2]);
});

/// Tab "Công việc" của cán bộ — thay cho Trang chủ (design system mục 5).
class WorkListScreen extends ConsumerStatefulWidget {
  const WorkListScreen({super.key});

  @override
  ConsumerState<WorkListScreen> createState() => _WorkListScreenState();
}

class _WorkListScreenState extends ConsumerState<WorkListScreen> {
  final Set<String> _claiming = {};

  Future<void> _refresh() async {
    ref.invalidate(workSummaryProvider);
    await ref.read(workListProvider.notifier).refresh();
  }

  /// "Nhận việc" ngay trên danh sách (như web) — không phải mở từng phiếu.
  Future<void> _claim(Issue issue) async {
    setState(() => _claiming.add(issue.id));
    try {
      await ref.read(issueRepositoryProvider).claim(issue.id);
      if (mounted) showAppSnack(context, 'Bạn đã nhận “${issue.title}”.');
      await _refresh();
    } on AppException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
      await _refresh();
    } finally {
      if (mounted) setState(() => _claiming.remove(issue.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(workListProvider);
    final query = ref.watch(workQueryProvider);
    final user = ref.watch(currentUserProvider);
    final online = ref.watch(isOnlineProvider);
    final pending = ref.watch(offlineQueueProvider.select((s) => s.count));
    final palette = context.palette;

    if (user != null && user.department == null) {
      return const Scaffold(
        body: SafeArea(
          child: EmptyState(
            icon: Icons.domain_disabled_outlined,
            title: 'Tài khoản chưa thuộc đơn vị nào',
            message: 'Quản trị viên cần gán bạn vào một đơn vị xử lý thì danh sách công việc mới hiện ở đây.',
          ),
        ),
      );
    }

    return Scaffold(
      body: PagedListView<Issue>(
        state: state,
        onRefresh: _refresh,
        onLoadMore: ref.read(workListProvider.notifier).loadMore,
        padding: const EdgeInsets.only(bottom: 120),
        header: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            _WorkHero(total: state.pagination.total, loading: state.isLoading),
            if (OfflineBanner.isVisible(online: online, pendingCount: pending))
              Padding(
                padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.md, Gap.screen, 0),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(Radii.tile),
                  child: OfflineBanner(
                    online: online,
                    pendingCount: pending,
                    onTap: pending > 0 ? () => context.push(Routes.pendingReports) : null,
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.lg, Gap.screen, 0),
              child: Row(
                children: [
                  Expanded(child: Text('Danh sách việc', style: Theme.of(context).textTheme.titleLarge)),
                  Badge(
                    isLabelVisible: query.activeFilterCount > 0,
                    label: Text('${query.activeFilterCount}'),
                    child: IconButton.filledTonal(
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
            ),
            Padding(
              padding: Gap.screenPadding,
              child: IssueFilterBar(
                provider: workQueryProvider,
                total: state.pagination.total,
                loading: state.isLoading,
                staffMode: true,
                defaultSort: '-priorityScore',
              ),
            ),
            Gap.h4,
          ],
        ),
        itemBuilder: (context, issue) {
          final claimable = issue.assignee == null && issue.status.isOpen;
          final claiming = _claiming.contains(issue.id);
          return Padding(
            padding: Gap.screenPadding,
            child: IssueCard(
              issue: issue,
              showSla: true,
              showPriority: true,
              showAssignee: true,
              showDepartment: false,
              onTap: () => context.push(Routes.staffIssue(issue.id)),
              footer: claimable
                  ? Align(
                      alignment: Alignment.centerRight,
                      child: FilledButton.tonalIcon(
                        onPressed: claiming || _claiming.isNotEmpty ? null : () => _claim(issue),
                        style: FilledButton.styleFrom(minimumSize: const Size(kMinTouchTarget, 44)),
                        icon: claiming
                            ? const SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2))
                            : Icon(Icons.play_circle_outline, color: palette.success.text),
                        label: const Text('Nhận việc'),
                      ),
                    )
                  : null,
            ),
          );
        },
        empty: Padding(
          padding: Gap.screenPadding,
          child: EmptyState(
            icon: Icons.task_alt,
            title: query.activeFilterCount > 0 ? 'Không có việc khớp bộ lọc' : 'Đơn vị chưa có việc nào',
            message: query.activeFilterCount > 0
                ? 'Thử bỏ bớt điều kiện lọc.'
                : 'Việc được quản trị viên phân công cho đơn vị sẽ hiện ở đây.',
            actionLabel: query.activeFilterCount > 0 ? 'Xoá bộ lọc' : 'Làm mới',
            onAction: () {
              if (query.activeFilterCount > 0) {
                ref.read(workQueryProvider.notifier).state = const IssueQuery(sort: '-priorityScore');
              } else {
                _refresh();
              }
            },
          ),
        ),
      ),
    );
  }
}

/// Header của cán bộ: đơn vị, lời chào, 4 ô số liệu (chạm để lọc nhanh) và lối
/// tắt tới các trang công khai — trước đây cán bộ không có đường vào chúng.
class _WorkHero extends ConsumerWidget {
  const _WorkHero({required this.total, required this.loading});

  final int total;
  final bool loading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final summary = ref.watch(workSummaryProvider).valueOrNull;
    final query = ref.watch(workQueryProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final dept = user?.department;
    void apply(IssueQuery q) => ref.read(workQueryProvider.notifier).state = q;
    String n(int? v) => v == null ? '—' : Fmt.number(v);

    Widget tile(String value, String label, IconData icon, {required bool selected, required VoidCallback onTap}) =>
        Expanded(
          child: Semantics(
            button: true,
            selected: selected,
            label: '$label: $value',
            excludeSemantics: true,
            child: GestureDetector(
              onTap: onTap,
              child: AnimatedContainer(
                duration: Motion.of(context, Motion.fast),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(Radii.tile),
                  border: Border.all(color: selected ? palette.onBrand : Colors.transparent, width: 2),
                ),
                child: GlassTile(value: value, label: label, icon: icon),
              ),
            ),
          ),
        );

    return HeroHeader(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: palette.onBrand.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.engineering_outlined, color: palette.onBrand, size: 24),
              ),
              Gap.w12,
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Công việc', style: textTheme.labelMedium?.copyWith(color: palette.onBrandMuted)),
                    Text(
                      dept?.name ?? 'Đơn vị của bạn',
                      style: textTheme.titleMedium?.copyWith(color: palette.onBrand),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (dept?.code != null)
                      Text('Mã ${dept!.code}', style: textTheme.bodySmall?.copyWith(color: palette.onBrandMuted)),
                  ],
                ),
              ),
            ],
          ),
          Gap.h16,
          Text(homeGreeting(user?.name), style: textTheme.headlineSmall?.copyWith(color: palette.onBrand)),
          Text(
            'Ưu tiên việc quá hạn và sắp đến hạn trước.',
            style: textTheme.bodyMedium?.copyWith(color: palette.onBrandMuted),
          ),
          Gap.h16,
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                tile(loading ? '—' : Fmt.number(total), 'Trong bộ lọc', Icons.inbox_outlined,
                    selected: false, onTap: () => apply(const IssueQuery(sort: '-priorityScore'))),
                Gap.w8,
                tile(n(summary?.mineInProgress), 'Tôi đang làm', Icons.person_pin_circle_outlined,
                    selected: query.assigneeId != null && query.status == 'processing',
                    onTap: () => apply(IssueQuery(sort: '-priorityScore', assigneeId: user?.id, status: 'processing'))),
                Gap.w8,
                tile(n(summary?.overdue), 'Quá hạn', Icons.error_outline,
                    selected: query.slaStatus == 'overdue',
                    onTap: () => apply(const IssueQuery(sort: '-priorityScore', slaStatus: 'overdue'))),
                Gap.w8,
                tile(n(summary?.dueSoon), 'Sắp đến hạn', Icons.warning_amber,
                    selected: query.slaStatus == 'due_soon',
                    onTap: () => apply(const IssueQuery(sort: 'dueAt', slaStatus: 'due_soon'))),
              ],
            ),
          ),
          Gap.h16,
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final (icon, label, route) in [
                  (Icons.view_list_outlined, 'Sự cố công khai', Routes.issues),
                  (Icons.insights_outlined, 'Thống kê', Routes.statistics),
                  (Icons.videocam_outlined, 'Camera', Routes.cameras),
                  (Icons.support_agent, 'Trợ lý AI', Routes.chatbot),
                ]) ...[
                  // Nút "kính mờ" tự vẽ: ActionChip M3 bỏ qua nền trong suốt và
                  // tô trắng, làm chữ trắng biến mất trên header.
                  Material(
                    color: palette.onBrand.withValues(alpha: 0.12),
                    shape: StadiumBorder(side: BorderSide(color: palette.onBrand.withValues(alpha: 0.24))),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => context.push(route),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(icon, size: 18, color: palette.onBrand),
                            const SizedBox(width: 6),
                            Text(label, style: textTheme.labelMedium?.copyWith(color: palette.onBrand)),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Gap.w8,
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
