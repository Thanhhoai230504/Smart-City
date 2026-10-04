import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_states.dart';
import '../../../core/widgets/status_chips.dart';
import '../../../data/repositories/meta_repository.dart';
import '../report_controller.dart';

/// Bước 2 — AI gợi ý + thông tin (task 3.2). AI chỉ prefill khi ô còn trống và
/// luôn cho người dân sửa; AI lỗi thì form vẫn dùng bình thường.
class InfoStep extends ConsumerStatefulWidget {
  const InfoStep({super.key});

  @override
  ConsumerState<InfoStep> createState() => _InfoStepState();
}

class _InfoStepState extends ConsumerState<InfoStep> {
  late final TextEditingController _title;
  late final TextEditingController _description;

  @override
  void initState() {
    super.initState();
    final s = ref.read(reportControllerProvider);
    _title = TextEditingController(text: s.title);
    _description = TextEditingController(text: s.description);
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  /// AI điền vào khi người dân chưa gõ gì — đồng bộ ngược vào ô nhập.
  void _sync(ReportState s) {
    if (_title.text != s.title && s.title.isNotEmpty && _title.text.isEmpty) _title.text = s.title;
    if (_description.text != s.description && s.description.isNotEmpty && _description.text.isEmpty) {
      _description.text = s.description;
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(reportControllerProvider);
    final controller = ref.read(reportControllerProvider.notifier);
    final meta = ref.watch(metaProvider);
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;
    ref.listen(reportControllerProvider, (_, next) => _sync(next));

    return ListView(
      padding: const EdgeInsets.all(Gap.screen),
      children: [
        _AiCard(state: state, onRetry: controller.runAi),
        Gap.h16,
        Text('Loại sự cố', style: textTheme.titleMedium),
        if (state.fieldErrors['category'] != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(state.fieldErrors['category']!,
                style: textTheme.bodySmall?.copyWith(color: palette.error)),
          ),
        Gap.h8,
        Wrap(
          spacing: Gap.sm,
          runSpacing: Gap.sm,
          children: [
            for (final c in meta.categories)
              CategoryChoiceChip(
                category: c.value,
                selected: state.category == c.value,
                onSelected: () => controller.setCategory(c.value),
              ),
          ],
        ),
        Gap.h16,
        TextField(
          controller: _title,
          maxLength: meta.limits.maxTitleLength,
          textInputAction: TextInputAction.next,
          textCapitalization: TextCapitalization.sentences,
          onChanged: controller.setTitle,
          decoration: InputDecoration(
            labelText: 'Tiêu đề *',
            hintText: 'Ví dụ: Ổ gà lớn trước số 12 Lê Duẩn',
            errorText: state.fieldErrors['title'],
          ),
        ),
        Gap.h8,
        TextField(
          controller: _description,
          maxLength: meta.limits.maxDescriptionLength,
          minLines: 4,
          maxLines: 8,
          textCapitalization: TextCapitalization.sentences,
          onChanged: controller.setDescription,
          decoration: InputDecoration(
            labelText: 'Mô tả *',
            hintText: 'Kích thước, mức độ nguy hiểm, đã tồn tại bao lâu…',
            alignLabelWithHint: true,
            errorText: state.fieldErrors['description'],
          ),
        ),
        if (state.duplicates.candidates.isNotEmpty) ...[
          Gap.h8,
          Row(
            children: [
              Icon(Icons.info_outline, size: 18, color: palette.primary),
              Gap.w8,
              Expanded(
                child: Text(
                  'Có ${state.duplicates.candidates.length} báo cáo tương tự gần đây — xem ở bước cuối.',
                  style: textTheme.bodySmall?.copyWith(color: palette.primary),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _AiCard extends StatelessWidget {
  const _AiCard({required this.state, required this.onRetry});

  final ReportState state;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final s = state.suggestion;

    final (IconData icon, String title, String body) = switch (state.ai) {
      AiStatus.idle when state.photos.isEmpty => (
          Icons.auto_awesome_outlined,
          'Gợi ý bằng AI',
          'Thêm ảnh ở bước 1 để AI gợi ý loại sự cố và mô tả.',
        ),
      AiStatus.idle || AiStatus.loading => (
          Icons.auto_awesome,
          'AI đang phân tích ảnh…',
          'Bạn có thể nhập trước — AI sẽ không ghi đè nội dung bạn đã gõ.',
        ),
      AiStatus.done => (
          Icons.auto_awesome,
          'AI gợi ý · độ tin cậy ${((s?.confidence ?? 0) * 100).round()}%',
          'Đã điền sẵn loại sự cố và mô tả. Hãy kiểm tra và sửa nếu chưa đúng.',
        ),
      AiStatus.failed => (
          Icons.info_outline,
          'Không phân tích được ảnh',
          'Vui lòng tự chọn loại sự cố. Báo cáo vẫn gửi bình thường.',
        ),
    };

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(Gap.card),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: palette.primary),
            Gap.w12,
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title, style: textTheme.titleSmall),
                  Gap.h4,
                  Text(body, style: textTheme.bodySmall),
                  if (state.ai == AiStatus.loading) ...[
                    Gap.h8,
                    const SkeletonBox(height: 10, width: 140),
                  ],
                  if (state.ai == AiStatus.failed && state.photos.isNotEmpty)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: onRetry,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Thử lại'),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
