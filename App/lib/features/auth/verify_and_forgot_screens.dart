import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/app_exception.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../data/repositories/auth_repository.dart';
import 'widgets.dart';

/// Luồng `EMAIL_NOT_VERIFIED` (task 1.2) + sau khi đăng ký.
///
/// Link xác thực mở trên **web** (`CLIENT_URL/verify-email`) — phương án (a)
/// của kế hoạch mục 1.4: đơn giản nhất và vẫn đúng chức năng. iOS Universal
/// Links cần AASA trên domain production thật, chưa có.
class VerifyPendingScreen extends ConsumerStatefulWidget {
  const VerifyPendingScreen({super.key, required this.email, this.sendFailed = false});

  final String email;
  final bool sendFailed;

  @override
  ConsumerState<VerifyPendingScreen> createState() => _VerifyPendingScreenState();
}

class _VerifyPendingScreenState extends ConsumerState<VerifyPendingScreen> {
  /// Cùng cooldown 60s với web (`VerifyEmail/index.tsx`) và backend.
  static const cooldown = 60;
  int _remaining = 0;
  Timer? _timer;
  bool _busy = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    if (!widget.sendFailed) _startCooldown();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startCooldown() {
    _timer?.cancel();
    setState(() => _remaining = cooldown);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _remaining--);
      if (_remaining <= 0) t.cancel();
    });
  }

  Future<void> _resend() async {
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await ref.read(authRepositoryProvider).resendVerification(widget.email);
      if (!mounted) return;
      _startCooldown();
      setState(() => _message = 'Nếu email chưa được xác thực, một liên kết mới đã được gửi.');
    } on AppException catch (e) {
      if (mounted) setState(() => _message = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    return AuthScaffold(
      title: 'Xác thực email',
      subtitle: 'Tài khoản cần xác thực email trước khi đăng nhập.',
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => context.go(Routes.login),
              child: const Text('Tôi đã xác thực — đăng nhập'),
            ),
          ),
          Gap.h8,
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: _busy || _remaining > 0 ? null : _resend,
              child: Text(_remaining > 0 ? 'Gửi lại email sau $_remaining giây' : 'Gửi lại email xác thực'),
            ),
          ),
        ],
      ),
      children: [
        Icon(Icons.mark_email_unread_outlined, size: 56, color: palette.primary),
        Gap.h16,
        Text.rich(
          TextSpan(children: [
            const TextSpan(text: 'Chúng tôi đã gửi liên kết xác thực tới '),
            TextSpan(text: widget.email, style: const TextStyle(fontWeight: FontWeight.w700)),
            const TextSpan(text: '. Liên kết có hiệu lực trong 24 giờ.'),
          ]),
          style: textTheme.bodyLarge,
        ),
        Gap.h12,
        Text(
          'Mở email, bấm vào liên kết (trang xác thực mở trên trình duyệt), rồi quay lại app để đăng nhập. '
          'Không thấy email? Kiểm tra thư mục Spam.',
          style: textTheme.bodyMedium?.copyWith(color: palette.textSecondary),
        ),
        if (widget.sendFailed) ...[
          Gap.h16,
          FormNotice(
            message: 'Hệ thống chưa gửi được email. Hãy bấm "Gửi lại email xác thực".',
            colors: palette.offline,
          ),
        ],
        if (_message != null) ...[
          Gap.h16,
          FormNotice(message: _message!, colors: palette.success, icon: Icons.check_circle_outline),
        ],
      ],
    );
  }
}

/// Quên mật khẩu (task 1.5, backend G-B7). Link sống 30 phút, mở trên web;
/// đặt lại xong **mọi phiên bị thu hồi** nên phải đăng nhập lại trên app.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key, this.initialEmail});

  final String? initialEmail;

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  late final _email = TextEditingController(text: widget.initialEmail ?? '');
  bool _busy = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final invalid = validateEmail(_email.text);
    setState(() => _error = invalid);
    if (invalid != null) return;
    setState(() => _busy = true);
    try {
      await ref.read(authRepositoryProvider).forgotPassword(_email.text);
      if (mounted) setState(() => _sent = true);
    } on AppException catch (e) {
      if (mounted) {
        setState(() => _error = e.kind == AppErrorKind.rateLimited
            ? 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.'
            : e.message);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return AuthScaffold(
      title: 'Quên mật khẩu',
      subtitle: 'Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.',
      bottom: SizedBox(
        width: double.infinity,
        child: _sent
            ? FilledButton(onPressed: () => context.go(Routes.login), child: const Text('Về đăng nhập'))
            : FilledButton(
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Gửi liên kết'),
              ),
      ),
      children: [
        if (_sent)
          FormNotice(
            colors: palette.success,
            icon: Icons.check_circle_outline,
            // Câu chữ mơ hồ có chủ đích — giống hệt backend, không tiết lộ email
            // có tồn tại hay không.
            message: 'Nếu email tồn tại trong hệ thống, một liên kết đặt lại mật khẩu đã được gửi. '
                'Liên kết hết hạn sau 30 phút và mở trên trình duyệt. Đặt lại xong, hãy đăng nhập lại '
                'trên mọi thiết bị.',
          )
        else
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            onSubmitted: (_) => _submit(),
            decoration: InputDecoration(
              labelText: 'Email',
              prefixIcon: const Icon(Icons.mail_outline),
              errorText: _error,
            ),
          ),
      ],
    );
  }
}
