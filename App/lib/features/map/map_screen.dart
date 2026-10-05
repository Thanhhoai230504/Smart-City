import 'dart:async';

import 'package:dio/dio.dart' show CancelToken;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../core/network/app_exception.dart';
import '../../core/platform/connectivity.dart';
import '../../core/platform/location.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/debouncer.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_map.dart';
import '../../core/widgets/offline_banner.dart';
import '../../core/widgets/photo_evidence_strip.dart';
import '../../core/widgets/sla_countdown.dart';
import '../../core/widgets/status_chips.dart';
import '../../core/widgets/surfaces.dart';
import '../../data/models/issue.dart';
import '../../data/models/public_info.dart' hide Badge;
import '../../data/repositories/issue_repository.dart';
import '../../data/repositories/meta_repository.dart';
import '../../data/repositories/support_repositories.dart';
import '../report/offline_queue.dart';
import 'map_filters.dart';
import 'route_planner.dart';

/// Địa điểm là dữ liệu tĩnh — tải một lần (G-B6).
final _placesProvider = FutureProvider<List<Place>>((ref) => ref.read(publicRepositoryProvider).places());

/// Thời tiết theo quận — server cache 30 phút, nên tải lại mỗi lần mở bản đồ là đủ.
final _environmentProvider =
    FutureProvider.autoDispose<List<EnvironmentReading>>((ref) => ref.read(publicRepositoryProvider).environment());

/// Khung nhìn bản đồ đã làm tròn — để test được nghiệm thu 2.5 ("kéo 10 lần
/// liên tiếp → ≤ 2 request") mà không cần dựng FlutterMap.
class MapBounds {
  const MapBounds(this.west, this.south, this.east, this.north);

  final double west;
  final double south;
  final double east;
  final double north;

  factory MapBounds.of(LatLngBounds b) => MapBounds(
        _round(b.west.clamp(-180, 180)),
        _round(b.south.clamp(-90, 90)),
        _round(b.east.clamp(-180, 180)),
        _round(b.north.clamp(-90, 90)),
      );

  static double _round(double v) => (v * 10000).roundToDouble() / 10000;

  bool get isValid => west < east && south < north;

  @override
  bool operator ==(Object other) =>
      other is MapBounds && other.west == west && other.south == south && other.east == east && other.north == north;

  @override
  int get hashCode => Object.hash(west, south, east, north);
}

/// Tải sự cố theo khung nhìn — **port nguyên chiến lược `Map/index.tsx`**:
/// debounce 250ms khi kéo/zoom, huỷ request cũ, `limit: 500`, chỉ việc đang mở.
class MapIssueLoader {
  MapIssueLoader(this._fetch);

  final Future<List<Issue>> Function(MapBounds bounds, String? category, CancelToken cancel) _fetch;
  final _latest = LatestRequest<List<Issue>>(const Duration(milliseconds: 250));
  MapBounds? _lastBounds;
  String? _lastCategory;

  void request(
    MapBounds bounds, {
    String? category,
    required void Function(List<Issue>) onResult,
    required void Function(Object) onError,
    void Function()? onStart,
    bool force = false,
  }) {
    if (!bounds.isValid) return;
    if (!force && bounds == _lastBounds && category == _lastCategory) return;
    _lastBounds = bounds;
    _lastCategory = category;
    _latest.run(
      (cancel) => _fetch(bounds, category, cancel),
      onStart: onStart,
      onResult: onResult,
      onError: onError,
    );
  }

  void dispose() => _latest.cancel();
}

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

/// Các lớp bật/tắt trên bản đồ — gom lại để sheet "Lớp bản đồ" sửa một chỗ.
class MapLayers {
  const MapLayers({
    this.places = false,
    this.placeTypes = allPlaceTypes,
    this.density = false,
    this.environment = false,
    this.traffic = false,
    this.radiusKm = 0,
    this.time = 'all',
  });

  static const allPlaceTypes = {'hospital', 'school', 'bus_stop', 'park', 'police'};

  final bool places;
  final Set<String> placeTypes;
  final bool density;
  final bool environment;
  final bool traffic;
  final int radiusKm;
  final String time;

