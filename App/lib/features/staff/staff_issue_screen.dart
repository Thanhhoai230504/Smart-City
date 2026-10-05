import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/network/app_exception.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/photo_evidence_strip.dart';
import '../../core/widgets/sla_countdown.dart';
import '../../core/widgets/status_chips.dart';
import '../../core/widgets/surfaces.dart';
import '../../data/models/issue.dart';
import '../../data/repositories/meta_repository.dart';
import '../auth/auth_controller.dart';
import '../issues/issue_detail_controller.dart';
import '../issues/issue_rules.dart';
import '../issues/widgets/detail_sections.dart';
import 'staff_actions.dart';
import 'status_change.dart';

/// Chi tiết việc ở hiện trường (task 4.4–4.9). Khác màn công khai: có **số điện
/// thoại người báo cáo + nút GỌI** (web không làm được), nhận việc, đổi trạng
/// thái và luồng hoàn tất có ảnh minh chứng.
class StaffIssueScreen extends ConsumerWidget {
  const StaffIssueScreen({super.key, required this.issueId});

  final String issueId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(issueDetailProvider(issueId));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Xử lý sự cố'),
        actions: [
          IconButton(
            tooltip: 'Xem trang công khai',
            icon: const Icon(Icons.public),
            onPressed: () => context.push(Routes.issue(issueId)),
          ),
        ],
      ),
      body: async.when(
        skipLoadingOnRefresh: true,
        loading: () => const SkeletonList(count: 3, itemHeight: 140),
        error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(issueDetailProvider(issueId))),
        data: (issue) => _StaffBody(issue: issue),
      ),
    );
  }
}

class _StaffBody extends ConsumerStatefulWidget {
  const _StaffBody({required this.issue});

  final Issue issue;

  @override
  ConsumerState<_StaffBody> createState() => _StaffBodyState();
}

class _StaffBodyState extends ConsumerState<_StaffBody> {
  bool _busy = false;

  Issue get issue => widget.issue;

