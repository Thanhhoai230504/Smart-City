import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

/// Trung tâm Đà Nẵng — dùng khi chưa có GPS.
const kDaNangCenter = LatLng(16.0544, 108.2022);

/// Kết quả xin vị trí — đủ ba nhánh quyền của task 3.3 (chưa xin → từ chối →
/// từ chối vĩnh viễn → mở Settings), cộng trường hợp GPS đang tắt.
sealed class LocationResult {
  const LocationResult();
}

class LocationOk extends LocationResult {
  const LocationOk(this.position, this.accuracyMeters);

  final LatLng position;
  final double accuracyMeters;
}

class LocationServiceOff extends LocationResult {
  const LocationServiceOff();
}

class LocationDenied extends LocationResult {
  const LocationDenied();
}

/// Phải mở Cài đặt mới cấp lại được.
class LocationDeniedForever extends LocationResult {
  const LocationDeniedForever();
}

class LocationFailed extends LocationResult {
  const LocationFailed(this.message);

  final String message;
}

class LocationService {
  const LocationService();

  /// Không bao giờ ném lỗi — người dân luôn có đường nhập tay.
  Future<LocationResult> current({bool request = true}) async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return const LocationServiceOff();

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied && request) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied) return const LocationDenied();
      if (permission == LocationPermission.deniedForever) return const LocationDeniedForever();

      final p = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );
      return LocationOk(LatLng(p.latitude, p.longitude), p.accuracy);
    } catch (e) {
      return const LocationFailed('Không lấy được vị trí. Bạn có thể kéo bản đồ hoặc nhập địa chỉ.');
    }
  }

  /// Chỉ đọc khi quyền đã có sẵn — không bật hộp thoại xin quyền.
  Future<LocationResult> currentIfGranted() => current(request: false);

  Future<bool> openAppSettings() => Geolocator.openAppSettings();

  Future<bool> openLocationSettings() => Geolocator.openLocationSettings();
}

final locationServiceProvider = Provider<LocationService>((ref) => const LocationService());
