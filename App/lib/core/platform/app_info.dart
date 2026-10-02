import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Thông tin bản cài và thiết bị, đọc một lần lúc khởi động.
class AppInfo {
  const AppInfo({
    required this.version,
    required this.buildNumber,
    required this.deviceType,
    required this.deviceName,
  });

  /// `1.0.0` — phần trước dấu `+` trong pubspec.
  final String version;
  final String buildNumber;

  /// Giá trị gửi lên `POST /auth/login` (Phụ lục E.3). Phải là `android` hoặc
  /// `ios` thì backend mới trả refresh token trong body — gửi `web` thì token đi
  /// bằng httpOnly cookie và app native không có cookie jar để nhận.
  ///
  /// Bản build web chỉ dùng để xem thử giao diện trên máy phát triển; nó chạy
  /// cùng mã client với app nên cũng nhận token qua body như thiết bị di động.
  final String deviceType;

  /// Để người dùng nhận ra phiên nào là của mình (tối đa 120 ký tự).
  final String deviceName;

  static const fallback = AppInfo(
    version: '1.0.0',
    buildNumber: '1',
    deviceType: 'android',
    deviceName: 'Thiết bị di động',
  );

  static Future<AppInfo> load() async {
    var version = fallback.version;
    var build = fallback.buildNumber;
    try {
      final pkg = await PackageInfo.fromPlatform();
      version = pkg.version;
      build = pkg.buildNumber;
    } catch (_) {
      // Giữ giá trị mặc định — không đáng chặn khởi động.
    }

    final type = !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS
        ? 'ios'
        : 'android';

    var name = fallback.deviceName;
    try {
      final info = DeviceInfoPlugin();
      if (kIsWeb) {
        name = 'Trình duyệt (bản xem thử)';
      } else if (defaultTargetPlatform == TargetPlatform.android) {
        final a = await info.androidInfo;
        name = '${a.manufacturer} ${a.model}'.trim();
      } else if (defaultTargetPlatform == TargetPlatform.iOS) {
        final i = await info.iosInfo;
        name = i.name.isNotEmpty ? i.name : i.model;
      }
    } catch (_) {
      // Không đọc được tên máy thì dùng tên chung.
    }
    if (name.length > 120) name = name.substring(0, 120);

    return AppInfo(
      version: version,
      buildNumber: build,
      deviceType: type,
      deviceName: name,
    );
  }
}

/// Ghi đè trong `main()` bằng giá trị thật từ [AppInfo.load].
final appInfoProvider = Provider<AppInfo>((ref) => AppInfo.fallback);
