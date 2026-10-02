import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/app_exception.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/widgets/async_states.dart';
import '../../data/repositories/auth_repository.dart';
import '../../data/repositories/meta_repository.dart';
import '../auth/auth_controller.dart';
import '../auth/widgets.dart';

/// Sửa tên + `watchedDistricts` (task 6.1). Khu vực lấy từ meta — khi backend
/// đổi sang 94 đơn vị cấp xã (mục 5.1), app không phải phát hành lại.
class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  late final TextEditingController _name;
  late Set<String> _watched;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(currentUserProvider);
    _name = TextEditingController(text: user?.name ?? '');
    _watched = {...?user?.watchedDistricts};
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      showAppSnack(context, 'Tên không được để trống', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final user = await ref
          .read(authRepositoryProvider)
          .updateProfile(name: _name.text, watchedDistricts: _watched.toList());
      ref.read(authControllerProvider.notifier).updateUser(user);
      if (mounted) {
        showAppSnack(context, 'Đã lưu hồ sơ');
        context.pop();
      }
    } on AppException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final areas = ref.watch(metaProvider).watchableAreas;
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Sửa hồ sơ')),
      body: ListView(
        padding: const EdgeInsets.all(Gap.screen),
        children: [
          TextField(
            controller: _name,
            maxLength: 100,
            decoration: const InputDecoration(labelText: 'Họ và tên', prefixIcon: Icon(Icons.person_outline)),
          ),
          Gap.h16,
          Text('Khu vực theo dõi', style: textTheme.titleMedium),
          Gap.h4,
          Text(
            'Nhận thông báo khi có sự cố mới trong các khu vực này.',
            style: textTheme.bodySmall,
          ),
          Gap.h12,
          Wrap(
            spacing: Gap.sm,
            runSpacing: Gap.sm,
            children: [
              for (final a in areas)
                FilterChip(
                  label: Text(a.label),
                  selected: _watched.contains(a.value),
                  onSelected: (on) => setState(() => on ? _watched.add(a.value) : _watched.remove(a.value)),
                ),
            ],
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.screen, Gap.md),
          child: FilledButton(onPressed: _busy ? null : _save, child: const Text('Lưu')),
        ),
      ),
    );
  }
}

