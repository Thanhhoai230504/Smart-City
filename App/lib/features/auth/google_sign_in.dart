import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/app_exception.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../update/app_update.dart';
import 'auth_controller.dart';

/// Client ID web dùng làm `serverClientId`, hoặc `null` để ẩn nút Google:
/// máy chủ chưa cấu hình, hoặc không phải Android — iOS còn cần client iOS và
/// URL scheme trong Info.plist, bản web đã có luồng redirect của trang web.
///
/// Lấy từ `/api/app/config` thay vì `--dart-define`: một nguồn duy nhất với
/// GOOGLE_CLIENT_ID backend dùng kiểm tra `aud`, nên hai bên không lệch nhau.
final googleSignInClientIdProvider = Provider<String?>((ref) {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return null;
  final id = ref.watch(appUpdateProvider).config?.googleServerClientId;
  return id == null || id.isEmpty ? null : id;
});

/// Phân nhánh theo `code`, không theo chuỗi message của backend.
String googleLoginErrorMessage(AppException e) => switch (e.code) {
      'GOOGLE_TOKEN_INVALID' => 'Google không xác nhận được tài khoản. Vui lòng thử lại.',
      'GOOGLE_EMAIL_NOT_VERIFIED' =>
        'Google chưa xác minh email của tài khoản này. Hãy chọn tài khoản khác hoặc đăng nhập bằng email.',
      'GOOGLE_SIGN_IN_DISABLED' => 'Máy chủ chưa bật đăng nhập Google.',
      _ => switch (e.kind) {
          AppErrorKind.forbidden => 'Tài khoản đã bị vô hiệu hoá. Liên hệ quản trị viên.',
          AppErrorKind.rateLimited => 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ít phút.',
          AppErrorKind.network => 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại.',
          _ => e.message,
        },
    };

/// "hoặc" + nút "Tiếp tục với Google" — dùng chung cho màn đăng nhập và đăng
/// ký (tài khoản Google mới được tạo ngay ở lần đầu, nên hai màn như nhau).
/// Không hiện gì khi [googleSignInClientIdProvider] là `null`.
class GoogleSignInSection extends ConsumerStatefulWidget {
  const GoogleSignInSection({
    super.key,
    required this.returnPath,
    required this.onError,
    this.enabled = true,
    this.onBusyChanged,
  });

  /// Đường dẫn quay về sau khi đăng nhập (lọc lại bằng [safeReturnPath]).
  final String? returnPath;

  /// Thông điệp lỗi để màn cha hiển thị; `null` khi bắt đầu lượt mới.
  final ValueChanged<String?> onError;
  final bool enabled;
  final ValueChanged<bool>? onBusyChanged;

  @override
  ConsumerState<GoogleSignInSection> createState() => _GoogleSignInSectionState();
}

class _GoogleSignInSectionState extends ConsumerState<GoogleSignInSection> {
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    // Lần kiểm tra cấu hình lúc mở app có thể đã hỏng vì mất mạng — thử lại để
    // nút Google hiện được khi người dùng tới màn này.
    if (ref.read(appUpdateProvider).config == null) {
      // Chạy sau khung hình đầu; màn có thể đã đóng ngay trước đó.
      unawaited(Future.microtask(() {
        if (mounted) return ref.read(appUpdateProvider.notifier).check();
      }));
    }
  }

  void _setBusy(bool value) {
    setState(() => _busy = value);
    widget.onBusyChanged?.call(value);
  }

  Future<void> _signIn(String serverClientId) async {
    FocusScope.of(context).unfocus();
    widget.onError(null);
    _setBusy(true);
    try {
      final user = await ref.read(authControllerProvider.notifier).loginWithGoogle(serverClientId);
      if (user != null && mounted) context.go(safeReturnPath(widget.returnPath));
    } on AppException catch (e) {
      if (mounted) widget.onError(googleLoginErrorMessage(e));
    } finally {
      if (mounted) _setBusy(false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final clientId = ref.watch(googleSignInClientIdProvider);
    if (clientId == null) return const SizedBox.shrink();
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Gap.h12,
        Row(
          children: [
            Expanded(child: Divider(color: palette.border)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.md),
              child: Text('hoặc', style: textTheme.bodySmall?.copyWith(color: palette.textSecondary)),
            ),
            Expanded(child: Divider(color: palette.border)),
          ],
        ),
        Gap.h12,
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: widget.enabled && !_busy ? () => _signIn(clientId) : null,
            icon: _busy
                ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const GoogleLogo(),
            label: const Text('Tiếp tục với Google'),
          ),
        ),
      ],
    );
  }
}

/// Logo "G" chính thức theo hướng dẫn thương hiệu nút Sign in with Google.
class GoogleLogo extends StatelessWidget {
  const GoogleLogo({super.key, this.size = 18});

  final double size;

  @override
  Widget build(BuildContext context) =>
      ExcludeSemantics(child: SvgPicture.string(_googleLogoSvg, width: size, height: size));
}

const _googleLogoSvg = '''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>
''';
