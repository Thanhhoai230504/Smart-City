import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/app_config.dart';
import '../../core/platform/app_info.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/widgets/surfaces.dart';
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
    final palette = context.palette;
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    Widget bubble(IconData icon, {bool danger = false}) => IconBubble(
          icon: icon,
          ink: danger ? palette.error : scheme.onPrimaryContainer,
          container: danger ? palette.danger.container : scheme.primaryContainer,
          size: 40,
        );

    Widget group(List<Widget> children) => AppCard(
          padding: const EdgeInsets.symmetric(vertical: Gap.xs),
          child: Column(
            children: [
              for (var i = 0; i < children.length; i++) ...[
                if (i > 0) const Divider(indent: 68),
                children[i],
              ],
            ],
          ),
        );

    return Scaffold(
      appBar: AppBar(title: const Text('Cài đặt')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.xs, Gap.screen, Gap.xxxl),
        children: [
          const SectionHeader('Giao diện', padding: EdgeInsets.only(bottom: Gap.sm)),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SegmentedButton<ThemeMode>(
                  segments: const [
                    ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode_outlined), label: Text('Sáng')),
                    ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode_outlined), label: Text('Tối')),
                    ButtonSegment(
                        value: ThemeMode.system, icon: Icon(Icons.brightness_auto_outlined), label: Text('Hệ thống')),
                  ],
                  selected: {mode},
                  onSelectionChanged: (s) => ref.read(themeModeProvider.notifier).set(s.first),
                ),
                Gap.h12,
                Text(
                  'Đi hiện trường dưới nắng? Chọn "Sáng" để chữ rõ nhất. Cỡ chữ theo cài đặt của điện thoại.',
                  style: textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SectionHeader('Thông báo'),
          group([
            ListTile(
              leading: bubble(Icons.notifications_outlined),
              title: const Text('Thông báo đẩy'),
              subtitle: const Text(
                'Hiện nhận thông báo khi app đang mở. Thông báo đẩy khi tắt app sẽ có sau khi máy chủ bật Firebase.',
              ),
              isThreeLine: true,
            ),
          ]),
          const SectionHeader('Ứng dụng'),
          group([
            ListTile(
              leading: bubble(Icons.info_outline),
              title: const Text('Phiên bản ứng dụng'),
              subtitle: Text('${info.version} (${info.buildNumber}) · dữ liệu danh mục ${meta.version}'),
            ),
            if (!AppConfig.isProduction)
              ListTile(
                leading: bubble(Icons.dns_outlined),
                title: const Text('Máy chủ (bản phát triển)'),
                subtitle: Text(AppConfig.apiUrl),
              ),
            ListTile(
              leading: bubble(Icons.refresh),
              title: const Text('Tải lại danh mục từ máy chủ'),
              trailing: Icon(Icons.chevron_right, color: palette.textSecondary),
              onTap: () async {
                await ref.read(metaProvider.notifier).refresh();
                if (context.mounted) {
                  ScaffoldMessenger.of(context)
                      .showSnackBar(SnackBar(content: Text('Danh mục: ${ref.read(metaProvider).version}')));
                }
              },
            ),
            ListTile(
              leading: bubble(Icons.description_outlined),
              title: const Text('Giấy phép mã nguồn mở'),
              subtitle: const Text('Thư viện và phông chữ Be Vietnam Pro (SIL OFL)'),
              trailing: Icon(Icons.chevron_right, color: palette.textSecondary),
              onTap: () => showLicensePage(
                context: context,
                applicationName: 'Smart City Đà Nẵng',
                applicationVersion: info.version,
              ),
            ),
          ]),
          if (user != null) ...[
            const SectionHeader('Tài khoản'),
            group([
              ListTile(
                leading: bubble(Icons.delete_forever_outlined, danger: true),
                title: Text('Xoá tài khoản', style: TextStyle(color: palette.error)),
                subtitle: const Text('Ẩn danh hoá dữ liệu cá nhân, giữ lại phiếu đã gửi'),
                trailing: Icon(Icons.chevron_right, color: palette.textSecondary),
                onTap: () => context.push(Routes.deleteAccount),
              ),
            ]),
          ],
        ],
      ),
    );
  }
}
