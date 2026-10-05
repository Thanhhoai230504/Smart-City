import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/app_exception.dart';
import '../../core/platform/connectivity.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/feature_styles.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/paged_controller.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/offline_banner.dart';
import '../../core/widgets/paged_list_view.dart';
import '../../core/widgets/surfaces.dart';
import '../../data/models/common.dart';
import '../../data/models/issue.dart';
import '../../data/repositories/issue_repository.dart';
import '../../data/repositories/meta_repository.dart';
import '../auth/auth_controller.dart';
import '../home/home_screen.dart';
import '../issues/issue_list_screen.dart';
import '../issues/issue_rules.dart';
import '../issues/widgets/filter_bar.dart';
import '../issues/widgets/issue_card.dart';
import '../report/offline_queue.dart';
import 'status_change.dart';

/// Hai tab của cổng cán bộ: mọi việc của đơn vị, và những phiếu chính mình đã
/// nhận — nơi cập nhật trạng thái / báo hoàn tất nhanh nhất.
enum WorkScope { department, mine }

final workScopeProvider = StateProvider.autoDispose<WorkScope>((ref) => WorkScope.department);

/// Bộ lọc gốc của từng tab — "Xoá lọc" quay về đây. Tab "Việc của tôi" khoá
/// người phụ trách là chính mình. Cả hai xếp ưu tiên cao trước; phiếu đã đóng
/// không còn điểm ưu tiên nên tự xuống cuối.
IssueQuery workBaseQuery(WorkScope scope, String? me) => switch (scope) {
      WorkScope.department => const IssueQuery(sort: '-priorityScore'),
      WorkScope.mine => IssueQuery(sort: '-priorityScore', assigneeId: me),
    };

/// Bộ lọc riêng của từng tab — đổi tab không làm mất bộ lọc của tab kia.
final workQueryProvider = StateProvider.autoDispose.family<IssueQuery, WorkScope>(
  (ref, scope) => workBaseQuery(scope, ref.watch(currentUserProvider.select((u) => u?.id))),
);

class WorkListController extends PagedController<Issue> {
  @override
  PagedState<Issue> build() {
    ref.watch(workQueryProvider(ref.watch(workScopeProvider)));
    return super.build();
  }

  /// `/issues/work` — backend tự bó phạm vi về đơn vị của cán bộ, ghi đè mọi
  /// `departmentId` client gửi lên.
  @override
  Future<Paged<Issue>> fetchPage(int page, CancelToken cancel) => ref
      .read(issueRepositoryProvider)
      .work(ref.read(workQueryProvider(ref.read(workScopeProvider))), page: page, cancel: cancel);

  @override
  String idOf(Issue item) => item.id;
}

final workListProvider =
    AutoDisposeNotifierProvider<WorkListController, PagedState<Issue>>(WorkListController.new);

/// Số liệu đầu trang — đếm thật trên toàn đơn vị (mỗi ô một truy vấn `limit=1`
/// đọc `pagination.total`), không chỉ trên trang đang tải như web.
class WorkSummary {
  const WorkSummary({required this.mineOpen, required this.overdue, required this.dueSoon});

  /// Phiếu mình đang giữ mà chưa đóng: đã nhận (còn "Chờ tiếp nhận") + đang xử lý.
  final int mineOpen;
  final int overdue;
  final int dueSoon;
}

final workSummaryProvider = FutureProvider.autoDispose<WorkSummary>((ref) async {
  final repo = ref.read(issueRepositoryProvider);
  final me = ref.watch(currentUserProvider.select((u) => u?.id));
  Future<int> count(IssueQuery q) async => (await repo.work(q, limit: 1)).pagination.total;
  // `/issues/work` chỉ lọc được một trạng thái mỗi lần → đếm riêng rồi cộng.
  final results = await Future.wait([
    if (me != null) ...[
      count(IssueQuery(assigneeId: me, status: 'reported')),
      count(IssueQuery(assigneeId: me, status: 'processing')),
    ] else ...[
      Future.value(0),
      Future.value(0),
    ],
    count(const IssueQuery(slaStatus: 'overdue')),
    count(const IssueQuery(slaStatus: 'due_soon')),
  ]);
  return WorkSummary(mineOpen: results[0] + results[1], overdue: results[2], dueSoon: results[3]);
});

/// Nhận việc, đổi trạng thái, sự kiện realtime → tải lại danh sách và số liệu.
void invalidateWork(void Function(ProviderOrFamily provider) invalidate) {
  invalidate(workListProvider);
  invalidate(workSummaryProvider);
}

