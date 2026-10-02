import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/app_config.dart';
import '../../core/platform/app_info.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../data/repositories/meta_repository.dart';
import '../auth/auth_controller.dart';
import 'theme_controller.dart';

/// Cài đặt (task 6.3). Bật/tắt push chờ B2 (FCM) nên chưa có ở đây.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    final info = ref.watch(appInfoProvider);
    final meta = ref.watch(metaProvider);
    final user = ref.watch(currentUserProvider);
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Cài đặt')),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: Gap.lg),
        children: [
          Padding(
            padding: Gap.screenPadding,
            child: Text('Giao diện', style: textTheme.titleMedium),
          ),
          Gap.h8,
          Padding(
            padding: Gap.screenPadding,
            child: SegmentedButton<ThemeMode>(
              segments: const [
                ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode_outlined), label: Text('Sáng')),
                ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode_outlined), label: Text('Tối')),
                ButtonSegment(
                    value: ThemeMode.system, icon: Icon(Icons.brightness_auto_outlined), label: Text('Hệ thống')),
              ],
              selected: {mode},
              onSelectionChanged: (s) => ref.read(themeModeProvider.notifier).set(s.first),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.screen, 0),
            child: Text(
              'Đi hiện trường dưới nắng? Chọn "Sáng" để chữ rõ nhất. Cỡ chữ theo cài đặt của điện thoại.',
              style: textTheme.bodySmall,
            ),
          ),
          Gap.h16,
          const Divider(),
          const ListTile(
            leading: Icon(Icons.notifications_outlined),
            title: Text('Thông báo đẩy'),
            subtitle: Text(
              'Hiện nhận thông báo khi app đang mở. Thông báo đẩy khi tắt app sẽ có sau khi máy chủ bật Firebase.',
            ),
            isThreeLine: true,
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('Phiên bản ứng dụng'),
            subtitle: Text('${info.version} (${info.buildNumber}) · dữ liệu danh mục ${meta.version}'),
          ),
          if (!AppConfig.isProduction)
            ListTile(
              leading: const Icon(Icons.dns_outlined),
              title: const Text('Máy chủ (bản phát triển)'),
              subtitle: Text(AppConfig.apiUrl),
            ),
          ListTile(
            leading: const Icon(Icons.refresh),
            title: const Text('Tải lại danh mục từ máy chủ'),
            onTap: () async {
              await ref.read(metaProvider.notifier).refresh();
              if (context.mounted) {
                ScaffoldMessenger.of(context)
                    .showSnackBar(SnackBar(content: Text('Danh mục: ${ref.read(metaProvider).version}')));
              }
            },
          ),
          if (user != null) ...[
            const Divider(),
            ListTile(
              leading: Icon(Icons.delete_forever_outlined, color: context.palette.error),
              title: Text('Xoá tài khoản', style: TextStyle(color: context.palette.error)),
              subtitle: const Text('Ẩn danh hoá dữ liệu cá nhân, giữ lại phiếu đã gửi'),
              onTap: () => context.push(Routes.deleteAccount),
            ),
          ],
        ],
      ),
    );
  }
}
