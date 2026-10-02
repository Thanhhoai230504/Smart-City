import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/platform/connectivity.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_states.dart';
import '../../../core/widgets/photo_evidence_strip.dart';
import '../../../core/widgets/status_chips.dart';
import '../../../data/models/issue.dart';
import '../../../data/models/report_support.dart';
import '../../../data/repositories/meta_repository.dart';
import '../report_controller.dart';

/// Bước 4 — xác nhận, dò trùng, gửi (task 3.4, 3.5).
class ReviewStep extends ConsumerStatefulWidget {
  const ReviewStep({super.key, required this.onConfirmDuplicate});

  /// Người dân xác nhận một báo cáo gần đó chính là sự cố họ định gửi.
  final Future<void> Function(DuplicateCandidate candidate) onConfirmDuplicate;

  @override
  ConsumerState<ReviewStep> createState() => _ReviewStepState();
}

class _ReviewStepState extends ConsumerState<ReviewStep> {
  late final TextEditingController _phone =
      TextEditingController(text: ref.read(reportControllerProvider).phone);

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(reportControllerProvider);
    final controller = ref.read(reportControllerProvider.notifier);
    final meta = ref.watch(metaProvider);
    final online = ref.watch(isOnlineProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;

    Widget editRow(String label, String value, int step) => InkWell(
          onTap: state.submitting ? null : () => controller.goTo(step),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: Gap.sm),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 84,
                  child: Text(label, style: textTheme.bodySmall),
                ),
                Expanded(child: Text(value, style: textTheme.bodyMedium)),
                Icon(Icons.edit_outlined, size: 18, color: palette.textSecondary),
              ],
            ),
          ),
        );

    return ListView(
      padding: const EdgeInsets.all(Gap.screen),
      children: [
        if (!online)
          Padding(
            padding: const EdgeInsets.only(bottom: Gap.md),
            child: _Notice(
              icon: Icons.cloud_off_outlined,
              text: 'Bạn đang ngoại tuyến. Báo cáo sẽ được lưu trên máy và tự gửi khi có mạng.',
              colors: palette.offline,
            ),
          ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(Gap.card),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                PhotoEvidenceStrip(
                  label: 'Ảnh người dân chụp',
                  photos: [for (final p in state.photos) PhotoSource.bytes(p.bytes)],
                  emptyText: 'Không có ảnh',
                  height: 72,
                ),
                const Divider(height: Gap.xxl),
                editRow('Loại', '${meta.category(state.category ?? 'other').icon} '
                    '${meta.categoryLabel(state.category ?? 'other')}', 1),
                editRow('Tiêu đề', state.title.trim(), 1),
                editRow('Mô tả', state.description.trim(), 1),
                editRow('Địa chỉ', state.address.trim(), 2),
              ],
            ),
          ),
        ),
        Gap.h16,
        TextField(
          controller: _phone,
          keyboardType: TextInputType.phone,
          onChanged: controller.setPhone,
          decoration: InputDecoration(
            labelText: 'Số điện thoại liên hệ (không bắt buộc)',
            helperText: 'Chỉ cán bộ xử lý thấy số này — để gọi lại khi cần xác minh.',
            errorText: state.fieldErrors['phone'] ?? _phoneError(state.phone),
            prefixIcon: const Icon(Icons.phone_outlined),
          ),
        ),
        Gap.h24,
        _DuplicateSection(state: state, onConfirm: widget.onConfirmDuplicate),
        if (state.error != null) ...[
          Gap.h16,
          _Notice(
            icon: Icons.error_outline,
            text: state.error!,
            colors: palette.danger,
          ),
        ],
        if (state.submitting) ...[
          Gap.h16,
          LinearProgressIndicator(value: state.progress > 0 ? state.progress : null),
          Gap.h4,
          Text(
            state.progress > 0 && state.progress < 1
                ? 'Đang tải ảnh lên… ${(state.progress * 100).round()}%'
                : 'Đang gửi…',
            style: textTheme.bodySmall,
          ),
        ],
      ],
    );
  }

  String? _phoneError(String phone) {
    if (phone.trim().isEmpty) return null;
    return RegExp(r'^(0|\+84)[0-9]{9,10}$').hasMatch(phone.trim())
        ? null
        : 'Số điện thoại không hợp lệ (ví dụ 0905123456)';
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.text, required this.colors});

  final IconData icon;
  final String text;
  final ChipColors colors;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(Gap.md),
        decoration: BoxDecoration(
          color: colors.container,
          borderRadius: BorderRadius.circular(Radii.card),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: colors.text, size: 20),
            Gap.w12,
            Expanded(
              child: Text(
                text,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.text),
              ),
            ),
          ],
        ),
      );
}

