import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/app_exception.dart';
import '../../../core/router/route_guard.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_icons.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_map.dart';
import '../../../core/widgets/async_states.dart';
import '../../../core/widgets/status_chips.dart';
import '../../../core/widgets/surfaces.dart';
import '../../../data/models/comment.dart';
import '../../../data/models/issue.dart';
import '../../../data/models/public_info.dart';
import '../../../data/repositories/issue_repository.dart';
import '../../../data/repositories/meta_repository.dart';
import '../../../data/repositories/support_repositories.dart';
import '../../../data/socket/socket_service.dart';
import '../../auth/auth_controller.dart';
import '../issue_detail_controller.dart';
import '../issue_rules.dart';

/// Tiêu đề một khối trong màn chi tiết.
class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.icon, this.trailing});

  final String text;
  final IconData? icon;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: Gap.md),
      child: Row(
        children: [
          if (icon != null) ...[
            IconBubble(
              icon: icon!,
              ink: scheme.onPrimaryContainer,
              container: scheme.primaryContainer,
              size: 34,
            ),
            Gap.w12,
          ],
          Expanded(child: Text(text, style: Theme.of(context).textTheme.titleMedium)),
          ?trailing,
        ],
      ),
    );
  }
}

/// Bản đồ nhỏ không tương tác + nút chỉ đường bằng app bản đồ của máy. Ghim
/// giống bản đồ chính: màu + icon của danh mục.
class MiniMap extends ConsumerWidget {
  const MiniMap({super.key, required this.lat, required this.lng, required this.category});