/// Chuyển tab; `filter` (nếu có) đặt bộ lọc của tab đích tính từ bộ lọc gốc.
void showWorkScope(WidgetRef ref, WorkScope scope, {IssueQuery Function(IssueQuery base)? filter}) {
  if (filter != null) {
    final base = workBaseQuery(scope, ref.read(currentUserProvider)?.id);
    ref.read(workQueryProvider(scope).notifier).state = filter(base);
  }
  ref.read(workScopeProvider.notifier).state = scope;
}

/// Tab "Công việc" của cán bộ — thay cho Trang chủ (design system mục 5).
class WorkListScreen extends ConsumerStatefulWidget {
  const WorkListScreen({super.key});

  @override
  ConsumerState<WorkListScreen> createState() => _WorkListScreenState();
}

class _WorkListScreenState extends ConsumerState<WorkListScreen> {
  /// Phiếu đang chờ server (nhận việc / đổi trạng thái) — khoá nút trên các thẻ.
  final Set<String> _busy = {};

  Future<void> _refresh() async {
    ref.invalidate(workSummaryProvider);
    await ref.read(workListProvider.notifier).refresh();
  }

  /// Chạy một thao tác trên phiếu. Lỗi (người khác vừa nhận, phiếu vừa đổi ở
  /// nơi khác…) thì báo rồi tải lại để thấy trạng thái mới nhất.
  Future<void> _run(Issue issue, Future<void> Function() action) async {
    setState(() => _busy.add(issue.id));
    try {
      await action();
    } on AppException catch (e) {
      if (mounted) showAppSnack(context, explainStaffError(e), error: true);
      if (mounted) await _refresh();
    } finally {
      if (mounted) setState(() => _busy.remove(issue.id));
    }
  }

  /// "Nhận việc" ngay trên danh sách (như web) — không phải mở từng phiếu.
  Future<void> _claim(Issue issue) => _run(issue, () async {
        await ref.read(issueRepositoryProvider).claim(issue.id);
        if (!mounted) return;
        showAppSnack(context, 'Bạn đã nhận “${issue.title}”. Phiếu nằm trong tab “Việc của tôi”.');
        await _refresh();
      });

  Future<void> _changeStatus(Issue issue, IssueStatus target) async {
    // Hoàn tất cần ảnh minh chứng; màn đó tự làm mới danh sách khi xong. Thẻ
    // danh sách thiếu ảnh (backend bỏ `images`/`resolutionImages` ở danh sách)
    // → lấy bản đầy đủ, để ảnh đã tải lên lần trước không phải chụp lại.
    if (target == IssueStatus.resolved) {
      Issue? full;
      await _run(issue, () async => full = await ref.read(issueRepositoryProvider).detail(issue.id));
      final loaded = full;
      if (loaded != null && mounted) await openResolveFlow(context, loaded);
      return;
    }
    final note = await askStatusNote(context, target);
    if (note == null || !mounted) return;
    final label = ref.read(metaProvider).statusLabel(target.name);
    await _run(issue, () async {
      await ref.read(issueRepositoryProvider).updateStatus(issue.id, target, note: note);
      if (!mounted) return;
      showAppSnack(context, 'Đã chuyển “${issue.title}” sang “$label”.');
      await _refresh();
    });
  }

  Future<void> _pickStatus(Issue issue) async {
    final target = await pickStatusTarget(context, issue, ref.read(metaProvider));
    if (target != null && mounted) await _changeStatus(issue, target);
  }

