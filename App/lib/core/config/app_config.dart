import 'package:flutter/foundation.dart';

/// Cấu hình môi trường, đọc từ `--dart-define` / `--dart-define-from-file`.
///
/// KHÔNG hardcode URL và KHÔNG commit file `.env` (task 0.3). Chạy:
///
/// ```
/// flutter run --dart-define-from-file=config/dev.json
/// flutter build apk --dart-define-from-file=config/prod.json
/// ```
///
/// Thiết bị thật cùng wifi phải truyền IP LAN của máy chạy backend:
/// `--dart-define=API_URL=http://192.168.1.10:5000/api`.
class AppConfig {
  const AppConfig._();

  static const String _definedApiUrl = String.fromEnvironment('API_URL');

  /// `dev` hoặc `prod`.
  static const String environment =
      String.fromEnvironment('APP_ENV', defaultValue: 'dev');

  static bool get isProduction => environment == 'prod';

  /// Nguồn tile nền. Mặc định trùng web (`Frontend/src/utils/mapTiles.ts`) để
  /// hai sản phẩm nhìn cùng một bản đồ. ⚠️ Đây không phải API chính thức của
  /// Google — kế hoạch mục 3.1 đã ghi rõ; đổi sang nhà cung cấp có key thì truyền
  /// `MAP_TILE_URL` (nên đi qua proxy backend để key không nằm trong APK).
  static const String mapTileUrl = String.fromEnvironment(
    'MAP_TILE_URL',
    defaultValue: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=vi',
  );

  static const String mapAttribution = String.fromEnvironment(
    'MAP_ATTRIBUTION',
    defaultValue: '© Google Maps',
  );

  /// URL gốc của REST API, luôn kết thúc bằng `/api`.
  static String get apiUrl => resolveApiUrl(
        defined: _definedApiUrl,
        platform: defaultTargetPlatform,
        isWeb: kIsWeb,
      );

  /// Origin của server (không có `/api`) — dùng cho Socket.IO.
  static String get serverOrigin => originOf(apiUrl);

  /// Tách thành hàm thuần để test được mà không cần build lại với define khác.
  ///
  /// `localhost` trên Android emulator trỏ vào CHÍNH emulator, không phải máy
  /// phát triển — gọi nhầm là màn đăng nhập hỏng ngay (cạm bẫy ở Phase 0.0).
  /// `10.0.2.2` là alias emulator dùng để gọi về máy chủ.
  static String resolveApiUrl({
    required String defined,
    required TargetPlatform platform,
    required bool isWeb,
  }) {
    if (defined.trim().isNotEmpty) {
      return defined.trim().replaceFirst(RegExp(r'/+$'), '');
    }
    if (!isWeb && platform == TargetPlatform.android) {
      return 'http://10.0.2.2:5000/api';
    }
    return 'http://localhost:5000/api';
  }

  static String originOf(String apiUrl) =>
      apiUrl.replaceFirst(RegExp(r'/api/?$'), '');
}