  final double lat;
  final double lng;
  final String category;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final point = LatLng(lat, lng);
    final c = ref.watch(metaProvider).category(category);
    return ClipRRect(
      borderRadius: BorderRadius.circular(Radii.tile),
      child: SizedBox(
        height: 180,
        child: Stack(
          children: [
            FlutterMap(
              options: MapOptions(
                initialCenter: point,
                initialZoom: 16,
                interactionOptions: const InteractionOptions(flags: InteractiveFlag.none),
              ),
              children: [
                baseTileLayer(),
                MarkerLayer(markers: [
                  Marker(
                    point: point,
                    width: 40,
                    height: 40,
                    child: MapPin(color: mapPinColor(hexColor(c.color)), icon: AppIcons.category(category)),
                  ),
                ]),
                mapAttribution(),
              ],
            ),
            Positioned(
              right: Gap.sm,
              top: Gap.sm,
              child: FilledButton.tonalIcon(
                onPressed: () => launchUrl(
                  Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng'),
                  mode: LaunchMode.externalApplication,
                ),
                icon: const Icon(Icons.directions, size: 18),
                label: const Text('Chỉ đường'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Đơn vị phụ trách (populate `name code email phone` — số cơ quan công khai).
class DepartmentCard extends StatelessWidget {
  const DepartmentCard({super.key, required this.issue});

  final Issue issue;

  @override
  Widget build(BuildContext context) {
    final d = issue.department;
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;
    return AppCard(
      padding: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(Gap.card),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const SectionTitle('Đơn vị phụ trách', icon: Icons.apartment_outlined),
            if (d == null)
              Text(
                'Chưa phân công. Quản trị viên sẽ giao cho đơn vị phù hợp '
                '${issue.intakeDueAt != null ? 'trước ${Fmt.dateTime(issue.intakeDueAt)}' : 'sớm nhất'}.',
                style: textTheme.bodyMedium?.copyWith(color: palette.textSecondary),
              )
            else ...[
              Text(d.name ?? 'Đơn vị xử lý', style: textTheme.titleSmall),
              if (issue.assignee?.name != null) ...[
                Gap.h4,
                Text('Cán bộ phụ trách: ${issue.assignee!.name}', style: textTheme.bodySmall),
              ],
              if (issue.dueAt != null) ...[
                Gap.h4,
                Text('Hạn xử lý: ${Fmt.dateTime(issue.dueAt)}', style: textTheme.bodySmall),
              ],
              if ((d.phone ?? '').isNotEmpty || (d.email ?? '').isNotEmpty) Gap.h8,
              Wrap(
                spacing: Gap.sm,
                children: [
                  if ((d.phone ?? '').isNotEmpty)
                    OutlinedButton.icon(
                      onPressed: () => launchUrl(Uri(scheme: 'tel', path: d.phone)),
                      icon: const Icon(Icons.call_outlined, size: 18),
                      label: Text(d.phone!),
                    ),
                  if ((d.email ?? '').isNotEmpty)
                    OutlinedButton.icon(
                      onPressed: () => launchUrl(Uri(scheme: 'mailto', path: d.email)),
                      icon: const Icon(Icons.mail_outline, size: 18),
                      label: const Text('Email'),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Timeline "ai làm gì" — `statusHistory[].changedBy` đã populate sau E2.
/// Bản ghi cũ có `changedBy` là id thô thì chỉ hiện thời gian.
class TimelineSection extends ConsumerWidget {
  const TimelineSection({super.key, required this.issue});

  final Issue issue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = ref.watch(metaProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final history = issue.statusHistory.reversed.toList();
    if (history.isEmpty) return const SizedBox.shrink();

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionTitle('Tiến trình xử lý', icon: Icons.timeline),
          for (var i = 0; i < history.length; i++)
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    width: 34,
                    child: Column(
                      children: [
                        Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            color: palette.statusColors(history[i].status).container,
                            shape: BoxShape.circle,
                            border: i == 0
                                ? Border.all(color: palette.statusColors(history[i].status).text, width: 1.5)
                                : null,
                          ),
                          child: Icon(AppIcons.status(history[i].status),
                              size: 16, color: palette.statusColors(history[i].status).text),
                        ),
                        if (i < history.length - 1)
                          Expanded(
                            child: Container(
                              width: 2,
                              margin: const EdgeInsets.symmetric(vertical: 2),
                              color: palette.border,
                            ),
                          ),
                      ],
                    ),
                  ),
                  Gap.w8,
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: Gap.lg),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(meta.statusLabel(history[i].status.name), style: textTheme.titleSmall),
                          Text(
                            [
                              Fmt.dateTime(history[i].changedAt),
                              if (history[i].changedBy?.name != null) 'bởi ${history[i].changedBy!.name}',
                            ].join(' · '),
                            style: textTheme.bodySmall,
                          ),
                          if (history[i].note.isNotEmpty) ...[
                            Gap.h4,
                            Text(history[i].note, style: textTheme.bodyMedium),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Đánh giá chất lượng xử lý — mở cho cả phiếu `rejected` (task I1).
class RatingCard extends ConsumerStatefulWidget {
  const RatingCard({super.key, required this.issue});

  final Issue issue;

  @override
  ConsumerState<RatingCard> createState() => _RatingCardState();
}

class _RatingCardState extends ConsumerState<RatingCard> {
  int _score = 0;
  final _comment = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_score == 0) {
      setState(() => _error = 'Vui lòng chọn số sao');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(issueDetailProvider(widget.issue.id).notifier).rate(_score, _comment.text);
      if (mounted) showAppSnack(context, 'Cảm ơn bạn đã đánh giá!');
    } on AppException catch (e) {
      if (!mounted) return;
      // ALREADY_RATED / ISSUE_NOT_CLOSED: tải lại để thẻ tự ẩn.
      if (e.code == 'ALREADY_RATED' || e.code == 'ISSUE_NOT_CLOSED') {
        await ref.read(issueDetailProvider(widget.issue.id).notifier).reload();
      }
      if (mounted) setState(() => _error = e.errorFor('score') ?? e.errorFor('comment') ?? e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final issue = widget.issue;
    final userId = ref.watch(currentUserProvider)?.id;
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;

    if (issue.rating.isRated) {
      return Padding(
        padding: const EdgeInsets.only(bottom: Gap.md),
        child: AppCard(
          padding: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.all(Gap.card),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const SectionTitle('Đánh giá của người báo cáo', icon: Icons.star_outline),
                _Stars(score: issue.rating.score ?? 0),
                if ((issue.rating.comment ?? '').isNotEmpty) ...[
                  Gap.h8,
                  Text('“${issue.rating.comment}”', style: textTheme.bodyMedium),
                ],
              ],
            ),
          ),
        ),
      );
    }
    if (!canRateIssue(issue, userId)) return const SizedBox.shrink();

    final rejected = issue.status == IssueStatus.rejected;
    return Padding(
      padding: const EdgeInsets.only(bottom: Gap.md),
      child: AppCard(
        padding: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(Gap.card),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              SectionTitle(
                rejected ? 'Bạn thấy quyết định này thế nào?' : 'Sự cố của bạn đã được xử lý',
                icon: Icons.star_outline,
              ),
              Text(
                rejected
                    ? 'Đánh giá giúp đơn vị cải thiện cách tiếp nhận phản ánh.'
                    : 'Đánh giá chất lượng xử lý — 1–2 sao sẽ được báo lên quản trị viên xem lại.',
                style: textTheme.bodySmall,
              ),
              Gap.h8,
              _Stars(score: _score, onChanged: _busy ? null : (s) => setState(() => _score = s)),
              Gap.h8,
              TextField(
                controller: _comment,
                maxLength: 500,
                maxLines: 3,
                minLines: 1,
                decoration: const InputDecoration(labelText: 'Nhận xét (không bắt buộc)'),
              ),
              if (_error != null)
                Text(_error!, style: textTheme.bodySmall?.copyWith(color: palette.error)),
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton(
                  onPressed: _busy ? null : _submit,
                  child: const Text('Gửi đánh giá'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Stars extends StatelessWidget {
  const _Stars({required this.score, this.onChanged});

  final int score;
  final ValueChanged<int>? onChanged;

  @override
  Widget build(BuildContext context) {
    final color = context.palette.priorityColors(PriorityLevel.medium).text;
    return Semantics(
      label: '$score trên 5 sao',
      child: Row(
        children: [
          for (var i = 1; i <= 5; i++)
            IconButton(
              tooltip: '$i sao',
              onPressed: onChanged == null ? null : () => onChanged!(i),
              icon: Icon(i <= score ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: color, size: 32),
            ),
        ],
      ),
    );
  }
}

/// "Chưa hài lòng với kết quả?" — G8, ngưỡng đọc từ `/api/meta/enums` → `reopen`.
class ReopenCard extends ConsumerStatefulWidget {
  const ReopenCard({super.key, required this.issue});

  final Issue issue;

  @override
  ConsumerState<ReopenCard> createState() => _ReopenCardState();
}

class _ReopenCardState extends ConsumerState<ReopenCard> {
  Future<void> _open() async {
    final policy = ref.read(metaProvider).reopen;
    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _ReopenSheet(issue: widget.issue, minLength: policy.minReasonLength,
          maxLength: policy.maxReasonLength),
    );
    if (reason == null || !mounted) return;
    try {
      await ref.read(issueDetailProvider(widget.issue.id).notifier).reopen(reason);
      if (mounted) showAppSnack(context, 'Đã mở lại sự cố. Đơn vị phụ trách sẽ xem xét lại.');
    } on AppException catch (e) {
      if (!mounted) return;
      final block = ReopenBlock.fromCode(e.code);
      showAppSnack(context, block?.explain(policy) ?? e.message, error: true);
      // Bị từ chối thì tải lại phiếu để thẻ hiện đúng lý do.
      await ref.read(issueDetailProvider(widget.issue.id).notifier).reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    final policy = ref.watch(metaProvider).reopen;
    final userId = ref.watch(currentUserProvider)?.id;
    final eligibility = reopenEligibility(widget.issue, userId, policy);
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;

    if (!eligibility.allowed && !(eligibility.block?.showReason ?? false)) {
      return const SizedBox.shrink();
    }
    if (eligibility.block == ReopenBlock.mergedIssue) return const SizedBox.shrink();

    final rejected = widget.issue.status == IssueStatus.rejected;
    return Padding(
      // Tự mang khoảng cách như [RatingCard]: ẩn thì không để lại ô trống.
      padding: const EdgeInsets.only(bottom: Gap.md),
      child: AppCard(
        padding: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(Gap.card),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              SectionTitle(
                rejected ? 'Không đồng ý với quyết định từ chối?' : 'Chưa hài lòng với kết quả?',
                icon: Icons.replay,
              ),
              if (eligibility.allowed) ...[
                Text(
                  rejected
                      ? 'Nếu sự cố vẫn còn, bạn có thể yêu cầu đơn vị xem xét lại kèm lý do.'
                      : 'Ra hiện trường mà sự cố vẫn còn? Mở lại để đơn vị xử lý tiếp.',
                  style: textTheme.bodySmall,
                ),
                Gap.h4,
                Text(
                  [
                    'Còn ${policy.maxCount - widget.issue.reopenCount}/${policy.maxCount} lượt',
                    if (eligibility.daysLeft != null) 'còn ${eligibility.daysLeft} ngày',
                  ].join(' · '),
                  style: textTheme.labelSmall?.copyWith(color: palette.textSecondary),
                ),
                Gap.h8,
                OutlinedButton.icon(
                  onPressed: _open,
                  icon: const Icon(Icons.replay),
                  label: const Text('Mở lại sự cố'),
                ),
              ] else
                Text(eligibility.block!.explain(policy), style: textTheme.bodySmall),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReopenSheet extends StatefulWidget {
  const _ReopenSheet({required this.issue, required this.minLength, required this.maxLength});

  final Issue issue;
  final int minLength;
  final int maxLength;

  @override
  State<_ReopenSheet> createState() => _ReopenSheetState();
}

class _ReopenSheetState extends State<_ReopenSheet> {
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final length = _reason.text.trim().length;
    final valid = length >= widget.minLength && length <= widget.maxLength;
    return Padding(
      padding: EdgeInsets.fromLTRB(
          Gap.screen, 0, Gap.screen, MediaQuery.viewInsetsOf(context).bottom + Gap.lg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Mở lại sự cố', style: Theme.of(context).textTheme.titleLarge),
          Gap.h8,
          Text(
            'Nêu rõ điều gì chưa ổn để đơn vị biết phải làm gì khác lần trước.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          Gap.h12,
          TextField(
            controller: _reason,
            autofocus: true,
            minLines: 3,
            maxLines: 6,
            maxLength: widget.maxLength,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: 'Lý do *',
              helperText: 'Ít nhất ${widget.minLength} ký tự',
            ),
          ),
          Gap.h8,
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: valid ? () => Navigator.pop(context, _reason.text.trim()) : null,
              child: const Text('Gửi yêu cầu mở lại'),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bình luận phân trang (task 2.4). Backend đã lọc bình luận bị gỡ.
class CommentsSection extends ConsumerStatefulWidget {
  const CommentsSection({super.key, required this.issueId});

  final String issueId;

  @override
  ConsumerState<CommentsSection> createState() => _CommentsSectionState();
}

class _CommentsSectionState extends ConsumerState<CommentsSection> {
  final List<IssueComment> _items = [];
  int _page = 0;
  int _total = 0;
  bool _hasMore = true;
  bool _loading = false;
  AppException? _error;
  final _input = TextEditingController();
  bool _sending = false;
  StreamSubscription<Object>? _live;

  @override
  void initState() {
    super.initState();
    _loadMore();
    // Bình luận mới của phía bên kia (cán bộ ↔ người dân) hiện ngay khi có
    // thông báo, không phải thoát ra vào lại màn này.
    _live = ref.read(socketServiceProvider).incoming.listen((n) {
      if (n.type == 'comment' && n.issueId == widget.issueId) unawaited(_pullNewest());
    });
  }

  @override
  void dispose() {
    _live?.cancel();
    _input.dispose();
    super.dispose();
  }

  /// Lấy trang mới nhất, chèn bình luận chưa có lên đầu — cùng chỗ với bình luận
  /// vừa tự gửi — mà không xoá danh sách đang xem.
  Future<void> _pullNewest() async {
    try {
      final page = await ref.read(commentRepositoryProvider).list(widget.issueId);
      if (!mounted) return;
      setState(() {
        final seen = {for (final c in _items) c.id};
        _items.insertAll(0, page.items.where((c) => !seen.contains(c.id)));
        _total = page.pagination.total;
      });
    } on AppException {
      // Giữ danh sách đang có; lần mở sau sẽ tải lại.
    }
  }

  Future<void> _loadMore() async {
    if (_loading || !_hasMore) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await ref.read(commentRepositoryProvider).list(widget.issueId, page: _page + 1);
      if (!mounted) return;
      setState(() {
        final seen = {for (final c in _items) c.id};
        _items.addAll(page.items.where((c) => seen.add(c.id)));
        _page = page.pagination.current;
        _total = page.pagination.total;
        _hasMore = page.pagination.hasMore;
      });
    } on AppException catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      final c = await ref.read(commentRepositoryProvider).add(widget.issueId, text);
      if (!mounted) return;
      _input.clear();
      FocusScope.of(context).unfocus();
      setState(() {
        _items.insert(0, c);
        _total++;
      });
    } on AppException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final maxLength = ref.watch(metaProvider).limits.maxCommentLength;
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionTitle(_total > 0 ? 'Bình luận ($_total)' : 'Bình luận', icon: Icons.forum_outlined),
          if (user != null)
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: _input,
                    minLines: 1,
                    maxLines: 4,
                    maxLength: maxLength,
                    decoration: const InputDecoration(hintText: 'Viết bình luận…', counterText: ''),
                  ),
                ),
                Gap.w8,
                IconButton.filled(
                  tooltip: 'Gửi bình luận',
                  onPressed: _sending ? null : _send,
                  icon: const Icon(Icons.send),
                ),
              ],
            )
          else
            OutlinedButton.icon(
              onPressed: () => context.push(Routes.login),
              icon: const Icon(Icons.login),
              label: const Text('Đăng nhập để bình luận'),
            ),
          Gap.h12,
          if (_items.isEmpty && !_loading && _error == null)
            Text('Chưa có bình luận nào.', style: textTheme.bodySmall),
          for (final c in _items)
            Padding(
              padding: const EdgeInsets.only(bottom: Gap.md),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: c.isFromHandler ? palette.primary : palette.surfaceAlt,
                    child: Text(
                      Fmt.initial(c.author?.name),
                      style: TextStyle(color: c.isFromHandler ? palette.onPrimary : palette.textPrimary),
                    ),
                  ),
                  Gap.w12,
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Wrap(
                          spacing: Gap.sm,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(c.author?.name ?? 'Người dùng', style: textTheme.titleSmall),
                            if (c.isFromHandler)
                              InfoChip(
                                label: c.author?.role == 'admin' ? 'Quản trị viên' : 'Cán bộ',
                                icon: Icons.verified_user_outlined,
                                colors: palette.success,
                                dense: true,
                              ),
                            Text(Fmt.relative(c.createdAt), style: textTheme.bodySmall),
                          ],
                        ),
                        Gap.h4,
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: Gap.sm + 2),
                          decoration: BoxDecoration(
                            color: c.isFromHandler
                                ? Theme.of(context).colorScheme.primaryContainer
                                : palette.field,
                            borderRadius: const BorderRadius.only(
                              topRight: Radius.circular(16),
                              bottomLeft: Radius.circular(16),
                              bottomRight: Radius.circular(16),
                              topLeft: Radius.circular(4),
                            ),
                          ),
                          child: Text(c.content, style: textTheme.bodyMedium),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          if (_loading) const Center(child: Padding(padding: EdgeInsets.all(Gap.md), child: CircularProgressIndicator())),
          if (_error != null)
            TextButton.icon(
              onPressed: _loadMore,
              icon: const Icon(Icons.refresh),
              label: const Text('Không tải được bình luận — thử lại'),
            ),
          if (_hasMore && !_loading && _items.isNotEmpty)
            Center(
              child: TextButton(onPressed: _loadMore, child: const Text('Xem bình luận cũ hơn')),
            ),
        ],
      ),
    );
  }
}

/// "Sự cố khác đang mở gần đây" (500 m) — endpoint `/issues/nearby`.
final _nearbyProvider = FutureProvider.autoDispose.family<List<NearbyIssue>, String>((ref, key) {
  final parts = key.split(',');
  return ref.read(issueRepositoryProvider).nearby(
        double.parse(parts[0]),
        double.parse(parts[1]),
        radius: 500,
      );
});

class NearbySection extends ConsumerWidget {
  const NearbySection({super.key, required this.issue});

  final Issue issue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_nearbyProvider('${issue.latitude},${issue.longitude}'));
    final items = (async.valueOrNull ?? const <NearbyIssue>[])
        .where((n) => n.issue.id != issue.id && n.issue.status.isOpen)
        .take(5)
        .toList();
    if (items.isEmpty) return const SizedBox.shrink();
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      // Tự mang khoảng cách: không có gì để hiện thì không để lại ô trống.
      padding: const EdgeInsets.only(bottom: Gap.md),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionTitle('Sự cố khác đang mở gần đây', icon: Icons.near_me_outlined),
            for (final n in items)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CategoryEmoji(n.issue.category),
                title: Text(n.issue.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text('Cách ${Fmt.distance(n.distanceMeters)} · ${Fmt.relative(n.issue.createdAt)}',
                    style: textTheme.bodySmall),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push(Routes.issue(n.issue.id)),
              ),
          ],
        ),
      ),
    );
  }
}

class CategoryEmoji extends ConsumerWidget {
  const CategoryEmoji(this.category, {super.key, this.size = 22});

  final String category;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return CategoryBadge(category, size: size * 1.8);
  }
}

/// Camera công cộng gần sự cố — cán bộ xem trực tiếp để xác minh hiện trường.
final _nearbyCamerasProvider =
    FutureProvider.autoDispose.family<List<PublicCamera>, String>((ref, key) {
  final parts = key.split(',');
  return ref.read(publicRepositoryProvider).nearbyCameras(double.parse(parts[0]), double.parse(parts[1]));
});

class NearbyCamerasSection extends ConsumerWidget {
  const NearbyCamerasSection({super.key, required this.issue, required this.onOpen});

  final Issue issue;
  final void Function(PublicCamera camera) onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cams = ref.watch(_nearbyCamerasProvider('${issue.latitude},${issue.longitude}')).valueOrNull ??
        const <PublicCamera>[];
    if (cams.isEmpty) return const SizedBox.shrink();
    final palette = context.palette;
    return Padding(
      padding: const EdgeInsets.only(bottom: Gap.md),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionTitle('Camera công cộng gần đây', icon: Icons.videocam_outlined),
            for (final c in cams.take(3))
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: IconBubble(
                  icon: Icons.videocam_outlined,
                  ink: palette.accentInk,
                  container: palette.accentSoft,
                  size: 40,
                ),
                title: Text(c.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: c.distanceMeters == null ? null : Text('Cách ${Fmt.distance(c.distanceMeters!)}'),
                trailing: Icon(Icons.play_circle_outline, color: palette.primary),
                onTap: () => onOpen(c),
              ),
          ],
        ),
      ),
    );
  }
}