  /// Thao tác ngay trên thẻ: phiếu chưa ai nhận → "Nhận việc"; phiếu của mình
  /// còn mở → "Cập nhật" + "Hoàn tất". Như web, phiếu người khác giữ chỉ xem.
  Widget? _actions(Issue issue, {required String? me, required String? departmentId}) {
    if (!issue.status.isOpen || !staffCanHandle(issue, departmentId: departmentId)) return null;
    final palette = context.palette;
    final busy = _busy.contains(issue.id);
    final locked = _busy.isNotEmpty;
    const spinner = SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2));

    if (issue.assignee == null) {
      return Align(
        alignment: Alignment.centerRight,
        child: FilledButton.tonalIcon(
          onPressed: locked ? null : () => _claim(issue),
          style: FilledButton.styleFrom(minimumSize: const Size(kMinTouchTarget, 44)),
          icon: busy ? spinner : Icon(Icons.play_circle_outline, color: palette.success.text),
          label: const Text('Nhận việc'),
        ),
      );
    }
    if (me == null || issue.assignee!.id != me) return null;

    final targets = statusTargets(issue, ref.read(metaProvider));
    // Padding ngang hẹp hơn mặc định + bỏ icon khi chữ lớn để hai nút không
    // xuống dòng ở chữ 1.6×.
    const pairPadding = EdgeInsets.symmetric(horizontal: Gap.md);
    final icons = !pairButtonsWithoutIcons(context);
    return Row(
      children: [
        if (targets.isNotEmpty)
          Expanded(
            child: OutlinedButton.icon(
              onPressed: locked ? null : () => _pickStatus(issue),
              style: OutlinedButton.styleFrom(minimumSize: const Size(kMinTouchTarget, 44), padding: pairPadding),
              icon: busy ? spinner : (icons ? const Icon(Icons.sync_alt) : null),
              label: const Text('Cập nhật'),
            ),
          ),
        if (targets.contains(IssueStatus.resolved)) ...[
          Gap.w8,
          Expanded(
            child: FilledButton.icon(
              onPressed: locked ? null : () => _changeStatus(issue, IssueStatus.resolved),
              style: FilledButton.styleFrom(minimumSize: const Size(kMinTouchTarget, 44), padding: pairPadding),
              icon: icons ? const Icon(Icons.task_alt) : null,
              label: const Text('Hoàn tất'),
            ),
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(workListProvider);
    final scope = ref.watch(workScopeProvider);
    // Giữ bộ lọc của cả hai tab khi chuyển qua lại.
    final queries = {for (final s in WorkScope.values) s: ref.watch(workQueryProvider(s))};
    final query = queries[scope]!;
    final user = ref.watch(currentUserProvider);
    final mineOpen = ref.watch(workSummaryProvider).valueOrNull?.mineOpen;
    final online = ref.watch(isOnlineProvider);
    final pending = ref.watch(offlineQueueProvider.select((s) => s.count));
    final textTheme = Theme.of(context).textTheme;
    final mine = scope == WorkScope.mine;
    final base = workBaseQuery(scope, user?.id);
    final filterCount = query.activeFilterCount - base.activeFilterCount;

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

    void resetFilters() => ref.read(workQueryProvider(scope).notifier).state = base;

    return HeroScrollScope(
      child: Scaffold(
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
              Padding(
                padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.lg, Gap.screen, 0),
                child: _ScopeTabs(
                  scope: scope,
                  mineOpen: mineOpen,
                  onChanged: (s) => showWorkScope(ref, s),
                ),
              ),
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
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(mine ? 'Phiếu bạn đã nhận' : 'Danh sách việc', style: textTheme.titleLarge),
                          if (mine)
                            Text(
                              'Cập nhật trạng thái hoặc báo hoàn tất ngay trên từng thẻ.',
                              style: textTheme.bodySmall,
                            ),
                        ],
                      ),
                    ),
                    Badge(
                      isLabelVisible: filterCount > 0,
                      label: Text('$filterCount'),
                      child: IconButton.filledTonal(
                        tooltip: 'Bộ lọc và sắp xếp',
                        icon: const Icon(Icons.tune),
                        onPressed: () => showIssueFilterSheet(
                          context,
                          ref,
                          workQueryProvider(scope),
                          staffMode: true,
                          baseQuery: base,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: Gap.screenPadding,
                child: IssueFilterBar(
                  provider: workQueryProvider(scope),
                  total: state.pagination.total,
                  loading: state.isLoading,
                  staffMode: true,
                  baseQuery: base,
                ),
              ),
              Gap.h4,
            ],
          ),
          itemBuilder: (context, issue) => Padding(
            padding: Gap.screenPadding,
            child: IssueCard(
              issue: issue,
              showSla: true,
              showPriority: true,
              showAssignee: !mine,
              showDepartment: false,
              onTap: () => context.push(Routes.staffIssue(issue.id)),
              footer: _actions(issue, me: user?.id, departmentId: user?.department?.id),
            ),
          ),
          empty: Padding(
            padding: Gap.screenPadding,
            child: filterCount > 0
                ? EmptyState(
                    icon: Icons.filter_alt_off_outlined,
                    title: 'Không có việc khớp bộ lọc',
                    message: 'Thử bỏ bớt điều kiện lọc.',
                    actionLabel: 'Xoá bộ lọc',
                    onAction: resetFilters,
                  )
                : mine
                    ? EmptyState(
                        icon: Icons.assignment_ind_outlined,
                        title: 'Bạn chưa nhận việc nào',
                        message: 'Mở tab “Việc đơn vị” và bấm “Nhận việc” ở phiếu chưa có người phụ trách.',
                        actionLabel: 'Xem việc đơn vị',
                        onAction: () => showWorkScope(ref, WorkScope.department),
                      )
                    : EmptyState(
                        icon: Icons.task_alt,
                        title: 'Đơn vị chưa có việc nào',
                        message: 'Việc được quản trị viên phân công cho đơn vị sẽ hiện ở đây.',
                        actionLabel: 'Làm mới',
                        onAction: _refresh,
                      ),
          ),
        ),
      ),
    );
  }
}

