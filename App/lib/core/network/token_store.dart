import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Kho khoá–giá trị an toàn. Tách interface để test không cần plugin native.
abstract class SecureStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

/// Keychain (iOS) / Keystore (Android) qua `flutter_secure_storage`.
class FlutterSecureStore implements SecureStore {
  FlutterSecureStore([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

/// Bản trong bộ nhớ cho test.
class MemorySecureStore implements SecureStore {
  final Map<String, String> values = {};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;

  @override
  Future<void> delete(String key) async => values.remove(key);
}

/// Giữ token theo đúng task 1.6 của kế hoạch:
/// - **access token chỉ ở RAM** — sống 15 phút, mất khi tắt app là đúng ý;
/// - **refresh token ở secure storage** — để mở lại app không phải đăng nhập.
///
/// Refresh token có **rotation** ở backend (G-B1): mỗi lần refresh trả token mới
/// và token cũ chết ngay, nên phải ghi đè ngay sau mỗi lần refresh thành công.
class TokenStore {
  TokenStore(this._secure);

  static const _refreshKey = 'refresh_token';
  static const _userKey = 'cached_user';

  final SecureStore _secure;
  String? accessToken;

  Future<String?> readRefreshToken() => _secure.read(_refreshKey);

  Future<void> saveRefreshToken(String token) =>
      _secure.write(_refreshKey, token);

  /// Hồ sơ người dùng gần nhất (JSON). Cho phép mở app khi đang offline mà vẫn
  /// ở trạng thái đăng nhập — người dân soạn phiếu offline là kịch bản chính
  /// của Phase 3.6.
  Future<String?> readCachedUser() => _secure.read(_userKey);

  Future<void> saveCachedUser(String json) => _secure.write(_userKey, json);

  Future<void> clear() async {
    accessToken = null;
    await _secure.delete(_refreshKey);
    await _secure.delete(_userKey);
  }
}