  Future<void> _run(Future<void> Function() action, {String? success}) async {
    setState(() => _busy = true);
    try {
      await action();
      if (mounted && success != null) showAppSnack(context, success);
    } on AppException catch (e) {
      if (!mounted) return;
      if (e.code == 'MERGED_ISSUE' && issue.mergedInto != null) {
        context.pushReplacement(Routes.staffIssue(issue.mergedInto!.id));
        return;
      }
      showAppSnack(context, explainStaffError(e), error: true);
      if (e.code == 'INVALID_STATUS_TRANSITION') {
        await ref.read(staffActionsProvider(issue.id)).reload();
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _claim() => _run(
        () => ref.read(staffActionsProvider(issue.id)).claim(),
        success: 'Bạn đã nhận xử lý sự cố này.',
      );

  Future<void> _changeStatus(IssueStatus target) async {
    if (target == IssueStatus.resolved) {
      await openResolveFlow(context, issue);
      return;
    }
    final note = await askStatusNote(context, target);
    if (note == null || !mounted) return;
    await _run(
      () => ref.read(staffActionsProvider(issue.id)).updateStatus(target, note: note),
      success: 'Đã cập nhật trạng thái.',
    );
  }

  Future<void> _pickStatus() async {
    final target = await pickStatusTarget(context, issue, ref.read(metaProvider));
    if (target != null && mounted) await _changeStatus(target);
  }

  /// Thanh thao tác cố định dưới màn — trước đây nút đổi trạng thái nằm giữa
  /// trang nên phải cuộn mới thấy. `null` khi không có việc gì để làm.
  Widget? _actionBar({required bool canHandle, required bool mine, required List<IssueStatus> targets}) {
    if (!canHandle) return null;
    // Padding ngang hẹp hơn mặc định + bỏ icon khi chữ lớn để hai nút không
    // xuống dòng ở chữ 1.6×.
    const pairPadding = EdgeInsets.symmetric(horizontal: Gap.md);
    final icons = !pairButtonsWithoutIcons(context);
    final List<Widget> buttons;
    if (issue.assignee == null && issue.status.isOpen) {
      buttons = [
        Expanded(
          child: FilledButton.icon(
            onPressed: _busy ? null : _claim,
            icon: const Icon(Icons.play_circle_outline),
            label: const Text('Nhận việc để xử lý'),
          ),
        ),
      ];
    } else if (mine && issue.status.isOpen && targets.isNotEmpty) {
      buttons = [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: _busy ? null : _pickStatus,
            style: OutlinedButton.styleFrom(padding: pairPadding),
            icon: icons ? const Icon(Icons.sync_alt) : null,
            label: const Text('Cập nhật'),
          ),
        ),
        if (targets.contains(IssueStatus.resolved)) ...[
          Gap.w12,
          Expanded(
            child: FilledButton.icon(
              onPressed: _busy ? null : () => _changeStatus(IssueStatus.resolved),
              style: FilledButton.styleFrom(padding: pairPadding),
              icon: icons ? const Icon(Icons.task_alt) : null,
              label: const Text('Hoàn tất'),
            ),
          ),
        ],
      ];
    } else if (mine && targets.contains(IssueStatus.processing)) {
      // Phiếu của mình đã đóng: cho mở lại nếu xử lý chưa xong.
      buttons = [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: _busy ? null : () => _changeStatus(IssueStatus.processing),
            icon: Icon(statusTargetIcon(IssueStatus.processing)),
            label: const Text('Mở lại để xử lý tiếp'),
          ),
        ),
      ];
    } else {
      return null;
    }
    final palette = context.palette;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.surface,
        border: Border(top: BorderSide(color: palette.border)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.md, Gap.screen, Gap.md),
          child: Row(children: buttons),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final meta = ref.watch(metaProvider);
    final user = ref.watch(currentUserProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final canHandle = staffCanHandle(issue, departmentId: user?.department?.id);
    final mine = issue.assignee?.id == user?.id;
    final targets = statusTargets(issue, meta);
    final bar = _actionBar(canHandle: canHandle, mine: mine, targets: targets);

    final list = ListView(
      padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.screen, Gap.xxxl),
      children: [
        Row(
          children: [
            Expanded(child: CategoryLabel(issue.category)),
            Text(Fmt.relative(issue.createdAt), style: textTheme.bodySmall),
          ],
        ),
        Gap.h8,
        Text(issue.title, style: textTheme.headlineSmall),
        Gap.h8,
        Wrap(
          spacing: Gap.sm,
          runSpacing: Gap.sm,
          children: [
            StatusChip(issue.status),
            if (issue.priorityLevel != null) PriorityChip(issue.priorityLevel!, score: issue.priorityScore),
            SlaCountdown(issue: issue),
            if (issue.reopenCount > 0) ReopenedChip(issue.reopenCount),
          ],
        ),
        if (issue.dueAt != null) ...[
          Gap.h8,
          Text('Hạn xử lý: ${Fmt.dateTime(issue.dueAt)}', style: textTheme.bodySmall),
        ],
        if (!canHandle) ...[
          Gap.h12,
          Text(
            'Phiếu này không thuộc đơn vị của bạn — chỉ xem, không xử lý được.',
            style: textTheme.bodyMedium?.copyWith(color: palette.error),
          ),
        ],
        Gap.h16,
        _ReporterCard(issue: issue),
        Gap.h12,
        if (canHandle) _AssignmentCard(issue: issue, mine: mine),
        // Như web: chỉ cán bộ đang phụ trách mới đổi trạng thái — tránh hai người
        // cùng xử lý một phiếu mà không biết nhau.
        if (canHandle && !mine && targets.isNotEmpty) ...[
          Gap.h12,
          Text(
            issue.assignee == null
                ? 'Nhận việc để cập nhật trạng thái phiếu này.'
                : 'Chỉ cán bộ đang phụ trách mới cập nhật được trạng thái.',
            style: textTheme.bodySmall,
          ),
        ],
        if (canHandle && mine && issue.status.isOpen && targets.isNotEmpty) ...[
          Gap.h12,
          Text(
            'Bấm “Cập nhật” để chuyển trạng thái hoặc từ chối, “Hoàn tất” để chụp ảnh minh chứng và báo đã xử lý.',
            style: textTheme.bodySmall,
          ),
        ],
        if (issue.priorityFactors.isNotEmpty) ...[
          Gap.h12,
          _PriorityExplain(issue: issue),
        ],
        Gap.h12,
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionTitle('Ảnh trước / sau', icon: Icons.photo_library_outlined),
              PhotoEvidenceStrip(
                label: 'Người dân chụp',
                photos: [for (final u in issue.photoUrls) PhotoSource.url(u)],
                emptyText: 'Không có ảnh.',
              ),
              Gap.h16,
              PhotoEvidenceStrip(
                label: 'Đơn vị chụp sau xử lý',
                icon: Icons.verified_outlined,
                photos: [for (final i in issue.resolutionImages) PhotoSource.url(i.url)],
                emptyText: 'Chưa có ảnh minh chứng.',
              ),
            ],
          ),
        ),
        Gap.h12,
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionTitle('Mô tả', icon: Icons.notes),
              Text(issue.description, style: textTheme.bodyLarge),
            ],
          ),
        ),
        Gap.h12,
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionTitle('Vị trí', icon: Icons.place_outlined),
              Text(issue.location, style: textTheme.bodyMedium),
              Gap.h12,
              MiniMap(lat: issue.latitude, lng: issue.longitude, category: issue.category),
            ],
          ),
        ),
        Gap.h12,
        TimelineSection(issue: issue),
        Gap.h12,
        CommentsSection(issueId: issue.id),
      ],
    );

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: ref.read(issueDetailProvider(issue.id).notifier).reload,
            child: list,
          ),
        ),
        ?bar,
      ],
    );
  }
}

