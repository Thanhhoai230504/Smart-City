import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';

import '../config/app_config.dart';
import '../theme/app_colors.dart';

/// Test tắt tile để không phát request mạng (flutter_test chặn HTTP).
bool mapTilesEnabled = true;

/// Tile nền mặc định (Google `lyrs=m`) chỉ có bản sáng, kể cả khi app ở theme
/// tối. Mọi đồ hoạ vẽ *trên* bản đồ (ghim, chấm, vạch đường, vòng bán kính) và
/// màu chữ thanh trạng thái phía trên bản đồ tính theo bảng sáng; khung nổi (ô
/// tìm kiếm, chip, nút) vẫn theo theme của app.
const AppPalette mapPalette = AppPalette.light;

/// Màu ghim của một danh mục trên nền bản đồ — icon trắng đọc được ở cả hai theme.
Color mapPinColor(Color category) => CategoryTone.of(category, mapPalette).ink;

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

/// Lớp lưu lượng giao thông (TomTom) — tải **qua proxy backend**
/// `/geo/tiles/traffic`, API key không nằm trong app. Tile trong suốt, chỉ có
/// các vạch màu xanh/vàng/cam/đỏ trên đường.
Widget trafficTileLayer() => !mapTilesEnabled
    ? const SizedBox.shrink()
    : TileLayer(
        urlTemplate: '${AppConfig.apiUrl}/geo/tiles/traffic/{z}/{x}/{y}.png',
        userAgentPackageName: 'vn.danang.smartcity.smart_city_app',
        maxNativeZoom: 18,
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

/// Marker tròn có viền trắng — đọc được trên nền bản đồ sáng ([mapPalette]).
class MapPin extends StatelessWidget {
  const MapPin({super.key, required this.color, this.icon, this.emoji, this.size = 40});

  final Color color;
  final IconData? icon;
  final String? emoji;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(color: mapPalette.surface, width: 2.5),
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
