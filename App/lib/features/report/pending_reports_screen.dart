import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/app_exception.dart';
import '../../core/platform/connectivity.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/photo_evidence_strip.dart';
import '../../core/widgets/status_chips.dart';
import '../../data/local/draft_store.dart';
import '../../data/repositories/issue_repository.dart';
import '../../data/repositories/meta_repository.dart';
import 'offline_queue.dart';

/// Ảnh của một phiếu chờ — đọc từ Hive một lần, không đọc lại mỗi lần build.
final _draftImagesProvider = FutureProvider.autoDispose.family<List<Uint8List>, String>(
  (ref, id) => ref.read(offlineQueueProvider.notifier).imagesOf(id),
);

/// Danh sách phiếu chờ gửi — xem/sửa/xoá được (design system 6.6, task 3.6).
class PendingReportsScreen extends ConsumerWidget {
  const PendingReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(offlineQueueProvider);
    final online = ref.watch(isOnlineProvider);
    final controller = ref.read(offlineQueueProvider.notifier);
    final meta = ref.watch(metaProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;

    Future<void> flush() async {
      final result = await controller.flush();
      if (!context.mounted) return;
      final sent = result.sent.length;
      final message = switch (result.stoppedBy) {
        null when sent > 0 => 'Đã gửi $sent báo cáo.',
        null => 'Không còn báo cáo nào gửi được — xem các phiếu cần sửa.',
        AppErrorKind.rateLimited =>
          'Đã gửi $sent. Máy chủ tạm giới hạn — sẽ tự gửi tiếp lúc ${Fmt.dateTime(result.retryAt)}.',
        AppErrorKind.network || AppErrorKind.timeout => 'Chưa có mạng. Sẽ tự gửi khi kết nối lại.',
        _ => 'Đã gửi $sent. Phần còn lại sẽ thử lại sau.',
      };
      showAppSnack(context, message);
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Báo cáo chờ gửi')),
      body: state.drafts.isEmpty
          ? const EmptyState(
              icon: Icons.cloud_done_outlined,
              title: 'Không có báo cáo nào đang chờ',
              message: 'Báo cáo soạn khi mất mạng sẽ được lưu ở đây và tự gửi khi có mạng trở lại.',
            )
          : ListView(
              padding: const EdgeInsets.all(Gap.screen),
              children: [
                Text(
                  online
                      ? 'App tự gửi khi mở lại hoặc khi mạng đổi. Gửi tuần tự để không vượt giới hạn '
                          '20 báo cáo/15 phút của máy chủ.'
                      : 'Đang ngoại tuyến — các báo cáo sẽ tự gửi khi có mạng.',
                  style: textTheme.bodySmall,
                ),
                if (state.retryAt != null) ...[
                  Gap.h8,
                  Text('Thử lại lúc ${Fmt.dateTime(state.retryAt)}',
                      style: textTheme.bodySmall?.copyWith(color: palette.offline.text)),
                ],
                Gap.h12,
                for (final d in state.drafts) ...[
                  _DraftCard(draft: d, categoryLabel: meta.categoryLabel(d.payload.category)),
                  Gap.h12,
                ],
              ],
            ),
      bottomNavigationBar: state.drafts.isEmpty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.screen, Gap.md),
                child: FilledButton.icon(
                  onPressed: !online || state.flushing ? null : flush,
                  icon: state.flushing
                      ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.cloud_upload_outlined),
                  label: Text(state.flushing ? 'Đang gửi…' : online ? 'Gửi ngay' : 'Chờ có mạng'),
                ),
              ),
            ),
    );
  }
}

class _DraftCard extends ConsumerWidget {
  const _DraftCard({required this.draft, required this.categoryLabel});