/// Người báo cáo + nút GỌI. `phone` chỉ có trong response khi người gọi là
/// cán bộ/admin — người dân thường không bao giờ thấy nút này (task 4.4).
class _ReporterCard extends StatelessWidget {
  const _ReporterCard({required this.issue});

  final Issue issue;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final phone = issue.phone;
    return AppCard(
      padding: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(Gap.card),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const SectionTitle('Người báo cáo', icon: Icons.person_outline),
            Row(
              children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor: scheme.primaryContainer,
                  child: Text(
                    Fmt.initial(issue.reporter?.name),
                    style: textTheme.titleMedium?.copyWith(color: scheme.onPrimaryContainer),
                  ),
                ),
                Gap.w12,
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(issue.reporter?.name ?? 'Người dân', style: textTheme.titleSmall),
                      if (issue.reporter?.email != null) Text(issue.reporter!.email!, style: textTheme.bodySmall),
                      Text('Báo cáo lúc ${Fmt.dateTime(issue.createdAt)}', style: textTheme.bodySmall),
                    ],
                  ),
                ),
              ],
            ),
            Gap.h12,
            if (phone != null && phone.isNotEmpty)
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => launchUrl(Uri(scheme: 'tel', path: phone)),
                  icon: const Icon(Icons.call),
                  label: Text('GỌI $phone'),
                ),
              )
            else
              Text('Người báo cáo không để lại số điện thoại.', style: textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard({required this.issue, required this.mine});

  final Issue issue;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;
    return AppCard(
      padding: EdgeInsets.zero,
      color: mine ? palette.success.container : null,
      borderColor: mine ? Colors.transparent : null,
      child: Padding(
        padding: const EdgeInsets.all(Gap.card),
        child: Row(
          children: [
            Icon(
              mine ? Icons.assignment_turned_in_outlined : Icons.assignment_ind_outlined,
              color: mine ? palette.success.text : palette.textSecondary,
            ),
            Gap.w12,
            Expanded(
              child: Text(
                mine
                    ? 'Bạn đang phụ trách phiếu này'
                    : issue.assignee != null
                        ? 'Cán bộ ${issue.assignee!.name ?? 'khác'} đang phụ trách'
                        : 'Chưa có cán bộ nào nhận',
                style: textTheme.bodyMedium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Giải thích điểm ưu tiên — **AI chỉ hỗ trợ sắp xếp, không tự quyết** (Giai đoạn 3).
class _PriorityExplain extends StatelessWidget {
  const _PriorityExplain({required this.issue});

  final Issue issue;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return AppCard(
      padding: EdgeInsets.zero,
      child: ExpansionTile(
        shape: const Border(),
        leading: const Icon(Icons.insights_outlined),
        title: Text('Vì sao ưu tiên ${issue.priorityScore?.round() ?? '—'}/100?', style: textTheme.titleSmall),
        subtitle: Text('Điểm chỉ để sắp xếp, không tự ra quyết định', style: textTheme.bodySmall),
        childrenPadding: const EdgeInsets.fromLTRB(Gap.card, 0, Gap.card, Gap.card),
        children: [
          for (final f in issue.priorityFactors)
            Padding(
              padding: const EdgeInsets.only(bottom: Gap.sm),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 48,
                    child: Text('+${f.points.toStringAsFixed(f.points % 1 == 0 ? 0 : 1)}',
                        style: textTheme.titleSmall),
                  ),
                  Expanded(child: Text(f.message, style: textTheme.bodySmall)),
                ],
              ),
            ),
          if (issue.priorityVersion != null)
            Align(
              alignment: Alignment.centerLeft,
              child: Text('Phiên bản thuật toán: ${issue.priorityVersion}', style: textTheme.labelSmall),
            ),
        ],
      ),
    );
  }
}
