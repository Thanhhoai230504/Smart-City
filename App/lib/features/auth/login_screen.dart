import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/app_exception.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import 'auth_controller.dart';
import 'google_sign_in.dart';
import 'widgets.dart';

/// Thông điệp hiển thị cho lỗi đăng nhập. Phân nhánh theo `code`/status,
/// **không so chuỗi** message của backend (nhiều message còn là tiếng Anh).
String loginErrorMessage(AppException e) {
  if (e.code == 'ACCOUNT_LOCKED') return e.message; // có số phút còn khoá
  return switch (e.kind) {
    AppErrorKind.unauthorized => 'Email hoặc mật khẩu không đúng.',
    AppErrorKind.forbidden => 'Tài khoản đã bị vô hiệu hoá. Liên hệ quản trị viên.',
    AppErrorKind.rateLimited => 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ít phút.',
    AppErrorKind.network => 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại.',
    _ => e.message,
  };
}

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.from});

  /// Đường dẫn quay về sau khi đăng nhập (đã lọc bằng [safeReturnPath]).
  final String? from;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _googleBusy = false;
  String? _emailError;
  String? _passwordError;
  String? _formError;
  bool _locked = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _emailError = validateEmail(_email.text);
      _passwordError = _password.text.isEmpty ? 'Vui lòng nhập mật khẩu' : null;
      _formError = null;
      _locked = false;
    });
    if (_emailError != null || _passwordError != null) return;

    setState(() => _busy = true);
    try {
      await ref.read(authControllerProvider.notifier).login(_email.text, _password.text);
      if (mounted) context.go(safeReturnPath(widget.from));
    } on AppException catch (e) {
      if (!mounted) return;
      if (e.code == 'EMAIL_NOT_VERIFIED') {
        unawaited(context.push(Uri(
          path: Routes.verifyPending,
          queryParameters: {'email': _email.text.trim()},
        ).toString()));
        return;
      }
      setState(() {
        _emailError = e.errorFor('email');
        _passwordError = e.errorFor('password');
        _locked = e.code == 'ACCOUNT_LOCKED';
        _formError = _emailError == null && _passwordError == null ? loginErrorMessage(e) : null;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final notice = auth is AuthGuest ? auth.notice : null;
    final palette = context.palette;

    return AuthScaffold(
      title: 'Đăng nhập',
      subtitle: 'Báo cáo sự cố và theo dõi tiến độ xử lý ngay trên điện thoại.',
      showBack: context.canPop(),
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _busy || _googleBusy ? null : _submit,
              child: _busy
                  ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Đăng nhập'),
            ),
          ),
          GoogleSignInSection(
            returnPath: widget.from,
            enabled: !_busy,
            onBusyChanged: (busy) => setState(() => _googleBusy = busy),
            onError: (message) => setState(() {
              _formError = message;
              _locked = false;
              _emailError = null;
              _passwordError = null;
            }),
          ),
          Gap.h8,
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Flexible(child: Text('Chưa có tài khoản?')),
              TextButton(
                onPressed: _busy || _googleBusy ? null : () => context.push(Routes.register),
                child: const Text('Đăng ký'),
              ),
            ],
          ),
          if (!context.canPop())
            TextButton(
              onPressed: () => context.go(Routes.home),
              child: const Text('Xem sự cố công khai, không cần đăng nhập'),
            ),
        ],
      ),
      children: [
        if (notice != null && _formError == null)
          FormNotice(message: notice, colors: palette.offline, icon: Icons.lock_clock_outlined),
        if (_formError != null)
          FormNotice(
            message: _formError!,
            colors: palette.danger,
            icon: _locked ? Icons.lock_clock_outlined : Icons.error_outline,
          ),
        AutofillGroup(
          child: Column(
            children: [
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email, AutofillHints.username],
                textInputAction: TextInputAction.next,
                autocorrect: false,
                decoration: InputDecoration(
                  labelText: 'Email',
                  prefixIcon: const Icon(Icons.mail_outline),
                  errorText: _emailError,
                ),
              ),
              Gap.h16,
              PasswordField(
                controller: _password,
                label: 'Mật khẩu',
                errorText: _passwordError,
                onSubmitted: (_) => _submit(),
              ),
            ],
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: _busy
                ? null
                : () => context.push(Uri(
                      path: Routes.forgotPassword,
                      queryParameters: {if (_email.text.trim().isNotEmpty) 'email': _email.text.trim()},
                    ).toString()),
            child: const Text('Quên mật khẩu?'),
          ),
        ),
      ],
    );
  }
}

