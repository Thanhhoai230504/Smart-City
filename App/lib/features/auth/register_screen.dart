import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/app_exception.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../data/repositories/auth_repository.dart';
import 'google_sign_in.dart';
import 'widgets.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  bool _googleBusy = false;
  final Map<String, String?> _errors = {};
  String? _formError;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  bool _validate() {
    _errors
      ..clear()
      ..['name'] = _name.text.trim().isEmpty ? 'Vui lòng nhập họ tên' : null
      ..['email'] = validateEmail(_email.text)
      ..['password'] = validateNewPassword(_password.text)
      ..['confirm'] = _confirm.text != _password.text ? 'Mật khẩu nhập lại không khớp' : null;
    return _errors.values.every((e) => e == null);
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() => _formError = null);
    if (!_validate()) {
      setState(() {});
      return;
    }
    setState(() => _busy = true);
    try {
      final result = await ref
          .read(authRepositoryProvider)
          .register(_name.text, _email.text, _password.text);
      if (!mounted) return;
      context.pushReplacement(Uri(
        path: Routes.verifyPending,
        queryParameters: {
          'email': result.email,
          if (!result.verificationEmailSent) 'sendFailed': '1',
        },
      ).toString());
    } on AppException catch (e) {
      if (!mounted) return;
      setState(() {
        // Mã PASSWORD_TOO_* (H1) gắn vào ô mật khẩu, không so chuỗi message.
        if (e.code?.startsWith('PASSWORD_') ?? false) {
          _errors['password'] = e.message;
        } else if (e.fieldErrors.isNotEmpty) {
          for (final f in e.fieldErrors) {
            _errors[f.field] = f.message;
          }
        } else if (e.kind == AppErrorKind.badRequest) {
          // "Email already registered." — lỗi duy nhất còn lại của route này.
          _errors['email'] = 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.';
        } else {
          _formError = e.kind == AppErrorKind.rateLimited
              ? 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.'
              : e.message;
        }
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return AuthScaffold(
      title: 'Tạo tài khoản',
      subtitle: 'Một tài khoản dùng chung cho app và website Smart City Đà Nẵng.',
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _busy || _googleBusy ? null : _submit,
              child: _busy
                  ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Đăng ký'),
            ),
          ),
          // Tài khoản Google chưa có sẽ được tạo ngay — không cần mật khẩu hay
          // bước xác thực email.
          GoogleSignInSection(
            returnPath: null,
            enabled: !_busy,
            onBusyChanged: (busy) => setState(() => _googleBusy = busy),
            onError: (message) => setState(() => _formError = message),
          ),
        ],
      ),
      children: [
        if (_formError != null) FormNotice(message: _formError!, colors: palette.danger),
        AutofillGroup(
          child: Column(
            children: [
              TextField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.name],
                maxLength: 100,
                decoration: InputDecoration(
                  labelText: 'Họ và tên',
                  prefixIcon: const Icon(Icons.person_outline),
                  errorText: _errors['name'],
                  counterText: '',
                ),
              ),
              Gap.h16,
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                textInputAction: TextInputAction.next,
                autocorrect: false,
                decoration: InputDecoration(
                  labelText: 'Email',
                  prefixIcon: const Icon(Icons.mail_outline),
                  errorText: _errors['email'],
                ),
              ),
              Gap.h16,
              PasswordField(
                controller: _password,
                label: 'Mật khẩu',
                autofillHints: const [AutofillHints.newPassword],
                textInputAction: TextInputAction.next,
                errorText: _errors['password'],
                helperText: 'Ít nhất 8 ký tự. Một cụm từ dài dễ nhớ an toàn hơn ký tự đặc biệt.',
              ),
              Gap.h16,
              PasswordField(
                controller: _confirm,
                label: 'Nhập lại mật khẩu',
                autofillHints: const [AutofillHints.newPassword],
                errorText: _errors['confirm'],
                onSubmitted: (_) => _submit(),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
