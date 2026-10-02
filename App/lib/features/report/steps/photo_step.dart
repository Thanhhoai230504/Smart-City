import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_states.dart';
import '../../../core/widgets/photo_evidence_strip.dart';
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
    final max = ref.watch(metaProvider).limits.maxImages;
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final full = state.photos.length >= max;

    Future<void> add({required bool camera}) async {
      final note = await controller.addPhotos(camera: camera);
      if (note != null && context.mounted) showAppSnack(context, note);
    }

    return ListView(
      padding: const EdgeInsets.all(Gap.screen),
      children: [
        Text(
          'Ảnh giúp đơn vị xử lý xác định đúng sự cố và AI gợi ý loại sự cố cho bạn.',
          style: textTheme.bodyMedium?.copyWith(color: palette.textSecondary),
        ),
        Gap.h16,
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: full ? null : () => add(camera: true),
                icon: const Icon(Icons.photo_camera),
                label: const Text('Chụp ảnh'),
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
        Gap.h8,
        Text(
          '${state.photos.length}/$max ảnh · tối đa ${ref.watch(metaProvider).limits.maxImageMb} MB mỗi ảnh',
          style: textTheme.bodySmall,
        ),
        Gap.h16,
        if (state.photos.isEmpty)
          Container(
            padding: const EdgeInsets.all(Gap.xxl),
            decoration: BoxDecoration(
              color: palette.surfaceAlt,
              borderRadius: BorderRadius.circular(Radii.card),
              border: Border.all(color: palette.border),
            ),
            child: Column(
              children: [
                Icon(Icons.add_a_photo_outlined, size: 40, color: palette.textSecondary),
                Gap.h8,
                Text('Chưa có ảnh', style: textTheme.titleMedium),
                Gap.h4,
                Text(
                  'Ảnh không bắt buộc — bạn vẫn có thể tiếp tục.',
                  style: textTheme.bodySmall,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          )
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: Gap.sm,
              crossAxisSpacing: Gap.sm,
            ),
            itemCount: state.photos.length,
            itemBuilder: (context, i) {
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
                      left: 4,
                      bottom: 4,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.7),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text('Ảnh chính',
                            style: TextStyle(color: Colors.white, fontSize: 11)),
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
      ],
    );
  }
}
