import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';

import '../config/app_config.dart';
import '../theme/app_colors.dart';

/// Test tắt tile để không phát request mạng (flutter_test chặn HTTP).
bool mapTilesEnabled = true;

/// Lớp tile nền dùng chung — nguồn tile cấu hình qua `MAP_TILE_URL`
/// (xem [AppConfig.mapTileUrl]).
Widget baseTileLayer() => !mapTilesEnabled
    ? const SizedBox.shrink()
    : TileLayer(
        urlTemplate: AppConfig.mapTileUrl,
        userAgentPackageName: 'vn.danang.smartcity.smart_city_app',
        maxNativeZoom: 20,
        tileProvider: NetworkTileProvider(),
      );

/// Ghi nguồn bản đồ. Tự viết thay `SimpleAttributionWidget` của flutter_map —
/// widget đó tràn ngang khi chữ hệ thống phóng to 1.6×.
Widget mapAttribution() => const _Attribution();

class _Attribution extends StatelessWidget {
  const _Attribution();

  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.bottomRight,
        child: Container(
          margin: const EdgeInsets.all(2),
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
          color: const Color(0xCCFFFFFF),
          child: const Text(
            AppConfig.mapAttribution,
            maxLines: 1,
            overflow: TextOverflow.fade,
            softWrap: false,
            style: TextStyle(fontSize: 10, color: Color(0xFF333333)),
          ),
        ),
      );
}

/// Marker hình giọt nước có viền — đọc được trên nền bản đồ sáng.
class MapPin extends StatelessWidget {
  const MapPin({super.key, required this.color, this.icon, this.emoji, this.size = 40});

  final Color color;
  final IconData? icon;
  final String? emoji;
  final double size;

  @override
  Widget build(BuildContext context) {
    final surface = context.palette.surface;
    return SizedBox(
      width: size,
      height: size,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(color: surface, width: 2.5),
          boxShadow: const [BoxShadow(color: Color(0x40000000), blurRadius: 4, offset: Offset(0, 2))],
        ),
        child: Center(
          child: emoji != null
              ? Text(emoji!, style: TextStyle(fontSize: size * 0.45))
              : Icon(icon ?? Icons.place, size: size * 0.5, color: Colors.white),
        ),
      ),
    );
  }
}
