import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/photo_evidence_strip.dart';
import '../../data/models/issue.dart';
import '../../data/repositories/meta_repository.dart';
import '../report/photo_tools.dart';
import 'resolve_flow.dart';
import 'staff_actions.dart';

/// Hai bước của luồng hoàn tất — để biết khi lỗi thì thử lại bước nào.
enum ResolvePhase { idle, uploading, updatingStatus }

/// ⭐ Hoàn tất việc tại hiện trường (task 4.5):
///
/// 1. Chụp ảnh minh chứng → `POST /:id/resolution-images` **TRƯỚC**;
/// 2. rồi mới `PATCH /:id/status = resolved`.
///
/// Đúng thứ tự backend bắt buộc (`NO_RESOLUTION_IMAGE`). Upload xong mà đổi
/// trạng thái lỗi thì **ảnh đã lên, không upload lại** — chỉ thử lại bước 2.
class ResolveScreen extends ConsumerStatefulWidget {
  const ResolveScreen({super.key, required this.issue});

  final Issue issue;

  @override
  ConsumerState<ResolveScreen> createState() => _ResolveScreenState();
}

class _ResolveScreenState extends ConsumerState<ResolveScreen> {
  final List<PickedPhoto> _newPhotos = [];
  late final ResolveFlow _flow = ResolveFlow(
    upload: (images) => ref.read(staffActionsProvider(widget.issue.id)).uploadResolutionImages(images),
    markResolved: (note) =>
        ref.read(staffActionsProvider(widget.issue.id)).updateStatus(IssueStatus.resolved, note: note),
    alreadyUploaded: widget.issue.resolutionImages,
  );
  List<IssueImage> get _uploaded => _flow.uploaded;
  final _note = TextEditingController();
  ResolvePhase _phase = ResolvePhase.idle;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  int get _maxImages => ref.read(metaProvider).limits.maxImages;

  Future<void> _addPhotos({required bool camera}) async {
    final limits = ref.read(metaProvider).limits;
    final remaining = _maxImages - _uploaded.length - _newPhotos.length;
    if (remaining <= 0) {
      showAppSnack(context, 'Tối đa $_maxImages ảnh minh chứng.');
      return;
    }
    try {
      final picked = await PhotoPicker(maxBytes: limits.maxImageBytes)
          .pick(camera: camera, remaining: remaining);
      final merged = mergePhotos(_newPhotos, picked, maxImages: remaining + _newPhotos.length);
      if (!mounted) return;
      setState(() {
        _newPhotos
          ..clear()
          ..addAll(merged.photos);
        _error = null;
      });
      if (merged.duplicates > 0) showAppSnack(context, '${merged.duplicates} ảnh trùng đã bị bỏ qua');
    } on PhotoRejected catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } catch (_) {
      if (mounted) showAppSnack(context, 'Không mở được camera/thư viện ảnh.', error: true);
    }
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    _flow.pending
      ..clear()
      ..addAll([for (var i = 0; i < _newPhotos.length; i++) _newPhotos[i].toUpload(i)]);

    final outcome = await _flow.run(
      note: _note.text,
      onPhase: (uploading) {
        if (mounted) {
          setState(() => _phase = uploading ? ResolvePhase.uploading : ResolvePhase.updatingStatus);
        }
      },
    );
    if (!mounted) return;
    if (_flow.pending.isEmpty) _newPhotos.clear();

