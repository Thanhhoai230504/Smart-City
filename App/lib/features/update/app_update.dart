import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/network/app_exception.dart';
import '../../core/platform/app_info.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../data/models/report_support.dart';
import '../../data/repositories/support_repositories.dart';

/// So sánh `1.2.10` với `1.2.9` theo từng số — so chuỗi sẽ sai ("10" < "9").
int compareVersions(String a, String b) {
  List<int> parts(String v) => v
      .split('+')
      .first
      .split('.')
      .map((p) => int.tryParse(p.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0)
      .toList();
  final x = parts(a);
  final y = parts(b);
  for (var i = 0; i < 3; i++) {
    final d = (i < x.length ? x[i] : 0) - (i < y.length ? y[i] : 0);
    if (d != 0) return d.sign;
  }
  return 0;
}

class UpdateState {
  const UpdateState({this.force = false, this.available = false, this.config});

  /// Bản cài thấp hơn `minSupportedVersion` → chặn app, mở store.
  final bool force;
  final bool available;
  final RemoteAppConfig? config;

  String? get storeUrl => defaultTargetPlatform == TargetPlatform.iOS
      ? config?.iosStoreUrl
      : config?.androidStoreUrl;
}

UpdateState decideUpdate(String current, RemoteAppConfig config) => UpdateState(
      force: compareVersions(current, config.minSupportedVersion) < 0,
      available: compareVersions(current, config.latestVersion) < 0,
      config: config,
    );

/// Task 0.8 — app cũ nằm trên máy người dùng **vĩnh viễn** nếu họ không cập
/// nhật; web không có vấn đề này. Server quyết định bản nào còn được hỗ trợ.
///
/// Lỗi mạng / server chưa có route → **không chặn** (fail-open): máy chủ hỏng
/// không được biến thành "không ai mở được app".
class AppUpdateController extends Notifier<UpdateState> {
  @override
  UpdateState build() {
    unawaited(Future.microtask(check));
    return const UpdateState();
  }

  Future<void> check() async {
    try {
      final config = await ref.read(publicRepositoryProvider).appConfig();
      state = decideUpdate(ref.read(appInfoProvider).version, config);
    } on AppException {
      // Giữ nguyên — không chặn khi không kiểm tra được.
    }
  }
}

final appUpdateProvider = NotifierProvider<AppUpdateController, UpdateState>(AppUpdateController.new);

class ForceUpdateScreen extends ConsumerWidget {
  const ForceUpdateScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final update = ref.watch(appUpdateProvider);
    final info = ref.watch(appInfoProvider);
    final textTheme = Theme.of(context).textTheme;
    final url = update.storeUrl;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Gap.xxl),
          child: Column(
            children: [
              const Spacer(),
              Icon(Icons.system_update, size: 64, color: context.palette.primary),
              Gap.h24,
              Text('Cần cập nhật ứng dụng', style: textTheme.headlineSmall, textAlign: TextAlign.center),
              Gap.h12,
              Text(
                'Phiên bản ${info.version} không còn được hỗ trợ. Vui lòng cập nhật lên '
                '${update.config?.latestVersion ?? 'bản mới nhất'} để tiếp tục báo cáo sự cố.',
                style: textTheme.bodyLarge,
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: url == null ? null : () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
                  icon: const Icon(Icons.open_in_new),
                  label: const Text('Mở cửa hàng ứng dụng'),
                ),
              ),
              Gap.h8,
              TextButton(
                onPressed: () => ref.read(appUpdateProvider.notifier).check(),
                child: const Text('Kiểm tra lại'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