  int get activeCount =>
      [places, density, environment, traffic, radiusKm > 0, time != 'all'].where((on) => on).length;

  MapLayers copyWith({
    bool? places,
    Set<String>? placeTypes,
    bool? density,
    bool? environment,
    bool? traffic,
    int? radiusKm,
    String? time,
  }) =>
      MapLayers(
        places: places ?? this.places,
        placeTypes: placeTypes ?? this.placeTypes,
        density: density ?? this.density,
        environment: environment ?? this.environment,
        traffic: traffic ?? this.traffic,
        radiusKm: radiusKm ?? this.radiusKm,
        time: time ?? this.time,
      );
}

class _MapScreenState extends ConsumerState<MapScreen> {
  final _map = MapController();
  late final MapIssueLoader _loader = MapIssueLoader(
    (b, category, cancel) => ref.read(issueRepositoryProvider).mapIssues(
          west: b.west,
          south: b.south,
          east: b.east,
          north: b.north,
          category: category,
          cancel: cancel,
        ),
  );
  final _searchText = TextEditingController();
  List<Issue> _issues = const [];
  bool _loading = false;
  AppException? _error;
  String? _category;
  String _search = '';
  MapLayers _layers = const MapLayers();
  LatLng? _me;

  RouteResult? _route;
  String? _routeTo;
  LatLng? _routeStart;
  LatLng? _routeEnd;
  bool _routing = false;

  @override
  void dispose() {
    _loader.dispose();
    _map.dispose();
    _searchText.dispose();
    super.dispose();
  }