class _DuplicateSection extends StatelessWidget {
  const _DuplicateSection({required this.state, required this.onConfirm});

  final ReportState state;
  final Future<void> Function(DuplicateCandidate) onConfirm;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;
    final result = state.duplicates;

    final header = Row(
      children: [
        Icon(Icons.manage_search, color: palette.primary),
        Gap.w8,
        Expanded(child: Text('Báo cáo tương tự gần đây', style: textTheme.titleMedium)),
      ],
    );

    final Widget body = switch (state.duplicateStatus) {
      LookupStatus.loading => const Padding(
          padding: EdgeInsets.symmetric(vertical: Gap.md),
          child: Column(children: [SkeletonBox(height: 56), SizedBox(height: 8), SkeletonBox(height: 56)]),
        ),
      LookupStatus.failed => Text(
          'Không kiểm tra được báo cáo trùng lúc này. Bạn vẫn có thể gửi báo cáo.',
          style: textTheme.bodySmall,
        ),
      _ when result.candidates.isEmpty => Text(
          state.canCheckDuplicates
              ? 'Không thấy báo cáo nào tương tự quanh đây.'
              : 'Cần tiêu đề, mô tả (từ 10 ký tự) và vị trí để kiểm tra.',
          style: textTheme.bodySmall,
        ),
      _ => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Nếu một trong số này đúng là sự cố bạn định báo, hãy xác nhận — '
              'đơn vị xử lý sẽ thấy thêm một người dân xác nhận và bạn vẫn nhận cập nhật.',
              style: textTheme.bodySmall,
            ),
            if (result.isFallback) ...[
              Gap.h8,
              InfoChip(
                label: 'Đang dùng phương án dự phòng (so khớp từ khoá)',
                icon: Icons.info_outline,
                colors: palette.offline,
                dense: true,
              ),
            ],
            Gap.h12,
            for (final c in result.candidates) ...[
              _CandidateCard(candidate: c, onConfirm: () => onConfirm(c)),
              Gap.h8,
            ],
          ],
        ),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [header, Gap.h8, body],
    );
  }
}

class _CandidateCard extends StatelessWidget {
  const _CandidateCard({required this.candidate, required this.onConfirm});

  final DuplicateCandidate candidate;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;
    final issue = candidate.issue;
    final confidenceColors = switch (candidate.confidence) {
      DuplicateConfidence.high => palette.priorityColors(PriorityLevel.high),
      DuplicateConfidence.possible => palette.priorityColors(PriorityLevel.medium),
      DuplicateConfidence.low => palette.priorityColors(PriorityLevel.low),
    };

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(Gap.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (issue.coverUrl != null) ...[
                  ClipRRect(
                    borderRadius: BorderRadius.circular(Radii.image),
                    child: SizedBox.square(
                      dimension: 56,
                      child: AppImage(PhotoSource.url(issue.coverUrl!)),
                    ),
                  ),
                  Gap.w12,
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(issue.title, style: textTheme.titleSmall, maxLines: 2, overflow: TextOverflow.ellipsis),
                      Gap.h4,
                      Text(
                        'Cách ${Fmt.distance(candidate.distanceMeters)} · ${Fmt.relative(issue.createdAt)}',
                        style: textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            Gap.h8,
            Wrap(
              spacing: Gap.sm,
              runSpacing: Gap.xs,
              children: [
                InfoChip(
                  label: '${candidate.confidence.label} · ${(candidate.duplicateScore * 100).round()}%',
                  icon: Icons.compare_arrows,
                  colors: confidenceColors,
                  dense: true,
                ),
                StatusChip(issue.status, dense: true),
              ],
            ),
            if (candidate.reasons.isNotEmpty) ...[
              Gap.h8,
              for (final r in candidate.reasons.take(3))
                Text('• $r', style: textTheme.bodySmall),
            ],
            Gap.h8,
            Align(
              alignment: Alignment.centerRight,
              child: OutlinedButton.icon(
                onPressed: onConfirm,
                icon: const Icon(Icons.how_to_vote_outlined),
                label: const Text('Đây là cùng một sự cố'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
