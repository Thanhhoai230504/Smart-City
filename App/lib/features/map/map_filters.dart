import 'package:latlong2/latlong.dart';

import '../../data/models/issue.dart';
import '../../data/models/public_info.dart';

/// Mốc thời gian của bộ lọc "Mới báo cáo trong…" — giống web (`24h · 7d · 30d`).
const mapTimeFilters = <(String, String)>[
  ('all', 'Mọi lúc'),
  ('24h', '24 giờ'),
  ('7d', '7 ngày'),
  ('30d', '30 ngày'),
];

const _hoursByTime = {'24h': 24, '7d': 168, '30d': 720};

const _distance = Distance();

/// Có nằm trong khoảng [km] quanh trung tâm Đà Nẵng không.
bool isNearDaNang(LatLng point, int km) =>
    _distance.as(LengthUnit.Kilometer, const LatLng(16.0544, 108.2022), point) <= km;

bool _withinRadius(LatLng? center, int radiusKm, double lat, double lng) =>
    radiusKm <= 0 || center == null || _distance.as(LengthUnit.Meter, center, LatLng(lat, lng)) <= radiusKm * 1000;

bool _matches(String search, List<String> fields) {
  final q = search.trim().toLowerCase();
  return q.isEmpty || fields.any((f) => f.toLowerCase().contains(q));
}

/// Lọc phía client như web: chỉ việc **đang mở**, tìm theo tiêu đề/địa chỉ, bán
/// kính quanh [center], và thời gian báo cáo.
List<Issue> filterMapIssues(
  List<Issue> issues, {
  String search = '',
  LatLng? center,
  int radiusKm = 0,
  String time = 'all',
  DateTime? now,
}) {
  final hours = _hoursByTime[time];
  final cutoff = hours == null ? null : (now ?? DateTime.now()).subtract(Duration(hours: hours));
  return [
    for (final i in issues)
      if (i.status.isOpen &&
          _matches(search, [i.title, i.location]) &&
          _withinRadius(center, radiusKm, i.latitude, i.longitude) &&
          (cutoff == null || (i.createdAt != null && !i.createdAt!.isBefore(cutoff))))
        i,
  ];
}

/// Địa điểm theo loại đang bật + cùng ô tìm kiếm và bán kính với sự cố.
List<Place> filterMapPlaces(
  List<Place> places, {
  required Set<String> types,
  String search = '',
  LatLng? center,
  int radiusKm = 0,
}) =>
    [
      for (final p in places)
        if (types.contains(p.type) &&
            _matches(search, [p.name, p.address]) &&
            _withinRadius(center, radiusKm, p.latitude, p.longitude))
          p,
    ];

/// "5,2 km · 14 phút" — dùng cho thẻ tóm tắt tuyến đường.
({String distance, String duration, String? delay}) describeRoute(RouteResult r) {
  String minutes(int seconds) {
    final m = (seconds / 60).round();
    if (m < 60) return '${m < 1 ? 1 : m} phút';
    final h = m ~/ 60;
    final rest = m % 60;
    return rest == 0 ? '$h giờ' : '$h giờ $rest phút';
  }

  final meters = r.distanceMeters ?? 0;
  final distance = meters < 1000 ? '${meters.round()} m' : '${(meters / 1000).toStringAsFixed(1).replaceAll('.', ',')} km';
  return (
    distance: distance,
    duration: r.durationSeconds == null ? '—' : minutes(r.durationSeconds!),
    delay: r.trafficDelaySeconds >= 60 ? 'Kẹt xe thêm ${minutes(r.trafficDelaySeconds)}' : null,
  );
}
