import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_states.dart';
import '../../../core/widgets/photo_evidence_strip.dart';
import '../../../core/widgets/surfaces.dart';
import '../../../data/repositories/meta_repository.dart';
import '../report_controller.dart';

/// Bước 1 — ảnh (task 3.1): tối đa `limits.maxImages`, nén ≤ 1920px, chống
/// chọn trùng theo hash.
class PhotoStep extends ConsumerWidget {
  const PhotoStep({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(reportControllerProvider);
    final controller = ref.read(reportControllerProvider.notifier);
    final limits = ref.watch(metaProvider).limits;
    final max = limits.maxImages;
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final full = state.photos.length >= max;

    Future<void> add({required bool camera}) async {
      final note = await controller.addPhotos(camera: camera);
      if (note != null && context.mounted) showAppSnack(context, note);
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.screen, Gap.xl),
      children: [
        if (state.photos.isEmpty) ...[
          _CameraPanel(onTap: () => add(camera: true)),
          Gap.h12,
          OutlinedButton.icon(
            onPressed: () => add(camera: false),
            icon: const Icon(Icons.photo_library_outlined),
            label: const Text('Chọn từ thư viện'),
          ),
        ] else ...[
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: Gap.sm,
              crossAxisSpacing: Gap.sm,
            ),
            itemCount: state.photos.length + (full ? 0 : 1),
            itemBuilder: (context, i) {
              if (i == state.photos.length) return _AddTile(onTap: () => add(camera: true));
              final photo = state.photos[i];
              return Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(Radii.image),
                    child: GestureDetector(
                      onTap: () => PhotoViewer.open(
                        context,
                        [for (final p in state.photos) PhotoSource.bytes(p.bytes)],
                        initialIndex: i,
                        title: 'Ảnh sự cố',
                      ),
                      child: AppImage(PhotoSource.bytes(photo.bytes), semanticLabel: 'Ảnh ${i + 1}'),
                    ),
                  ),
                  if (i == 0)
                    Positioned(
                      left: 6,
                      bottom: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: palette.accent,
                          borderRadius: BorderRadius.circular(Radii.chip),
                        ),
                        child: Text('Ảnh chính', style: textTheme.labelSmall?.copyWith(color: palette.onAccent)),
                      ),
                    ),
                  Positioned(
                    top: 0,
                    right: 0,
                    child: IconButton(
                      tooltip: 'Xoá ảnh ${i + 1}',
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.black.withValues(alpha: 0.6),
                        foregroundColor: Colors.white,
                        minimumSize: const Size(36, 36),
                      ),
                      onPressed: () => controller.removePhoto(i),
                      icon: const Icon(Icons.close, size: 18),
                    ),
                  ),
                ],
              );
            },
          ),
          Gap.h12,
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: full ? null : () => add(camera: true),
                  icon: const Icon(Icons.photo_camera),
                  label: const Text('Chụp thêm'),
                ),
              ),
              Gap.w12,
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: full ? null : () => add(camera: false),
                  icon: const Icon(Icons.photo_library_outlined),
                  label: const Text('Thư viện'),
                ),
              ),
            ],
          ),
        ],
        Gap.h8,
        Text(
          '${state.photos.length}/$max ảnh · tối đa ${limits.maxImageMb} MB mỗi ảnh · ảnh không bắt buộc',
          style: textTheme.bodySmall,
          textAlign: TextAlign.center,
        ),
        Gap.h16,
        AppCard(
          elevated: false,
          color: palette.surfaceAlt,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconBubble(icon: Icons.tips_and_updates_outlined, ink: palette.accentInk, container: palette.accentSoft, size: 36),
              Gap.w12,
              Expanded(
                child: Text(
                  'Chụp rõ sự cố và một chút cảnh xung quanh (biển số nhà, cột điện…) để đơn vị tìm đúng chỗ. '
                  'Ảnh đầu tiên được AI dùng để gợi ý loại sự cố.',
                  style: textTheme.bodySmall,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Ô chụp ảnh cỡ lớn — hành động chính của bước này, chạm một lần là mở camera.
class _CameraPanel extends StatelessWidget {
  const _CameraPanel({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      label: 'Chụp ảnh hiện trường',
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.card),
          onTap: onTap,
          child: Ink(
            padding: const EdgeInsets.symmetric(vertical: Gap.xxxl, horizontal: Gap.xl),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(Radii.card),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color.alphaBlend(palette.brandStart.withValues(alpha: 0.10), palette.surface),
                  Color.alphaBlend(palette.brandEnd.withValues(alpha: 0.16), palette.surface),
                ],
              ),
              border: Border.all(color: palette.primary.withValues(alpha: 0.25), width: 1.5),
            ),
            child: Column(
              children: [
                Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: palette.accent,
                    boxShadow: palette.brightness == Brightness.light
                        ? [BoxShadow(color: palette.accent.withValues(alpha: 0.35), blurRadius: 18, offset: const Offset(0, 6))]
                        : null,
                  ),
                  child: Icon(Icons.photo_camera_rounded, size: 36, color: palette.onAccent),
                ),
                Gap.h16,
                Text('Chụp ảnh hiện trường', style: textTheme.titleLarge, textAlign: TextAlign.center),
                Gap.h4,
                Text(
                  'AI sẽ gợi ý loại sự cố từ ảnh — bạn chỉ cần xác nhận.',
                  style: textTheme.bodyMedium?.copyWith(color: palette.textSecondary),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AddTile extends StatelessWidget {
  const _AddTile({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Semantics(
      button: true,
      label: 'Chụp thêm ảnh',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.image),
        onTap: onTap,
        child: Ink(
          decoration: BoxDecoration(
            color: palette.field,
            borderRadius: BorderRadius.circular(Radii.image),
            border: Border.all(color: palette.border, width: 1.5),
          ),
          child: Icon(Icons.add_a_photo_outlined, color: palette.primary, size: 30),
        ),
      ),
    );
  }
}