  void _load({bool force = false}) {
    final camera = _map.camera;
    _loader.request(
      MapBounds.of(camera.visibleBounds),
      category: _category,
      force: force,
      onStart: () => setState(() => _loading = true),
      onResult: (issues) {
        if (!mounted) return;
        setState(() {
          _issues = issues;
          _loading = false;
          _error = null;
        });
      },
      onError: (e) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = AppException.from(e);
        });
      },
    );
  }

  /// Tâm của bộ lọc bán kính: vị trí của tôi nếu đã có, không thì trung tâm
  /// thành phố (web luôn dùng trung tâm — trên điện thoại có GPS thì hợp hơn).
  LatLng get _radiusCenter => _me ?? kDaNangCenter;

  Future<LatLng?> _locate({bool move = true}) async {
    final result = await ref.read(locationServiceProvider).current();
    if (!mounted) return null;
    if (result is LocationOk) {
      setState(() => _me = result.position);
      if (move) {
        _map.move(result.position, 16);
        _load();
      }
      return result.position;
    }
    _snack('Không lấy được vị trí hiện tại.');
    return null;
  }

  void _snack(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _planRoute({RouteEndpoint? to}) async {
    final picked = await RoutePlannerPage.open(context, to: to);
    if (picked == null || !mounted) return;
    final (from, dest) = picked;
    LatLng? me = _me;
    if (from.isMe || dest.isMe) {
      me = await _locate(move: false);
      if (me == null) return;
    }
    final start = from.isMe ? me! : LatLng(from.lat!, from.lng!);
    final end = dest.isMe ? me! : LatLng(dest.lat!, dest.lng!);
    // App chỉ phục vụ Đà Nẵng — GPS đang ở nơi khác (máy ảo mặc định ở Mỹ, người
    // dùng đang đi xa) thì báo rõ thay vì để dịch vụ bản đồ trả lỗi khó hiểu.
    const tooFarKm = 150;
    if (!isNearDaNang(start, tooFarKm) || !isNearDaNang(end, tooFarKm)) {
      _snack(!isNearDaNang(start, tooFarKm)
          ? 'Điểm xuất phát ở ngoài khu vực Đà Nẵng — hãy chọn điểm khác.'
          : 'Điểm đến ở ngoài khu vực Đà Nẵng — hãy chọn điểm khác.');
      return;
    }
    setState(() => _routing = true);
    try {
      final route = await ref
          .read(geoRepositoryProvider)
          .route(start.latitude, start.longitude, end.latitude, end.longitude);
      if (!mounted) return;
      setState(() {
        _route = route;
        _routeTo = dest.label;
        _routeStart = start;
        _routeEnd = end;
      });
      final points = [for (final (lat, lng) in route.points) LatLng(lat, lng)];
      if (points.length > 1) {
        _map.fitCamera(CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(points),
          padding: const EdgeInsets.fromLTRB(48, 180, 48, 240),
        ));
      }
    } on AppException catch (e) {
      // Backend gói mọi lỗi của nhà cung cấp bản đồ thành 503 — với người dùng,
      // đó vẫn là "không tìm được đường".
      if (mounted) {
        _snack(e.kind == AppErrorKind.notFound || e.kind == AppErrorKind.server
            ? 'Không tìm được tuyến đường giữa hai điểm này. Thử chọn điểm khác.'
            : e.message);
      }
    } finally {
      if (mounted) setState(() => _routing = false);
    }
  }

  void _clearRoute() => setState(() {
        _route = null;
        _routeTo = null;
        _routeStart = null;
        _routeEnd = null;
      });

  void _openIssue(Issue issue) {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => _IssuePreview(
        issue: issue,
        onDirections: () {
          Navigator.pop(ctx);
          _planRoute(to: RouteEndpoint(issue.title, issue.latitude, issue.longitude));
        },
      ),
    );
  }

  void _openPlace(Place p) {
    final palette = context.palette;
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Gap.screen, 0, Gap.screen, Gap.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: IconBubble(
                  icon: AppIcons.placeType(p.type),
                  ink: palette.success.text,
                  container: palette.success.container,
                ),
                title: Text(p.name),
                subtitle: Text(
                  [AppIcons.placeTypeLabel(p.type), p.address, p.phone].where((s) => s.isNotEmpty).join('\n'),
                ),
              ),
              Gap.h8,
              OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  _planRoute(to: RouteEndpoint(p.name, p.latitude, p.longitude));
                },
                icon: const Icon(Icons.directions),
                label: const Text('Chỉ đường tới đây'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openEnvironment(EnvironmentReading e) {
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Gap.screen, 0, Gap.screen, Gap.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  IconBubble(
                    icon: weatherIcon(e.condition),
                    ink: palette.accentInk,
                    container: palette.accentSoft,
                    size: 52,
                  ),
                  Gap.w12,
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(e.location, style: textTheme.titleMedium),
                        if (e.description.isNotEmpty) Text(_capitalize(e.description), style: textTheme.bodySmall),
                      ],
                    ),
                  ),
                ],
              ),
              Gap.h16,
              Row(
                children: [
                  Expanded(
                    child: _Metric(
                      icon: Icons.thermostat,
                      label: 'Nhiệt độ',
                      value: e.temperature == null ? '—' : '${e.temperature!.toStringAsFixed(1).replaceAll('.', ',')}°C',
                    ),
                  ),
                  Gap.w12,
                  Expanded(
                    child: _Metric(
                      icon: Icons.water_drop_outlined,
                      label: 'Độ ẩm',
                      value: e.humidity == null ? '—' : '${e.humidity}%',
                    ),
                  ),
                ],
              ),
              if (e.source.isNotEmpty) ...[
                Gap.h12,
                Text('Nguồn: ${e.source}', style: textTheme.bodySmall),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openLayers() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _LayersSheet(
        initial: _layers,
        radiusFromMe: _me != null,
        onChanged: (l) => setState(() => _layers = l),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final meta = ref.watch(metaProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final online = ref.watch(isOnlineProvider);
    final pending = ref.watch(offlineQueueProvider.select((s) => s.count));

    final center = _layers.radiusKm > 0 ? _radiusCenter : null;
    final issues = filterMapIssues(
      _issues,
      search: _search,
      center: center,
      radiusKm: _layers.radiusKm,
      time: _layers.time,
    );
    final places = _layers.places
        ? filterMapPlaces(
            ref.watch(_placesProvider).valueOrNull ?? const <Place>[],
            types: _layers.placeTypes,
            search: _search,
            center: center,
            radiusKm: _layers.radiusKm,
          )
        : const <Place>[];
    final environment = _layers.environment
        ? (ref.watch(_environmentProvider).valueOrNull ?? const <EnvironmentReading>[])
        : const <EnvironmentReading>[];
    final routePoints = [for (final (lat, lng) in _route?.points ?? const <(double, double)>[]) LatLng(lat, lng)];

    // Giờ/pin nằm trên tile bản đồ — luôn là nền sáng, kể cả ở theme tối.
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        body: Stack(
          children: [
            FlutterMap(
              mapController: _map,
              options: MapOptions(
                initialCenter: kDaNangCenter,
                initialZoom: 13,
                minZoom: 9,
                maxZoom: 19,
                onMapReady: _load,
                onPositionChanged: (_, _) => _load(),
              ),
              children: [
                baseTileLayer(),
                if (_layers.traffic) trafficTileLayer(),
                if (_layers.radiusKm > 0)
                  CircleLayer(circles: [
                    CircleMarker(
                      point: _radiusCenter,
                      radius: _layers.radiusKm * 1000.0,
                      useRadiusInMeter: true,
                      color: mapPalette.primary.withValues(alpha: 0.06),
                      borderColor: mapPalette.primary.withValues(alpha: 0.5),
                      borderStrokeWidth: 1.5,
                    ),
                  ]),
                // Lớp mật độ (2.7): leaflet.heat không có bản Flutter chín, nên vẽ
                // vòng tròn mờ theo mét — chồng nhiều vòng thì đậm hơn.
                if (_layers.density)
                  CircleLayer(circles: [
                    for (final i in issues)
                      CircleMarker(
                        point: LatLng(i.latitude, i.longitude),
                        radius: 180,
                        useRadiusInMeter: true,
                        color: mapPalette.accent.withValues(alpha: 0.16),
                        borderStrokeWidth: 0,
                      ),
                  ]),
                if (routePoints.length > 1)
                  PolylineLayer(polylines: [
                    Polyline(
                      points: routePoints,
                      strokeWidth: 6,
                      color: mapPalette.primary,
                      borderColor: Colors.white,
                      borderStrokeWidth: 2,
                    ),
                  ]),
                MarkerLayer(markers: [
                  for (final p in places)
                    Marker(
                      point: LatLng(p.latitude, p.longitude),
                      width: 32,
                      height: 32,
                      child: GestureDetector(
                        onTap: () => _openPlace(p),
                        child: MapPin(color: mapPalette.secondary, icon: AppIcons.placeType(p.type), size: 32),
                      ),
                    ),
                  for (final e in environment)
                    Marker(
                      point: LatLng(e.latitude, e.longitude),
                      width: 84,
                      height: 36,
                      child: GestureDetector(onTap: () => _openEnvironment(e), child: _WeatherPin(reading: e)),
                    ),
                  for (final i in issues)
                    Marker(
                      point: LatLng(i.latitude, i.longitude),
                      width: 44,
                      height: 44,
                      child: Semantics(
                        button: true,
                        label: '${meta.categoryLabel(i.category)}: ${i.title}',
                        child: GestureDetector(onTap: () => _openIssue(i), child: _IssuePin(issue: i)),
                      ),
                    ),
                  if (_routeStart != null)
                    Marker(point: _routeStart!, width: 22, height: 22, child: _Dot(color: mapPalette.success.text)),
                  if (_routeEnd != null)
                    Marker(
                      point: _routeEnd!,
                      width: 36,
                      height: 36,
                      child: MapPin(color: mapPalette.error, icon: Icons.flag, size: 36),
                    ),
                  if (_me != null) Marker(point: _me!, width: 24, height: 24, child: _Dot(color: mapPalette.primary, halo: true)),
                ]),
                mapAttribution(),
              ],
            ),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.screen, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _Floating(
                            child: TextField(
                              controller: _searchText,
                              textInputAction: TextInputAction.search,
                              onChanged: (v) => setState(() => _search = v),
                              decoration: InputDecoration(
                                hintText: 'Tìm sự cố, địa điểm trên bản đồ…',
                                prefixIcon: const Icon(Icons.search),
                                fillColor: palette.surface,
                                isDense: true,
                                suffixIcon: _search.isEmpty
                                    ? null
                                    : IconButton(
                                        tooltip: 'Xoá tìm kiếm',
                                        icon: const Icon(Icons.close),
                                        onPressed: () => setState(() {
                                          _searchText.clear();
                                          _search = '';
                                        }),
                                      ),
                              ),
                            ),
                          ),
                        ),
                        Gap.w8,
                        _Floating(
                          child: Badge(
                            isLabelVisible: _layers.activeCount > 0,
                            label: Text('${_layers.activeCount}'),
                            child: IconButton(
                              tooltip: 'Lớp bản đồ',
                              onPressed: _openLayers,
                              icon: const Icon(Icons.layers_outlined),
                            ),
                          ),
                        ),
                        Gap.w8,
                        _Floating(
                          child: IconButton(
                            tooltip: 'Chỉ đường',
                            onPressed: _routing ? null : () => _planRoute(),
                            icon: _routing
                                ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
                                : Icon(Icons.directions, color: palette.primary),
                          ),
                        ),
                      ],
                    ),
                    Gap.h8,
                    SizedBox(
                      height: 40,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          _MapChip(
                            label: 'Tất cả',
                            selected: _category == null,
                            onTap: () {
                              setState(() => _category = null);
                              _load(force: true);
                            },
                          ),
                          for (final c in meta.categories)
                            _MapChip(
                              label: c.label,
                              icon: AppIcons.category(c.value),
                              iconColor: CategoryTone.of(hexColor(c.color), palette).ink,
                              selected: _category == c.value,
                              onTap: () {
                                setState(() => _category = c.value);
                                _load(force: true);
                              },
                            ),
                        ],
                      ),
                    ),
                    if (_loading) ...[
                      Gap.h8,
                      ClipRRect(
                        borderRadius: BorderRadius.circular(2),
                        child: const LinearProgressIndicator(minHeight: 3),
                      ),
                    ],
                    if (OfflineBanner.isVisible(online: online, pendingCount: pending)) ...[
                      Gap.h8,
                      ClipRRect(
                        borderRadius: BorderRadius.circular(Radii.tile),
                        child: OfflineBanner(
                          online: online,
                          pendingCount: pending,
                          onTap: pending > 0 ? () => context.push(Routes.pendingReports) : null,
                        ),
                      ),
                    ],
                    if (_layers.traffic) ...[
                      Gap.h8,
                      const Align(alignment: Alignment.centerLeft, child: _TrafficLegend()),
                    ],
                  ],
                ),
              ),
            ),
            Positioned(
              left: Gap.screen,
              right: Gap.screen,
              bottom: Gap.lg,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Flexible(
                        child: _Floating(
                          radius: Radii.chip,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: Gap.sm),
                            child: Text(
                              _error != null
                                  ? (_error!.kind == AppErrorKind.network ? 'Ngoại tuyến — không tải được' : _error!.message)
                                  : '${issues.length} sự cố đang mở'
                                      '${issues.length < _issues.where((i) => i.status.isOpen).length ? ' (đã lọc)' : ' trong khung nhìn'}'
                                      '${_issues.length >= 500 ? ' · tối đa 500, phóng to để xem thêm' : ''}',
                              style: textTheme.labelSmall,
                            ),
                          ),
                        ),
                      ),
                      const Spacer(),
                      FloatingActionButton.small(
                        heroTag: 'map-locate',
                        tooltip: 'Vị trí của tôi',
                        backgroundColor: palette.surface,
                        foregroundColor: palette.primary,
                        onPressed: _locate,
                        child: const Icon(Icons.my_location),
                      ),
                    ],
                  ),
                  if (_route != null) ...[
                    Gap.h12,
                    _RouteCard(route: _route!, to: _routeTo ?? 'Điểm đến', onClear: _clearRoute, onEdit: () => _planRoute()),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _capitalize(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

IconData weatherIcon(String condition) => switch (condition.toLowerCase()) {
      'clear' => Icons.wb_sunny_outlined,
      'clouds' => Icons.cloud_outlined,
      'rain' || 'drizzle' => Icons.umbrella_outlined,
      'thunderstorm' => Icons.thunderstorm_outlined,
      'mist' || 'fog' || 'haze' || 'smoke' => Icons.blur_on,
      _ => Icons.thermostat,
    };

/// Lớp vỏ nổi trên bản đồ: nền mặt card + bóng, để đọc được trên mọi nền tile.
class _Floating extends StatelessWidget {
  const _Floating({required this.child, this.radius = Radii.input});

  final Widget child;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: palette.border),
        boxShadow: const [BoxShadow(color: Color(0x260B2540), blurRadius: 12, offset: Offset(0, 3))],
      ),
      child: ClipRRect(borderRadius: BorderRadius.circular(radius), child: child),
    );
  }
}

