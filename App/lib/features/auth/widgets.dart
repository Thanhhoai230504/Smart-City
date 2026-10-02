import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';

/// Ô mật khẩu có nút hiện/ẩn. Nhãn của nút **đổi theo trạng thái** để trình
/// đọc màn hình đọc đúng hành động (G26 của web).
class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    required this.controller,
    required this.label,
    this.errorText,
    this.helperText,
    this.textInputAction = TextInputAction.done,
    this.onSubmitted,
    this.autofillHints = const [AutofillHints.password],
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String? errorText;
  final String? helperText;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onChanged;
  final Iterable<String> autofillHints;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) => TextField(
        controller: widget.controller,
        obscureText: _obscure,
        enableSuggestions: false,
        autocorrect: false,
        autofillHints: widget.autofillHints,
        textInputAction: widget.textInputAction,
        onSubmitted: widget.onSubmitted,
        onChanged: widget.onChanged,
        decoration: InputDecoration(
          labelText: widget.label,
          errorText: widget.errorText,
          helperText: widget.helperText,
          prefixIcon: const Icon(Icons.lock_outline),
          suffixIcon: IconButton(
            tooltip: _obscure ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
            icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
            onPressed: () => setState(() => _obscure = !_obscure),
          ),
        ),
      );
}

/// Khung màn xác thực: logo + tiêu đề trên, nội dung cuộn, nút chính neo đáy.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.title,
    required this.subtitle,
    required this.children,
    required this.bottom,
    this.showBack = true,
  });

  final String title;
  final String subtitle;
  final List<Widget> children;
  final Widget bottom;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: showBack ? AppBar(shape: const Border()) : null,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(Gap.xxl, Gap.lg, Gap.xxl, Gap.lg),
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: palette.primary,
                          borderRadius: BorderRadius.circular(Radii.button),
                        ),
                        child: Icon(Icons.location_city, color: palette.onPrimary),
                      ),
                      Gap.w12,
                      Flexible(child: Text('Smart City Đà Nẵng', style: textTheme.titleMedium)),
                    ],
                  ),
                  Gap.h24,
                  Text(title, style: textTheme.headlineMedium),
                  Gap.h8,
                  Text(subtitle, style: textTheme.bodyMedium?.copyWith(color: palette.textSecondary)),
                  Gap.h24,
                  ...children,
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(Gap.xxl, 0, Gap.xxl, Gap.lg),
              child: bottom,
            ),
          ],
        ),
      ),
    );
  }
}

/// Hộp thông báo trong form (lỗi chung, tài khoản bị khoá…).
class FormNotice extends StatelessWidget {
  const FormNotice({super.key, required this.message, required this.colors, this.icon = Icons.info_outline});

  final String message;
  final ChipColors colors;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Semantics(
        liveRegion: true,
        child: Container(
          margin: const EdgeInsets.only(bottom: Gap.lg),
          padding: const EdgeInsets.all(Gap.md),
          decoration: BoxDecoration(
            color: colors.container,
            borderRadius: BorderRadius.circular(Radii.card),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 20, color: colors.text),
              Gap.w12,
              Expanded(
                child: Text(
                  message,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.text),
                ),
              ),
            ],
          ),
        ),
      );
}

final _emailPattern = RegExp(r'^[\w.+-]+@[\w-]+(\.[\w-]+)+$');

String? validateEmail(String value) {
  if (value.trim().isEmpty) return 'Vui lòng nhập email';
  if (!_emailPattern.hasMatch(value.trim())) return 'Email không hợp lệ';
  return null;
}

/// Khớp `passwordPolicy.js` (H1, theo NIST SP 800-63B): **≥ 8 ký tự**, không ép
/// hoa/ký tự đặc biệt. Danh sách mật khẩu phổ biến chỉ server kiểm.
String? validateNewPassword(String value) {
  if (value.isEmpty) return 'Vui lòng nhập mật khẩu';
  if (value.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự';
  if (value.length > 128) return 'Mật khẩu quá dài';
  if (RegExp(r'^(.)\1+$').hasMatch(value)) return 'Mật khẩu không được chỉ lặp một ký tự';
  return null;
}