/// Đổi mật khẩu — **thu hồi mọi phiên**, rồi đăng nhập lại ngay bằng mật khẩu
/// mới để thiết bị này không bị đá ra ở lần refresh kế tiếp.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  String? _currentError;
  String? _nextError;
  String? _confirmError;
  bool _busy = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _currentError = _current.text.isEmpty ? 'Nhập mật khẩu hiện tại' : null;
      _nextError = validateNewPassword(_next.text);
      _confirmError = _confirm.text != _next.text ? 'Mật khẩu nhập lại không khớp' : null;
    });
    if (_currentError != null || _nextError != null || _confirmError != null) return;
    final user = ref.read(currentUserProvider);
    if (user == null) return;

    setState(() => _busy = true);
    try {
      final fresh = await ref.read(authRepositoryProvider).changePassword(
            email: user.email,
            currentPassword: _current.text,
            newPassword: _next.text,
          );
      ref.read(authControllerProvider.notifier).updateUser(fresh);
      if (mounted) {
        showAppSnack(context, 'Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.');
        context.pop();
      }
    } on AppException catch (e) {
      if (!mounted) return;
      setState(() {
        if (e.code?.startsWith('PASSWORD_') ?? false) {
          _nextError = e.message;
        } else if (e.kind == AppErrorKind.badRequest) {
          _currentError = 'Mật khẩu hiện tại không đúng';
        } else {
          showAppSnack(context, e.message, error: true);
        }
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Đổi mật khẩu')),
      body: ListView(
        padding: const EdgeInsets.all(Gap.screen),
        children: [
          PasswordField(controller: _current, label: 'Mật khẩu hiện tại', errorText: _currentError,
              textInputAction: TextInputAction.next),
          Gap.h16,
          PasswordField(
            controller: _next,
            label: 'Mật khẩu mới',
            errorText: _nextError,
            helperText: 'Ít nhất 8 ký tự.',
            autofillHints: const [AutofillHints.newPassword],
            textInputAction: TextInputAction.next,
          ),
          Gap.h16,
          PasswordField(
            controller: _confirm,
            label: 'Nhập lại mật khẩu mới',
            errorText: _confirmError,
            autofillHints: const [AutofillHints.newPassword],
            onSubmitted: (_) => _submit(),
          ),
          Gap.h16,
          Text(
            'Sau khi đổi, mọi thiết bị khác đang đăng nhập tài khoản này sẽ bị đăng xuất.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.screen, Gap.md),
          child: FilledButton(onPressed: _busy ? null : _submit, child: const Text('Đổi mật khẩu')),
        ),
      ),
    );
  }
}

/// Xoá tài khoản (task 6.4, B8) — **bắt buộc nếu lên store**. Ẩn danh hoá chứ
/// không xoá cứng: phiếu đã gửi vẫn giữ (ẩn danh) để thống kê không lệch.
class DeleteAccountScreen extends ConsumerStatefulWidget {
  const DeleteAccountScreen({super.key});

  @override
  ConsumerState<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends ConsumerState<DeleteAccountScreen> {
  final _password = TextEditingController();
  bool _understood = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _delete() async {
    final user = ref.read(currentUserProvider);
    if (user == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).deleteAccount(password: _password.text);
      await ref.read(authControllerProvider.notifier).signOutLocally(
            notice: 'Tài khoản đã được xoá. Phản ánh bạn từng gửi được giữ lại dưới dạng ẩn danh.',
          );
      if (mounted) context.go(Routes.login);
    } on AppException catch (e) {
      if (!mounted) return;
      setState(() => _error = switch (e.code) {
            'PASSWORD_REQUIRED' => 'Nhập mật khẩu để xác nhận.',
            'INVALID_PASSWORD' => 'Mật khẩu không đúng.',
            'LAST_ADMIN' => 'Không thể xoá quản trị viên cuối cùng của hệ thống.',
            _ => e.message,
          });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final needsPassword = user?.isLocalAccount ?? true;
    final canDelete = _understood && (!needsPassword || _password.text.isNotEmpty);

    return Scaffold(
      appBar: AppBar(title: const Text('Xoá tài khoản')),
      body: ListView(
        padding: const EdgeInsets.all(Gap.screen),
        children: [
          Icon(Icons.warning_amber_rounded, size: 48, color: palette.error),
          Gap.h12,
          Text('Hành động này không thể hoàn tác', style: textTheme.titleLarge),
          Gap.h12,
          Text(
            '• Tên, email và ảnh đại diện của bạn sẽ bị xoá.\n'
            '• Số điện thoại bạn nhập trên các phiếu sẽ bị xoá.\n'
            '• Các phiếu bạn đã gửi được giữ lại dưới dạng ẩn danh để đơn vị tiếp tục xử lý '
            'và thống kê không bị sai lệch.\n'
            '• Bạn bị đăng xuất khỏi mọi thiết bị.',
            style: textTheme.bodyMedium,
          ),
          Gap.h16,
          if (needsPassword)
            PasswordField(
              controller: _password,
              label: 'Mật khẩu xác nhận',
              errorText: _error,
              onChanged: (_) => setState(() {}),
            )
          else if (_error != null)
            Text(_error!, style: textTheme.bodySmall?.copyWith(color: palette.error)),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: _understood,
            onChanged: (v) => setState(() => _understood = v ?? false),
            title: const Text('Tôi hiểu và muốn xoá tài khoản'),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.screen, Gap.md),
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: palette.error, foregroundColor: palette.onError),
            onPressed: canDelete && !_busy ? _delete : null,
            child: const Text('Xoá vĩnh viễn tài khoản'),
          ),
        ),
      ),
    );
  }
}