class _MapChip extends StatelessWidget {
  const _MapChip({required this.label, required this.selected, required this.onTap, this.icon, this.iconColor});

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(right: Gap.sm),
        child: ChoiceChip(
          showCheckmark: false,
          avatar: icon == null ? null : Icon(icon, size: 16, color: iconColor),
          label: Text(label),
          selected: selected,
          elevation: 2,
          shadowColor: const Color(0x400B2540),
          onSelected: (_) => onTap(),
        ),
      );
}

/// Ghim sự cố: tròn màu danh mục + icon, chấm trạng thái ở góc (đỏ = mới báo,
/// cam = đang xử lý) — bản đồ chỉ hiện việc đang mở.
class _IssuePin extends ConsumerWidget {
  const _IssuePin({required this.issue});

  final Issue issue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = ref.watch(metaProvider).category(issue.category);
    final status = mapPalette.statusColors(issue.status);
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(
          child: MapPin(color: mapPinColor(hexColor(c.color)), icon: AppIcons.category(issue.category), size: 44),
        ),
        Positioned(
          right: -1,
          top: -1,
          child: Container(
            width: 14,
            height: 14,
            decoration: BoxDecoration(
              color: status.text,
              shape: BoxShape.circle,
              border: Border.all(color: mapPalette.surface, width: 2),
            ),
          ),
        ),
      ],
    );
  }
}