  final ReportDraft draft;
  final String categoryLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final attention = draft.state == DraftState.needsAttention;
    final controller = ref.read(offlineQueueProvider.notifier);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(Gap.card),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Icon(
                  attention ? Icons.error_outline : Icons.schedule_send_outlined,
                  color: attention ? palette.error : palette.offline.text,
                ),
                Gap.w8,
                Expanded(child: Text(draft.payload.title, style: textTheme.titleMedium)),
              ],
            ),
            Gap.h4,
            Text('$categoryLabel · ${draft.imageCount} ảnh · lưu ${Fmt.relative(draft.createdAt)}',
                style: textTheme.bodySmall),
            Text(draft.payload.location, style: textTheme.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis),
            if (draft.lastError != null) ...[
              Gap.h8,
              Text(
                attention ? 'Máy chủ từ chối: ${draft.lastError}' : 'Lần thử gần nhất: ${draft.lastError}',
                style: textTheme.bodySmall?.copyWith(color: attention ? palette.error : palette.textSecondary),
              ),
            ],
            Gap.h8,
            if (ref.watch(_draftImagesProvider(draft.id)).valueOrNull case final images?
                when images.isNotEmpty)
              PhotoEvidenceStrip(
                label: 'Ảnh đính kèm',
                photos: [for (final b in images) PhotoSource.bytes(b)],
                height: 64,
              ),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  onPressed: () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Xoá báo cáo chờ gửi?'),
                        content: const Text('Báo cáo chưa lên máy chủ nên xoá là mất hẳn.'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
                          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Xoá')),
                        ],
                      ),
                    );
                    if (ok == true) await controller.remove(draft.id);
                  },
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Xoá'),
                ),
                TextButton.icon(
                  onPressed: () => showModalBottomSheet<void>(
                    context: context,
                    isScrollControlled: true,
                    builder: (_) => _EditDraftSheet(draft: draft),
                  ),
                  icon: const Icon(Icons.edit_outlined),
                  label: Text(attention ? 'Sửa & gửi lại' : 'Sửa'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _EditDraftSheet extends ConsumerStatefulWidget {
  const _EditDraftSheet({required this.draft});

  final ReportDraft draft;

  @override
  ConsumerState<_EditDraftSheet> createState() => _EditDraftSheetState();
}

class _EditDraftSheetState extends ConsumerState<_EditDraftSheet> {
  late final _title = TextEditingController(text: widget.draft.payload.title);
  late final _description = TextEditingController(text: widget.draft.payload.description);
  late final _location = TextEditingController(text: widget.draft.payload.location);
  late String _category = widget.draft.payload.category;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _location.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final meta = ref.watch(metaProvider);
    final p = widget.draft.payload;
    final valid = _title.text.trim().isNotEmpty && _description.text.trim().isNotEmpty &&
        _location.text.trim().isNotEmpty;
    return Padding(
      padding: EdgeInsets.fromLTRB(Gap.screen, 0, Gap.screen, MediaQuery.viewInsetsOf(context).bottom + Gap.lg),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Sửa báo cáo chờ gửi', style: Theme.of(context).textTheme.titleLarge),
            Gap.h12,
            Wrap(
              spacing: Gap.sm,
              runSpacing: Gap.sm,
              children: [
                for (final c in meta.categories)
                  CategoryChoiceChip(
                    category: c.value,
                    selected: _category == c.value,
                    onSelected: () => setState(() => _category = c.value),
                  ),
              ],
            ),
            Gap.h12,
            TextField(
              controller: _title,
              maxLength: meta.limits.maxTitleLength,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: 'Tiêu đề'),
            ),
            TextField(
              controller: _description,
              maxLength: meta.limits.maxDescriptionLength,
              minLines: 3,
              maxLines: 6,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: 'Mô tả'),
            ),
            TextField(
              controller: _location,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: 'Địa chỉ'),
            ),
            Gap.h12,
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: !valid
                    ? null
                    : () async {
                        await ref.read(offlineQueueProvider.notifier).update(
                              widget.draft,
                              ReportPayload(
                                title: _title.text.trim(),
                                description: _description.text.trim(),
                                category: _category,
                                location: _location.text.trim(),
                                latitude: p.latitude,
                                longitude: p.longitude,
                                phone: p.phone,
                              ),
                            );
                        if (context.mounted) Navigator.pop(context);
                      },
                child: const Text('Lưu và gửi lại'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
