import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/network/app_exception.dart';
import '../../core/network/interceptors.dart';
import '../../core/network/token_store.dart';
import '../../core/platform/app_info.dart';
import '../../core/utils/json.dart';
import '../models/user.dart';

class RegisterResult {
  const RegisterResult({required this.email, required this.verificationEmailSent});

  final String email;
  final bool verificationEmailSent;
}

/// Hợp đồng xác thực sau B1 (Phụ lục E.3).
class AuthRepository {
  AuthRepository(this._dio, this._tokens, this._info, this._coordinator);

  final Dio _dio;
  final RefreshCoordinator _coordinator;
  final TokenStore _tokens;
  final AppInfo _info;

  Future<T> _call<T>(Future<T> Function() body) async {
    try {
      return await body();
    } catch (e) {
      throw AppException.from(e);
    }
  }

  /// **Bắt buộc gửi `deviceType` + `deviceName`** — quên là backend coi như
  /// web, đặt refresh token vào cookie, và app không có cách nào biết tại sao
  /// không nhận được token.
  Future<AppUser> login(String email, String password) => _call(() async {
        final res = await _dio.post<Object?>('/auth/login', data: {
          'email': email.trim(),
          'password': password,
          'deviceType': _info.deviceType,
          'deviceName': _info.deviceName,
        });
        final data = dataOf(res.data);
        final access = asString(data['accessToken']);
        final refresh = asString(data['refreshToken']);
        if (access == null || refresh == null) {
          throw const AppException(
            kind: AppErrorKind.unknown,
            message: 'Máy chủ không trả phiên đăng nhập cho thiết bị di động.',
          );
        }
        _tokens.accessToken = access;
        await _tokens.saveRefreshToken(refresh);
        // Login trả `departmentId` dạng chuỗi; lấy profile đầy đủ ngay sau đó
        // nếu được, nhưng không bắt buộc (mạng có thể vừa rớt).
        var user = AppUser.fromJson(data['user']);
        try {
          user = await fetchProfile();
        } on AppException {
          await _tokens.saveCachedUser(user.encode());
        }
        return user;
      });

  Future<RegisterResult> register(String name, String email, String password) =>
      _call(() async {
        final res = await _dio.post<Object?>('/auth/register', data: {
          'name': name.trim(),
          'email': email.trim(),
          'password': password,
        });
        final user = asMap(dataOf(res.data)['user']);
        return RegisterResult(
          email: asStringOr(user['email'], email.trim()),
          verificationEmailSent: asBool(user['verificationEmailSent'], true),
        );
      });

  /// Phản hồi giống nhau dù email có tồn tại hay không (chống dò tài khoản).
  Future<void> resendVerification(String email) => _call(() async {
        await _dio.post<Object?>('/auth/resend-verification', data: {'email': email.trim()});
      });

  /// Link đặt lại sống 30 phút và mở trên web (`CLIENT_URL/reset-password`).
  Future<void> forgotPassword(String email) => _call(() async {
        await _dio.post<Object?>('/auth/forgot-password', data: {'email': email.trim()});
      });

  Future<AppUser> fetchProfile() => _call(() async {
        final res = await _dio.get<Object?>('/auth/profile');
        final user = AppUser.fromJson(dataOf(res.data)['user']);
        await _tokens.saveCachedUser(user.encode());
        return user;
      });

  Future<AppUser> updateProfile({String? name, List<String>? watchedDistricts}) =>
      _call(() async {
        final res = await _dio.patch<Object?>('/auth/profile', data: {
          if (name != null) 'name': name.trim(),
          'watchedDistricts': ?watchedDistricts,
        });
        final user = AppUser.fromJson(dataOf(res.data)['user']);
        await _tokens.saveCachedUser(user.encode());
        return user;
      });

  /// Đổi mật khẩu **thu hồi mọi phiên** — kể cả phiên của chính thiết bị này.
  /// Nên đăng nhập lại ngay bằng mật khẩu mới để người dùng không bị đá ra ở
  /// lần refresh kế tiếp.
  Future<AppUser> changePassword({
    required String email,
    required String currentPassword,
    required String newPassword,
  }) =>
      _call(() async {
        await _dio.patch<Object?>('/auth/change-password', data: {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
        });
        return login(email, newPassword);
      });

  /// L13: route logout cần access token còn hạn. Access token hết hạn thì
  /// `RefreshInterceptor` tự refresh rồi gửi lại, nên logout vẫn thu hồi được
  /// phiên ở server. Dù server trả gì, phía máy vẫn xoá sạch token.
  Future<void> logout() async {
    try {
      final refresh = await _tokens.readRefreshToken();
      if (refresh != null) {
        await _dio.post<Object?>(
          '/auth/logout',
          data: {'refreshToken': refresh},
          options: Options(receiveTimeout: const Duration(seconds: 10)),
        );
      }
    } catch (_) {
      // Mất mạng lúc đăng xuất: phiên ở server tự hết hạn sau 7 ngày.
    } finally {
      await _tokens.clear();
    }
  }

  /// B8 — ẩn danh hoá. Tài khoản local phải nhập mật khẩu xác nhận
  /// (`PASSWORD_REQUIRED` / `INVALID_PASSWORD`).
  Future<void> deleteAccount({String? password}) => _call(() async {
        await _dio.delete<Object?>(
          '/auth/account',
          data: {if (password != null && password.isNotEmpty) 'password': password},
        );
        await _tokens.clear();
      });

  Future<bool> hasStoredSession() async =>
      (await _tokens.readRefreshToken())?.isNotEmpty ?? false;

  Future<AppUser?> cachedUser() async => AppUser.decode(await _tokens.readCachedUser());

  /// Gọi khi mở app: lấy access token mới bằng refresh token đã lưu.
  ///
  /// Đi qua CÙNG [RefreshCoordinator] với interceptor: lúc mở app, màn hình có
  /// thể đã bắn request cần đăng nhập (chưa có access token → 401 → refresh).
  /// Hai lần refresh song song thì lần sau cầm token đã bị rotate và bị 401.
  /// Ném [AppException] `unauthorized` nếu server từ chối (phiên bị thu hồi).
  Future<void> refreshSession() => _call(() => _coordinator.refresh());

  Future<void> clearLocal() => _tokens.clear();
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  return AuthRepository(
    client.dio,
    ref.watch(tokenStoreProvider),
    ref.watch(appInfoProvider),
    client.refreshCoordinator,
  );
});
