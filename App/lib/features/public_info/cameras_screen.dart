import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/photo_evidence_strip.dart';
import '../../data/models/public_info.dart';
import '../../data/repositories/support_repositories.dart';
import 'camera_player.dart';

final camerasProvider =
    FutureProvider.autoDispose<List<PublicCamera>>((ref) => ref.read(publicRepositoryProvider).cameras());

String cameraTypeLabel(String type) => switch (type) {
      'traffic' => 'Giao thông',
      'school' => 'Trường học',
      'construction' => 'Công trình',
      _ => 'Công cộng',
    };

/// Camera công cộng (task 2.9): **thumbnail tải trước, bấm mới mở webview**.
class CamerasScreen extends ConsumerWidget {
  const CamerasScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(camerasProvider);
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Camera công cộng')),
      body: async.when(
        loading: () => const SkeletonList(count: 4, itemHeight: 120),
        error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(camerasProvider)),
        data: (cams) => cams.isEmpty
            ? const EmptyState(icon: Icons.videocam_off_outlined, title: 'Chưa có camera nào')
            : ListView.separated(
                padding: const EdgeInsets.all(Gap.screen),
                itemCount: cams.length,
                separatorBuilder: (_, _) => Gap.h12,
                itemBuilder: (context, i) {
                  final c = cams[i];
                  return Card(
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => CameraPlayer.open(context, c),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          AspectRatio(
                            aspectRatio: 16 / 9,
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                AppImage(PhotoSource.url(c.thumbnailUrl), semanticLabel: 'Ảnh xem trước ${c.name}'),
                                const Center(
                                  child: Icon(Icons.play_circle_fill, size: 56, color: Colors.white70),
                                ),
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(Gap.md),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(c.name, style: textTheme.titleSmall),
                                Text(cameraTypeLabel(c.type), style: textTheme.bodySmall),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
