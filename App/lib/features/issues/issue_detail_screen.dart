import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/app_exception.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/photo_evidence_strip.dart';
import '../../core/widgets/sla_countdown.dart';
import '../../core/widgets/status_chips.dart';
import '../../core/widgets/surfaces.dart';
import '../../data/models/issue.dart';
import '../../data/models/user.dart';
import '../../data/repositories/meta_repository.dart';
import '../auth/auth_controller.dart';
import '../public_info/camera_player.dart';
import 'issue_detail_controller.dart';
import 'issue_rules.dart';
import 'share_issue.dart';
import 'widgets/detail_sections.dart';

/// Chi tiết sự cố (task 2.3). Người dân thường **không** thấy `phone` —
/// backend che ở tầng truy vấn, app chỉ hiển thị theo field có mặt hay không.
class IssueDetailScreen extends ConsumerWidget {
  const IssueDetailScreen({super.key, required this.issueId});

  final String issueId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(issueDetailProvider(issueId));

    Widget plain(Widget body) => Scaffold(appBar: AppBar(title: const Text('Chi tiết sự cố')), body: body);

    return async.when(
      skipLoadingOnRefresh: true,
      loading: () => plain(const SkeletonList(count: 3, itemHeight: 140)),
      error: (e, _) {
        final err = AppException.from(e);
        if (err.kind == AppErrorKind.notFound) {
          return plain(EmptyState(
            icon: Icons.search_off,
            title: 'Không tìm thấy sự cố',
            message: 'Sự cố có thể đã bị xoá.',
            actionLabel: 'Về danh sách',
            onAction: () => context.go(Routes.issues),
          ));
        }
        return plain(ErrorState(error: e, onRetry: () => ref.invalidate(issueDetailProvider(issueId))));
      },
      data: (issue) => _DetailView(issue: issue),
    );
  }
}

/// Ảnh hiện trường tràn viền ở đầu trang, nội dung trượt lên che dần; thanh
/// trên gập lại thành tiêu đề khi cuộn.
class _DetailView extends ConsumerStatefulWidget {
  const _DetailView({required this.issue});

  final Issue issue;

  @override
  ConsumerState<_DetailView> createState() => _DetailViewState();
}

class _DetailViewState extends ConsumerState<_DetailView> {
  static const _expandedHeight = 300.0;
  final _scroll = ScrollController();
  bool _collapsed = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      final collapsed = _scroll.hasClients && _scroll.offset > _expandedHeight - kToolbarHeight * 2;
      if (collapsed != _collapsed) setState(() => _collapsed = collapsed);
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final issue = widget.issue;
    final palette = context.palette;
    final light = palette.brightness == Brightness.light;
    final controller = ref.read(issueDetailProvider(issue.id).notifier);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: controller.reload,
        edgeOffset: MediaQuery.paddingOf(context).top + kToolbarHeight,
        child: CustomScrollView(
          controller: _scroll,
          slivers: [
            SliverAppBar(
              pinned: true,
              stretch: true,
              expandedHeight: _expandedHeight,
              backgroundColor: palette.background,
              surfaceTintColor: Colors.transparent,
              systemOverlayStyle: _collapsed && light ? SystemUiOverlayStyle.dark : SystemUiOverlayStyle.light,
              automaticallyImplyLeading: false,
              titleSpacing: 0,
              leading: _RoundButton(
                icon: Icons.arrow_back,
                tooltip: 'Quay lại',
                onTap: () => Navigator.of(context).maybePop(),
              ),
              title: AnimatedOpacity(
                opacity: _collapsed ? 1 : 0,
                duration: Motion.of(context, Motion.fast),
                child: Text(issue.title, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
              actions: [
                _RoundButton(
                  icon: Icons.share_outlined,
                  tooltip: 'Chia sẻ',
                  onTap: () => showShareIssueSheet(context, ref, issue),
                ),
                Gap.w8,
              ],
              flexibleSpace: FlexibleSpaceBar(
                collapseMode: CollapseMode.parallax,
                background: _HeroGallery(issue: issue),
              ),
              // Mép bo tròn của phần nội dung đè lên ảnh.
              bottom: PreferredSize(
                preferredSize: const Size.fromHeight(Radii.hero),
                child: Container(
                  height: Radii.hero,
                  decoration: BoxDecoration(
                    color: palette.background,
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(Radii.hero)),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(child: _DetailBody(issue: issue)),
          ],
        ),
      ),
    );
  }
}

/// Nút tròn nền sáng — đọc được trên mọi ảnh, và vẫn hợp khi thanh đã gập.
class _RoundButton extends StatelessWidget {
  const _RoundButton({required this.icon, required this.tooltip, required this.onTap});

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Center(
      child: IconButton(
        tooltip: tooltip,
        style: IconButton.styleFrom(
          backgroundColor: palette.surface.withValues(alpha: 0.92),
          foregroundColor: palette.textPrimary,
        ),
        icon: Icon(icon),
        onPressed: onTap,
      ),
    );
  }
}

class _HeroGallery extends ConsumerStatefulWidget {
  const _HeroGallery({required this.issue});