class _WeatherPin extends StatelessWidget {
  const _WeatherPin({required this.reading});

  final EnvironmentReading reading;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      label: 'Thời tiết ${reading.location}: ${reading.temperature?.round() ?? '—'} độ',
      excludeSemantics: true,
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: palette.surface,
            borderRadius: BorderRadius.circular(Radii.chip),
            border: Border.all(color: palette.accent.withValues(alpha: 0.6)),
            boxShadow: const [BoxShadow(color: Color(0x330B2540), blurRadius: 6, offset: Offset(0, 2))],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(weatherIcon(reading.condition), size: 16, color: palette.accentInk),
              const SizedBox(width: 4),
              Text(
                reading.temperature == null ? '—' : '${reading.temperature!.round()}°',
                style: textTheme.labelMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color, this.halo = false});

  final Color color;
  final bool halo;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 3),
          boxShadow: halo ? [BoxShadow(color: color.withValues(alpha: 0.35), blurRadius: 0, spreadRadius: 8)] : null,
        ),
      );
}

class _Metric extends StatelessWidget {
  const _Metric({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;
    return AppCard(
      elevated: false,
      color: palette.surfaceAlt,
      padding: const EdgeInsets.all(Gap.md),
      child: Row(
        children: [
          Icon(icon, color: palette.primary),
          Gap.w8,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: textTheme.bodySmall),
                Text(value, style: textTheme.titleLarge),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Chú thích màu lớp giao thông — giống web (thông thoáng → kẹt).
class _TrafficLegend extends StatelessWidget {
  const _TrafficLegend();

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    Widget item(Color color, String label) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 14, height: 6, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
            const SizedBox(width: 4),
            Text(label, style: textTheme.labelSmall),
            const SizedBox(width: 10),
          ],
        );
    return _Floating(
      radius: Radii.chip,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: 6),
        child: Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          runSpacing: 4,
          children: [
            item(const Color(0xFF22C55E), 'Thông thoáng'),
            item(const Color(0xFFEAB308), 'Chậm'),
            item(const Color(0xFFF97316), 'Đông'),
            item(const Color(0xFFEF4444), 'Kẹt'),
          ],
        ),
      ),
    );
  }
}

