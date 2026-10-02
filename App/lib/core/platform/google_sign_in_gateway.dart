import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../config/app_config.dart';
import '../network/app_exception.dart';

/// Lấy ID token Google trên máy (B4). Tách khỏi plugin để test thay bằng bản giả
/// — plugin cần Google Play Services, test không có.
abstract class GoogleSignInGateway {
  /// `null` nghĩa là người dùng tự đóng bảng chọn tài khoản — không phải lỗi.
  /// Lỗi khác ném [AppException] với thông điệp hiển thị được.
  Future<String?> obtainIdToken({required String serverClientId});

  /// Xoá lựa chọn tài khoản trên máy để lần sau hiện lại bảng chọn.
  Future<void> signOut();
}

/// Credential Manager báo "[16] Account reauth failed" dưới dạng *huỷ* khi
/// Google từ chối ứng dụng (SHA-1/package chưa đăng ký, sai serverClientId) —
/// coi là huỷ thật thì người dùng chọn tài khoản xong thấy không có gì xảy ra.
bool isUserCancellation(GoogleSignInException e) =>
    e.code == GoogleSignInExceptionCode.canceled &&
    !(e.description ?? '').toLowerCase().contains('reauth');

/// Câu báo lỗi cho từng kết quả của Credential Manager. Bản không phải
/// production kèm mô tả kỹ thuật — cần nó để nhận ra lỗi cấu hình như
/// "[28444] Developer console is not set up correctly" (SHA-1 chưa đăng ký).
AppException googleSignInFailure(GoogleSignInException e, {bool? withDetail}) {
  final detail = e.description ?? '';
  final showDetail = withDetail ?? !AppConfig.isProduction;
  final misconfigured = e.code == GoogleSignInExceptionCode.clientConfigurationError ||
      e.code == GoogleSignInExceptionCode.providerConfigurationError ||
      detail.contains('28444') ||
      detail.contains('Developer console') ||
      (e.code == GoogleSignInExceptionCode.canceled && !isUserCancellation(e));
  final message = switch (e.code) {
    _ when misconfigured =>
      'Google chưa chấp nhận ứng dụng này. Kiểm tra OAuth client Android (package + SHA-1) trong Google Cloud.',
    _ when detail.contains('No credential') =>
      'Không tìm thấy tài khoản Google trên máy. Thêm tài khoản trong Cài đặt rồi thử lại.',
    GoogleSignInExceptionCode.interrupted => 'Đăng nhập Google bị gián đoạn. Vui lòng thử lại.',
    _ => 'Không đăng nhập bằng Google được. Vui lòng thử lại.',
  };
  return AppException(
    kind: AppErrorKind.unknown,
    message: showDetail && detail.isNotEmpty ? '$message\n($detail)' : message,
    code: 'GOOGLE_${e.code.name}',
  );
}

class PluginGoogleSignInGateway implements GoogleSignInGateway {
  PluginGoogleSignInGateway([GoogleSignIn? plugin]) : _plugin = plugin ?? GoogleSignIn.instance;

  final GoogleSignIn _plugin;

  /// Plugin chỉ cho `initialize` đúng một lần mỗi tiến trình.
  Future<void>? _initialized;

  Future<void> _ensureInitialized(String serverClientId) =>
      _initialized ??= _plugin.initialize(serverClientId: serverClientId);

  @override
  Future<String?> obtainIdToken({required String serverClientId}) async {
    try {
      await _ensureInitialized(serverClientId);
      final account = await _plugin.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        throw const AppException(
          kind: AppErrorKind.unknown,
          message: 'Google không trả mã xác thực. Vui lòng thử lại.',
        );
      }
      return idToken;
    } on GoogleSignInException catch (e) {
      if (isUserCancellation(e)) return null;
      debugPrint('Google sign-in: ${e.code.name} ${e.description ?? ''}');
      throw googleSignInFailure(e);
    }
  }

  @override
  Future<void> signOut() async {
    // Chưa từng initialize trong phiên chạy này thì không có gì để xoá — và
    // plugin không cho gọi signOut trước initialize.
    if (_initialized == null) return;
    try {
      await _initialized;
      await _plugin.signOut();
    } on Object catch (e) {
      debugPrint('Google sign-out: $e');
    }
  }
}

final googleSignInGatewayProvider = Provider<GoogleSignInGateway>((ref) => PluginGoogleSignInGateway());