  final Issue issue;

  @override
  ConsumerState<_HeroGallery> createState() => _HeroGalleryState();
}

class _HeroGalleryState extends ConsumerState<_HeroGallery> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    final issue = widget.issue;
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final photos = [for (final u in issue.photoUrls) PhotoSource.url(u)];

    if (photos.isEmpty) {
      final c = ref.watch(metaProvider).category(issue.category);
      final tone = CategoryTone.of(hexColor(c.color), palette);
      return DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [tone.ink, Color.lerp(tone.ink, Colors.black, 0.35)!],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(AppIcons.category(issue.category), size: 64, color: Colors.white.withValues(alpha: 0.9)),
              Gap.h8,
              Text(
                'Người báo cáo không đính kèm ảnh',
                style: textTheme.bodySmall?.copyWith(color: Colors.white.withValues(alpha: 0.9)),
              ),
            ],
          ),
        ),
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        PageView.builder(
          itemCount: photos.length,
          onPageChanged: (i) => setState(() => _page = i),
          itemBuilder: (context, i) => GestureDetector(
            onTap: () => PhotoViewer.open(context, photos, initialIndex: i, title: 'Ảnh người dân chụp'),
            child: AppImage(photos[i], fullResolution: true, semanticLabel: 'Ảnh sự cố ${i + 1}/${photos.length}'),
          ),
        ),
        // Lớp tối phía trên cho thanh trạng thái và hai nút tròn.
        const IgnorePointer(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.center,
                colors: [Color(0x66000000), Color(0x00000000)],
              ),
            ),
          ),
        ),
        if (photos.length > 1)
          Positioned(
            right: Gap.screen,
            bottom: Radii.hero + Gap.sm,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.55),
                borderRadius: BorderRadius.circular(Radii.chip),
              ),
              child: Text(
                '${_page + 1}/${photos.length}',
                style: textTheme.labelSmall?.copyWith(color: Colors.white),
              ),
            ),
          ),
      ],
    );
  }
}

class _DetailBody extends ConsumerWidget {
  const _DetailBody({required this.issue});

  final Issue issue;

