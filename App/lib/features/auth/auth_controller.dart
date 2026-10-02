import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/network/app_exception.dart';
import '../../data/models/user.dart';
import '../../data/repositories/auth_repository.dart';

sealed class AuthState {
  const AuthState();
}

/// Đang đọc phiên đã lưu — router giữ ở màn splash.
class AuthUnknown extends AuthState {
  const AuthUnknown();
}

class AuthGuest extends AuthState {
  const AuthGuest({this.notice});

  /// Lý do bị đưa về trạng thái khách ("Phiên đăng nhập đã hết hạn…").
  final String? notice;
}

class AuthSignedIn extends AuthState {
  const AuthSignedIn(this.user);

  final AppUser user;
}

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    final sub = ref.watch(sessionExpiryBusProvider).stream.listen((_) => _onSessionExpired());
    ref.onDispose(sub.cancel);
    unawaited(Future.microtask(_restore));
    return const AuthUnknown();
  }

  AuthRepository get _repo => ref.read(authRepositoryProvider);

  /// Mở app (task 1.6): kill app → mở lại → tự refresh, không bắt đăng nhập lại.
  ///
  /// Có hồ sơ cache thì vào app ngay (kể cả khi offline — người dân soạn phiếu
  /// offline là kịch bản chính của 3.6), rồi làm mới phiên ở nền.
  Future<void> _restore() async {
    if (!await _repo.hasStoredSession()) {
      state = const AuthGuest();
      return;
    }
    final cached = await _repo.cachedUser();
    if (cached != null) state = AuthSignedIn(cached);

    try {
      await _repo.refreshSession();
      final user = await _repo.fetchProfile();
      state = AuthSignedIn(user);
    } on AppException catch (e) {
      if (e.kind == AppErrorKind.unauthorized || e.kind == AppErrorKind.forbidden) {
        await _repo.clearLocal();
        state = const AuthGuest(notice: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      } else if (cached == null) {
        // Có token nhưng chưa từng lưu hồ sơ và đang offline: chưa đủ dữ liệu
        // để vào app. Giữ token để lần mở sau thử lại.
        state = const AuthGuest();
      }
    }
  }

  Future<void> _onSessionExpired() async {
    if (state is! AuthSignedIn) return;
    await _repo.clearLocal();
    state = const AuthGuest(notice: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  Future<AppUser> login(String email, String password) async {
    final user = await _repo.login(email, password);
    state = AuthSignedIn(user);
    return user;
  }

  Future<void> logout() async {
    await _repo.logout();
    state = const AuthGuest();
  }

  /// Sau khi xoá tài khoản ở server — chỉ dọn phía máy.
  Future<void> signOutLocally({String? notice}) async {
    await _repo.clearLocal();
    state = AuthGuest(notice: notice);
  }

  void updateUser(AppUser user) {
    if (state is AuthSignedIn) state = AuthSignedIn(user);
  }

  Future<void> reloadProfile() async {
    try {
      updateUser(await _repo.fetchProfile());
    } on AppException {
      // Giữ hồ sơ đang có.
    }
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);

final currentUserProvider = Provider<AppUser?>((ref) {
  final auth = ref.watch(authControllerProvider);
  return auth is AuthSignedIn ? auth.user : null;
});

final isStaffProvider = Provider<bool>(
  (ref) => ref.watch(currentUserProvider)?.role == UserRole.staff,
);
