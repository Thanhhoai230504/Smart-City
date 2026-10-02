import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Ghi đè trong `main()` bằng instance thật (`SharedPreferences.getInstance()`),
/// để mọi nơi đọc đồng bộ. Test dùng `SharedPreferences.setMockInitialValues`.
final sharedPrefsProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError('sharedPrefsProvider phải được override trong main()'),
);

abstract final class PrefKeys {
  static const metaCache = 'meta_enums_cache_v1';
  static const themeMode = 'theme_mode';
  static const lastSeenNotificationIds = 'seen_notification_ids';
}