  Future<void> _vote(BuildContext context, WidgetRef ref) async {
    if (ref.read(currentUserProvider) == null) {
      await context.push(Uri(path: Routes.login, queryParameters: {'from': Routes.issue(issue.id)}).toString());
      return;
    }
    try {
      await ref.read(issueDetailProvider(issue.id).notifier).toggleVote();
    } on AppException catch (e) {
      if (context.mounted) showAppSnack(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final voted = issue.hasVoted(user?.id);
    final isStaffHere = user?.role == UserRole.staff &&
        staffCanHandle(issue, departmentId: user?.department?.id);

    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.screen, 0, Gap.screen, Gap.xxxl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: CategoryLabel(issue.category)),
              Text(Fmt.relative(issue.createdAt), style: textTheme.bodySmall),
            ],
          ),
          Gap.h8,
          Text(issue.title, style: textTheme.headlineSmall),
          if (issue.reporter?.name != null) ...[
            Gap.h4,
            Row(
              children: [
                Icon(Icons.person_outline, size: 16, color: palette.textSecondary),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    'Báo cáo bởi ${issue.reporter!.name} · ${Fmt.dateTime(issue.createdAt)}',
                    style: textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ],
          Gap.h12,
          Wrap(
            spacing: Gap.sm,
            runSpacing: Gap.sm,
            children: [
              StatusChip(issue.status),
              if (issue.priorityLevel != null) PriorityChip(issue.priorityLevel!, score: issue.priorityScore),
              if (issue.dueAt != null) SlaCountdown(issue: issue),
              if (issue.reopenCount > 0) ReopenedChip(issue.reopenCount),
            ],
          ),
          if (issue.mergedInto != null) ...[
            Gap.h16,
            AppCard(
              color: palette.offline.container,
              borderColor: Colors.transparent,
              elevated: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.merge_type, color: palette.offline.text),
                      Gap.w12,
                      Expanded(
                        child: Text(
                          'Báo cáo này đã được gộp vào “${issue.mergedInto!.title ?? 'sự cố gốc'}”. '
                          'Mọi cập nhật diễn ra trên sự cố gốc.',
                          style: textTheme.bodyMedium?.copyWith(color: palette.offline.text),
                        ),
                      ),
                    ],
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () => context.pushReplacement(Routes.issue(issue.mergedInto!.id)),
                      child: const Text('Xem sự cố gốc'),
                    ),
                  ),
                ],
              ),
            ),
          ],
          Gap.h16,
          // Chia sẻ nằm trên thanh tiêu đề (luôn hiện, kể cả khi đã cuộn).
          (voted ? FilledButton.tonalIcon : OutlinedButton.icon)(
            onPressed: issue.isMerged ? null : () => _vote(context, ref),
            icon: Icon(voted ? Icons.thumb_up_alt : Icons.thumb_up_alt_outlined),
            label: Text(voted ? 'Đã ủng hộ · ${issue.voteCount}' : 'Tôi cũng gặp · ${issue.voteCount}'),
          ),
          if (isStaffHere) ...[
            Gap.h8,
            FilledButton.icon(
              onPressed: () => context.push(Routes.staffIssue(issue.id)),
              icon: const Icon(Icons.engineering),
              label: const Text('Mở cổng xử lý của cán bộ'),
            ),
          ],
          if (issue.duplicateCount > 0) ...[
            Gap.h8,
            Text('${issue.duplicateCount} báo cáo trùng đã được gộp vào sự cố này.', style: textTheme.bodySmall),
          ],
          Gap.h16,
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SectionTitle('Mô tả', icon: Icons.notes),
                Text(
                  issue.description.isEmpty ? 'Không có mô tả.' : issue.description,
                  style: textTheme.bodyLarge,
                ),
                if (issue.phone != null && issue.phone!.isNotEmpty) ...[
                  Gap.h12,
                  Text('Số liên hệ của người báo cáo: ${issue.phone}', style: textTheme.bodySmall),
                ],
              ],
            ),
          ),
          Gap.h12,
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SectionTitle('Ảnh minh chứng', icon: Icons.photo_library_outlined),
                PhotoEvidenceStrip(
                  label: 'Người dân chụp',
                  photos: [for (final u in issue.photoUrls) PhotoSource.url(u)],
                  emptyText: 'Người báo cáo không đính kèm ảnh.',
                ),
                if (issue.resolutionImages.isNotEmpty || issue.status == IssueStatus.resolved) ...[
                  Gap.h16,
                  PhotoEvidenceStrip(
                    label: 'Đơn vị chụp sau xử lý',
                    icon: Icons.verified_outlined,
                    photos: [for (final i in issue.resolutionImages) PhotoSource.url(i.url)],
                    emptyText: 'Chưa có ảnh minh chứng.',
                  ),
                ],
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
          DepartmentCard(issue: issue),
          Gap.h12,
          // Thẻ đánh giá / mở lại tự mang khoảng cách phía dưới (ẩn khi không áp dụng).
          RatingCard(issue: issue),
          ReopenCard(issue: issue),
          TimelineSection(issue: issue),
          Gap.h12,
          // Hai khối "gần đây" tự mang khoảng cách phía dưới — rỗng thì biến mất
          // hẳn, không để lại hai khoảng trống trước bình luận.
          NearbyCamerasSection(issue: issue, onOpen: (c) => CameraPlayer.open(context, c)),
          NearbySection(issue: issue),
          CommentsSection(issueId: issue.id),
        ],
      ),
    );
  }
}