class _RouteCard extends StatelessWidget {
  const _RouteCard({required this.route, required this.to, required this.onClear, required this.onEdit});

  final RouteResult route;
  final String to;
  final VoidCallback onClear;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;
    final d = describeRoute(route);
    return AppCard(
      padding: const EdgeInsets.fromLTRB(Gap.md, Gap.md, Gap.xs, Gap.md),
      child: Row(
        children: [
          IconBubble(
            icon: Icons.directions_car_outlined,
            ink: palette.onPrimary,
            container: palette.primary,
            size: 44,
          ),
          Gap.w12,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${d.duration} · ${d.distance}', style: textTheme.titleMedium),
                Text('Tới $to', style: textTheme.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                if (d.delay != null)
                  Text(d.delay!, style: textTheme.labelSmall?.copyWith(color: palette.slaColors(SlaStatus.dueSoon).text)),
              ],
            ),
          ),
          IconButton(tooltip: 'Đổi tuyến', onPressed: onEdit, icon: const Icon(Icons.edit_road)),
          IconButton(tooltip: 'Xoá tuyến', onPressed: onClear, icon: const Icon(Icons.close)),
        ],
      ),
    );
  }
}

/// Sheet "Lớp bản đồ" — áp dụng ngay khi bật/tắt, như web.
class _LayersSheet extends StatefulWidget {
  const _LayersSheet({required this.initial, required this.onChanged, required this.radiusFromMe});