    switch (outcome) {
      case ResolveDone():
        Navigator.of(context).pop(true);
        return;
      case ResolveNeedsPhotos():
        _error = 'Cần ít nhất 1 ảnh minh chứng sau xử lý.';
      case ResolveUploadFailed(:final error):
        _error = 'Tải ảnh thất bại: ${error.message}';
      case ResolveStatusFailed(:final error):
        _error = switch (error.code) {
          'NO_RESOLUTION_IMAGE' => 'Máy chủ chưa thấy ảnh minh chứng. Hãy chụp lại ảnh.',
          'INVALID_STATUS_TRANSITION' => 'Phiếu đã đổi trạng thái ở nơi khác. Đã tải lại phiếu.',
          'MERGED_ISSUE' => 'Phiếu đã được gộp vào sự cố khác — hãy cập nhật sự cố gốc.',
          _ => 'Ảnh đã tải lên. Cập nhật trạng thái thất bại: ${error.message} — bấm "Thử lại", '
              'ảnh sẽ không phải tải lại.',
        };
        if (error.code == 'INVALID_STATUS_TRANSITION') {
          await ref.read(staffActionsProvider(widget.issue.id)).reload();
        }
    }
    if (mounted) setState(() => _phase = ResolvePhase.idle);
  }

  @override
  Widget build(BuildContext context) {
    final meta = ref.watch(metaProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final busy = _phase != ResolvePhase.idle;
    final total = _uploaded.length + _newPhotos.length;
    final statusFailedAfterUpload = _error != null && _newPhotos.isEmpty && _uploaded.isNotEmpty;

    return PopScope(
      canPop: !busy,
      child: Scaffold(
        appBar: AppBar(title: const Text('Hoàn tất xử lý')),
        body: ListView(
          padding: const EdgeInsets.all(Gap.screen),
          children: [
            Text(widget.issue.title, style: textTheme.titleLarge),
            Gap.h8,
            Text(
              'Chụp ảnh hiện trường sau khi xử lý. Ảnh minh chứng là căn cứ để người dân đánh giá — '
              'bắt buộc trước khi báo "Đã xử lý".',
              style: textTheme.bodySmall,
            ),
            Gap.h16,
            PhotoEvidenceStrip(
              label: 'Người dân chụp (trước)',
              photos: [for (final u in widget.issue.photoUrls) PhotoSource.url(u)],
              emptyText: 'Không có ảnh trước xử lý.',
              height: 72,
            ),
            Gap.h16,
            PhotoEvidenceStrip(
              label: 'Ảnh minh chứng đã tải lên',
              icon: Icons.verified_outlined,
              photos: [for (final i in _uploaded) PhotoSource.url(i.url)],
              emptyText: 'Chưa có ảnh nào trên máy chủ.',
              height: 72,
            ),
            if (_newPhotos.isNotEmpty) ...[
              Gap.h16,
              PhotoEvidenceStrip(
                label: 'Ảnh mới — sẽ tải lên khi bấm Hoàn tất',
                icon: Icons.photo_camera_outlined,
                photos: [for (final p in _newPhotos) PhotoSource.bytes(p.bytes)],
                height: 72,
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: busy ? null : () => setState(_newPhotos.clear),
                  child: const Text('Bỏ ảnh mới'),
                ),
              ),
            ],
            Gap.h12,
            Row(
              children: [
                Expanded(
                  child: FilledButton.tonalIcon(
                    onPressed: busy || total >= meta.limits.maxImages ? null : () => _addPhotos(camera: true),
                    icon: const Icon(Icons.photo_camera),
                    label: const Text('Chụp ảnh'),
                  ),
                ),
                Gap.w12,
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: busy || total >= meta.limits.maxImages ? null : () => _addPhotos(camera: false),
                    icon: const Icon(Icons.photo_library_outlined),
                    label: const Text('Thư viện'),
                  ),
                ),
              ],
            ),
            Gap.h4,
            Text('$total/${meta.limits.maxImages} ảnh', style: textTheme.bodySmall),
            Gap.h16,
            TextField(
              controller: _note,
              enabled: !busy,
              maxLength: meta.limits.maxNoteLength,
              minLines: 2,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'Ghi chú xử lý (không bắt buộc)',
                hintText: 'Đã vá ổ gà bằng nhựa đường nóng…',
                alignLabelWithHint: true,
              ),
            ),
            if (_error != null) ...[
              Gap.h8,
              Container(
                padding: const EdgeInsets.all(Gap.md),
                decoration: BoxDecoration(
                  color: palette.danger.container,
                  borderRadius: BorderRadius.circular(Radii.card),
                ),
                child: Text(_error!, style: textTheme.bodySmall?.copyWith(color: palette.danger.text)),
              ),
            ],
          ],
        ),
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.screen, Gap.md),
            child: FilledButton.icon(
              onPressed: busy || total == 0 ? null : _submit,
              icon: busy
                  ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.task_alt),
              label: Text(switch (_phase) {
                ResolvePhase.uploading => 'Đang tải ảnh lên…',
                ResolvePhase.updatingStatus => 'Đang cập nhật trạng thái…',
                ResolvePhase.idle => statusFailedAfterUpload ? 'Thử lại' : 'Hoàn tất — báo đã xử lý',
              }),
            ),
          ),
        ),
      ),
    );
  }
}