/// "Việc đơn vị" / "Việc của tôi". Viên thuốc tự vẽ (không dùng SegmentedButton)
/// để chữ phóng 1.6× vẫn co lại bằng dấu "…" thay vì tràn.
class _ScopeTabs extends StatelessWidget {
  const _ScopeTabs({required this.scope, required this.mineOpen, required this.onChanged});

  final WorkScope scope;

  /// Số phiếu mình đang giữ chưa đóng; `null` khi chưa đếm xong.
  final int? mineOpen;
  final ValueChanged<WorkScope> onChanged;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      padding: const EdgeInsets.all(Gap.xs),
      decoration: BoxDecoration(
        color: palette.surfaceAlt,
        borderRadius: BorderRadius.circular(Radii.chip),
        border: Border.all(color: palette.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: _ScopeTab(
              label: 'Việc đơn vị',
              icon: Icons.apartment_outlined,
              selected: scope == WorkScope.department,
              onTap: () => onChanged(WorkScope.department),
            ),
          ),
          Gap.w4,
          Expanded(
            child: _ScopeTab(
              label: 'Việc của tôi',
              icon: Icons.assignment_ind_outlined,
              count: mineOpen,
              selected: scope == WorkScope.mine,
              onTap: () => onChanged(WorkScope.mine),
            ),
          ),
        ],
      ),
    );
  }
}

class _ScopeTab extends StatelessWidget {
  const _ScopeTab({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
    this.count,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  final int? count;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final fg = selected ? palette.onPrimary : palette.textSecondary;
    final n = count;
    return Semantics(
      button: true,
      selected: selected,
      label: n == null ? label : '$label: $n việc đang mở',
      excludeSemantics: true,
      child: Material(
        color: selected ? palette.primary : Colors.transparent,
        shape: const StadiumBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: kMinTouchTarget),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: Gap.sm),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 18, color: fg),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.labelLarge?.copyWith(color: fg),
                    ),
                  ),
                  if (n != null && n > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                      decoration: BoxDecoration(
                        color: selected ? palette.onPrimary : palette.accentSoft,
                        borderRadius: BorderRadius.circular(Radii.chip),
                      ),
                      child: Text(
                        Fmt.number(n),
                        style: textTheme.labelSmall?.copyWith(
                          color: selected ? palette.primary : palette.accentInk,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
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
    final scope = ref.watch(workScopeProvider);
    final query = ref.watch(workQueryProvider(scope));
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final dept = user?.department;
    final inDepartment = scope == WorkScope.department;
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
                    selected: false, onTap: () => showWorkScope(ref, scope, filter: (base) => base)),
                Gap.w8,
                tile(n(summary?.mineOpen), 'Tôi đang làm', Icons.person_pin_circle_outlined,
                    selected: !inDepartment, onTap: () => showWorkScope(ref, WorkScope.mine)),
                Gap.w8,
                // Hai ô hạn xử lý đếm trên toàn đơn vị nên lọc ở tab "Việc đơn vị".
                tile(n(summary?.overdue), 'Quá hạn', Icons.error_outline,
                    selected: inDepartment && query.slaStatus == 'overdue',
                    onTap: () => showWorkScope(ref, WorkScope.department,
                        filter: (base) => base.copyWith(slaStatus: 'overdue'))),
                Gap.w8,
                tile(n(summary?.dueSoon), 'Sắp đến hạn', Icons.warning_amber,
                    selected: inDepartment && query.slaStatus == 'due_soon',
                    onTap: () => showWorkScope(ref, WorkScope.department,
                        filter: (base) => base.copyWith(sort: 'dueAt', slaStatus: 'due_soon'))),
              ],
            ),
          ),
          Gap.h16,
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final (icon, label, route) in [
                  (AppFeatures.issues.icon, 'Sự cố công khai', Routes.issues),
                  (AppFeatures.statistics.icon, 'Thống kê', Routes.statistics),
                  (AppFeatures.cameras.icon, 'Camera', Routes.cameras),
                  (AppFeatures.chatbot.icon, 'Trợ lý AI', Routes.chatbot),
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