  final MapLayers initial;
  final ValueChanged<MapLayers> onChanged;
  final bool radiusFromMe;

  @override
  State<_LayersSheet> createState() => _LayersSheetState();
}

class _LayersSheetState extends State<_LayersSheet> {
  late MapLayers _l = widget.initial;

  void _set(MapLayers l) {
    setState(() => _l = l);
    widget.onChanged(l);
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;
    final scheme = Theme.of(context).colorScheme;

    Widget toggle(IconData icon, String title, String subtitle, bool value, ValueChanged<bool> onChanged) =>
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          secondary: IconBubble(icon: icon, ink: scheme.onPrimaryContainer, container: scheme.primaryContainer, size: 40),
          title: Text(title),
          subtitle: Text(subtitle),
          value: value,
          onChanged: onChanged,
        );

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      builder: (context, scroll) => ListView(
        controller: scroll,
        padding: const EdgeInsets.fromLTRB(Gap.screen, 0, Gap.screen, Gap.xxl),
        children: [
          Text('Lớp bản đồ', style: textTheme.titleLarge),
          Gap.h12,
          toggle(Icons.thermostat, 'Thời tiết', 'Nhiệt độ, độ ẩm theo quận (OpenWeather)', _l.environment,
              (v) => _set(_l.copyWith(environment: v))),
          toggle(Icons.traffic_outlined, 'Giao thông', 'Lưu lượng xe thời gian thực trên đường', _l.traffic,
              (v) => _set(_l.copyWith(traffic: v))),
          if (_l.traffic) const Padding(padding: EdgeInsets.only(left: 52, bottom: Gap.sm), child: _TrafficLegend()),
          toggle(Icons.blur_on, 'Mật độ sự cố', 'Vùng đậm là nơi nhiều sự cố đang mở', _l.density,
              (v) => _set(_l.copyWith(density: v))),
          toggle(Icons.local_hospital_outlined, 'Địa điểm công cộng', 'Bệnh viện, trường học, trạm xe buýt…', _l.places,
              (v) => _set(_l.copyWith(places: v))),
          if (_l.places)
            Padding(
              padding: const EdgeInsets.only(left: 52, bottom: Gap.sm),
              child: Wrap(
                spacing: Gap.sm,
                runSpacing: Gap.sm,
                children: [
                  for (final type in MapLayers.allPlaceTypes)
                    FilterChip(
                      avatar: Icon(AppIcons.placeType(type), size: 16),
                      label: Text(AppIcons.placeTypeLabel(type)),
                      selected: _l.placeTypes.contains(type),
                      onSelected: (on) {
                        final types = {..._l.placeTypes};
                        on ? types.add(type) : types.remove(type);
                        _set(_l.copyWith(placeTypes: types));
                      },
                    ),
                ],
              ),
            ),
          const Divider(height: Gap.xxl),
          Text('Lọc sự cố', style: textTheme.titleMedium),
          Gap.h12,
          Text(
            _l.radiusKm == 0
                ? 'Bán kính: tất cả'
                : 'Bán kính ${_l.radiusKm} km quanh ${widget.radiusFromMe ? 'vị trí của bạn' : 'trung tâm thành phố'}',
            style: textTheme.bodyMedium,
          ),
          Slider(
            value: _l.radiusKm.toDouble(),
            max: 20,
            divisions: 20,
            label: _l.radiusKm == 0 ? 'Tất cả' : '${_l.radiusKm} km',
            onChanged: (v) => _set(_l.copyWith(radiusKm: v.round())),
          ),
          Gap.h8,
          Text('Thời gian báo cáo', style: textTheme.bodyMedium),
          Gap.h8,
          Wrap(
            spacing: Gap.sm,
            children: [
              for (final (value, label) in mapTimeFilters)
                ChoiceChip(
                  label: Text(label),
                  selected: _l.time == value,
                  onSelected: (_) => _set(_l.copyWith(time: value)),
                ),
            ],
          ),
          const Divider(height: Gap.xxl),
          Text('Chú thích', style: textTheme.titleMedium),
          Gap.h8,
          for (final s in [IssueStatus.reported, IssueStatus.processing])
            Padding(
              padding: const EdgeInsets.only(bottom: Gap.sm),
              child: Row(
                children: [
                  Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(color: palette.statusColors(s).text, shape: BoxShape.circle),
                  ),
                  Gap.w8,
                  Text(s == IssueStatus.reported ? 'Chấm đỏ: mới báo cáo' : 'Chấm cam: đang xử lý',
                      style: textTheme.bodySmall),
                ],
              ),
            ),
          Text('Màu ghim là loại sự cố. Bản đồ chỉ hiện sự cố đang mở.', style: textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _IssuePreview extends StatelessWidget {
  const _IssuePreview({required this.issue, required this.onDirections});

  final Issue issue;
  final VoidCallback onDirections;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final cover = issue.imageUrl ?? issue.coverUrl;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Gap.screen, 0, Gap.screen, Gap.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (cover != null)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(Radii.image),
                    child: SizedBox.square(dimension: 76, child: AppImage(PhotoSource.url(cover))),
                  )
                else
                  CategoryBadge(issue.category, size: 56),
                Gap.w12,
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CategoryLabel(issue.category),
                      Gap.h4,
                      Text(issue.title, style: textTheme.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
                      Gap.h4,
                      Text(issue.location, style: textTheme.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis),
                    ],
                  ),
                ),
              ],
            ),
            Gap.h12,
            Wrap(
              spacing: Gap.sm,
              runSpacing: Gap.sm,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                StatusChip(issue.status, dense: true),
                if (issue.dueAt != null) SlaCountdown(issue: issue, dense: true),
                Text('${issue.voteCount} ủng hộ · ${Fmt.relative(issue.createdAt)}', style: textTheme.bodySmall),
              ],
            ),
            Gap.h16,
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onDirections,
                    icon: const Icon(Icons.directions),
                    label: const Text('Chỉ đường'),
                  ),
                ),
                Gap.w12,
                Expanded(
                  child: FilledButton(
                    onPressed: () {
                      Navigator.pop(context);
                      unawaited(context.push(Routes.issue(issue.id)));
                    },
                    child: const Text('Xem chi tiết'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
