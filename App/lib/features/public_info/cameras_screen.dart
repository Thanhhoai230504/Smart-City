import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/widgets/async_states.dart';
import '../../core/widgets/photo_evidence_strip.dart';
import '../../core/widgets/surfaces.dart';
import '../../data/models/public_info.dart';
import '../../data/repositories/support_repositories.dart';
import 'camera_player.dart';

final camerasProvider =
    FutureProvider.autoDispose<List<PublicCamera>>((ref) => ref.read(publicRepositoryProvider).cameras());

/// Kênh YouTube công khai mà web dẫn tới ("Mở kênh nguồn").
const cameraSourceChannel = 'https://www.youtube.com/@0511.VietNam';

String cameraTypeLabel(String type) => switch (type) {
      'traffic' => 'Giao thông',
      'school' => 'Trường học',
      'construction' => 'Công trình',
      _ => 'Công cộng',
    };

/// Màu nhận diện loại camera — cùng bảng `CAMERA_TYPE_MAP` của web.
(IconData, Color) cameraTypeStyle(String type) => switch (type) {
      'traffic' => (Icons.traffic_outlined, const Color(0xFF0EA5E9)),
      'school' => (Icons.school_outlined, const Color(0xFF3B82F6)),
      'construction' => (Icons.construction, const Color(0xFFF59E0B)),
      _ => (Icons.videocam_outlined, const Color(0xFF8B5CF6)),
    };

/// Camera công cộng (task 2.9): **thumbnail tải trước, bấm mới mở webview**.
class CamerasScreen extends ConsumerStatefulWidget {
  const CamerasScreen({super.key});

  @override
  ConsumerState<CamerasScreen> createState() => _CamerasScreenState();
}

class _CamerasScreenState extends ConsumerState<CamerasScreen> {
  String _type = 'all';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(camerasProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Camera công cộng'),
        actions: [
          TextButton.icon(
            onPressed: () => launchUrl(Uri.parse(cameraSourceChannel), mode: LaunchMode.externalApplication),
            icon: const Icon(Icons.open_in_new, size: 18),
            label: const Text('Mở kênh nguồn'),
          ),
        ],
      ),
      body: async.when(
        loading: () => const SkeletonList(count: 4, itemHeight: 120),
        error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(camerasProvider)),
        data: (cams) {
          if (cams.isEmpty) {
            return const EmptyState(icon: Icons.videocam_off_outlined, title: 'Chưa có camera nào');
          }
          final types = [for (final t in ['traffic', 'school', 'construction', 'public']) if (cams.any((c) => c.type == t)) t];
          final shown = _type == 'all' ? cams : cams.where((c) => c.type == _type).toList();
          final located = cams.where((c) => c.lat != null && c.lng != null).length;

          return RefreshIndicator(
            onRefresh: () => ref.refresh(camerasProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.xs, Gap.screen, Gap.xxxl),
              children: [
                Text(
                  'Điểm quan sát công khai phục vụ giao thông và quản lý không gian đô thị.',
                  style: textTheme.bodyMedium?.copyWith(color: palette.textSecondary),
                ),
                Gap.h12,
                Row(
                  children: [
                    Expanded(child: _Stat(value: '${cams.length}', label: 'Nguồn video', icon: Icons.videocam_outlined)),
                    Gap.w8,
                    Expanded(child: _Stat(value: '$located', label: 'Có vị trí trên bản đồ', icon: Icons.place_outlined)),
                  ],
                ),
                Gap.h12,
                SizedBox(
                  height: 48,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(right: Gap.sm),
                        child: ChoiceChip(
                          label: Text('Tất cả (${cams.length})'),
                          selected: _type == 'all',
                          onSelected: (_) => setState(() => _type = 'all'),
                        ),
                      ),
                      for (final t in types)
                        Padding(
                          padding: const EdgeInsets.only(right: Gap.sm),
                          child: ChoiceChip(
                            showCheckmark: false,
                            avatar: Icon(
                              cameraTypeStyle(t).$1,
                              size: 16,
                              color: CategoryTone.of(cameraTypeStyle(t).$2, palette).ink,
                            ),
                            label: Text('${cameraTypeLabel(t)} (${cams.where((c) => c.type == t).length})'),
                            selected: _type == t,
                            onSelected: (_) => setState(() => _type = t),
                          ),
                        ),
                    ],
                  ),
                ),
                Gap.h8,
                for (final c in shown) ...[
                  _CameraCard(camera: c),
                  Gap.h12,
                ],
                Text(
                  'Nguồn video công khai từ kênh Phát Triển Đà Nẵng. Chủ kênh có thể dừng phát bất cứ lúc nào.',
                  style: textTheme.bodySmall,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label, required this.icon});

  final String value;
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return AppCard(
      padding: const EdgeInsets.all(Gap.md),
      child: Row(
        children: [
          IconBubble(icon: icon, ink: scheme.onPrimaryContainer, container: scheme.primaryContainer, size: 38),
          Gap.w12,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: textTheme.titleLarge),
                Text(label, style: textTheme.bodySmall, maxLines: 2),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CameraCard extends StatelessWidget {
  const _CameraCard({required this.camera});

  final PublicCamera camera;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final (icon, color) = cameraTypeStyle(camera.type);
    final tone = CategoryTone.of(color, palette);
    return AppCard(
      padding: EdgeInsets.zero,
      onTap: () => CameraPlayer.open(context, camera),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AppImage(PhotoSource.url(camera.thumbnailUrl), semanticLabel: 'Ảnh xem trước ${camera.name}'),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.center,
                      end: Alignment.bottomCenter,
                      colors: [Color(0x00000000), Color(0x66000000)],
                    ),
                  ),
                ),
                Center(
                  child: Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.45), shape: BoxShape.circle),
                    child: const Icon(Icons.play_arrow_rounded, size: 40, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(Gap.md),
            child: Row(
              children: [
                IconBubble(icon: icon, ink: tone.ink, container: tone.container, size: 36),
                Gap.w12,
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(camera.name, style: textTheme.titleSmall, maxLines: 2, overflow: TextOverflow.ellipsis),
                      Text(cameraTypeLabel(camera.type), style: textTheme.bodySmall),
                    ],
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
