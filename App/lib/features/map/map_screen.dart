import 'dart:async';

import 'package:dio/dio.dart' show CancelToken;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../core/network/app_exception.dart';
import '../../core/platform/location.dart';
import '../../core/router/app_shell.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/debouncer.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_map.dart';
import '../../core/widgets/photo_evidence_strip.dart';
import '../../core/widgets/status_chips.dart';
import '../../data/models/issue.dart';
import '../../data/models/public_info.dart';
import '../../data/repositories/issue_repository.dart';
import '../../data/repositories/meta_repository.dart';
import '../../data/repositories/support_repositories.dart';

/// Địa điểm là dữ liệu tĩnh — tải một lần (G-B6).
final _placesProvider = FutureProvider<List<Place>>((ref) => ref.read(publicRepositoryProvider).places());

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
  List<Issue> _issues = const [];
  bool _loading = false;
  AppException? _error;
  String? _category;
  bool _showPlaces = false;
  bool _showDensity = false;
  LatLng? _me;

  @override
  void dispose() {
    _loader.dispose();
    _map.dispose();
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

  Future<void> _locate() async {
    final result = await ref.read(locationServiceProvider).current();
    if (!mounted) return;
    if (result is LocationOk) {
      setState(() => _me = result.position);
      _map.move(result.position, 16);
      _load();
    } else {
      showSnack('Không lấy được vị trí hiện tại.');
    }
  }

  void showSnack(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  void _openIssue(Issue issue) {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => _IssuePreview(issue: issue),
    );
  }

  void _openPlace(Place p) {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => ListTile(
        contentPadding: const EdgeInsets.fromLTRB(Gap.screen, 0, Gap.screen, Gap.xl),
        leading: Icon(AppIcons.placeType(p.type)),
        title: Text(p.name),
        subtitle: Text([AppIcons.placeTypeLabel(p.type), p.address, p.phone].where((s) => s.isNotEmpty).join('\n')),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final meta = ref.watch(metaProvider);
    final places = _showPlaces ? (ref.watch(_placesProvider).valueOrNull ?? const <Place>[]) : const <Place>[];
    final palette = context.palette;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bản đồ sự cố'),
        bottom: connectivityBar(context, ref),
        actions: [
          IconButton(
            tooltip: _showDensity ? 'Tắt lớp mật độ' : 'Bật lớp mật độ',
            isSelected: _showDensity,
            icon: const Icon(Icons.blur_on_outlined),
            selectedIcon: const Icon(Icons.blur_on),
            onPressed: () => setState(() => _showDensity = !_showDensity),
          ),
          IconButton(
            tooltip: _showPlaces ? 'Ẩn bệnh viện, trường học' : 'Hiện bệnh viện, trường học',
            isSelected: _showPlaces,
            icon: const Icon(Icons.local_hospital_outlined),
            selectedIcon: const Icon(Icons.local_hospital),
            onPressed: () => setState(() => _showPlaces = !_showPlaces),
          ),
        ],
      ),
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
              // Lớp mật độ (2.7): leaflet.heat không có bản Flutter chín, nên vẽ
              // vòng tròn mờ theo mét — chồng nhiều vòng thì đậm hơn.
              if (_showDensity)
                CircleLayer(circles: [
                  for (final i in _issues)
                    CircleMarker(
                      point: LatLng(i.latitude, i.longitude),
                      radius: 180,
                      useRadiusInMeter: true,
                      color: palette.error.withValues(alpha: 0.12),
                      borderStrokeWidth: 0,
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
                      child: MapPin(color: palette.secondary, icon: AppIcons.placeType(p.type), size: 32),
                    ),
                  ),
                for (final i in _issues)
                  Marker(
                    point: LatLng(i.latitude, i.longitude),
                    width: 40,
                    height: 40,
                    child: Semantics(
                      button: true,
                      label: '${meta.categoryLabel(i.category)}: ${i.title}',
                      child: GestureDetector(
                        onTap: () => _openIssue(i),
                        child: MapPin(
                          color: hexColor(meta.category(i.category).color),
                          emoji: meta.category(i.category).icon,
                        ),
                      ),
                    ),
                  ),
                if (_me != null)
                  Marker(
                    point: _me!,
                    width: 22,
                    height: 22,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: palette.primary,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 3),
                      ),
                    ),
                  ),
              ]),
              mapAttribution(),
            ],
          ),
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            child: Column(
              children: [
                if (_loading) const LinearProgressIndicator(minHeight: 3),
                SizedBox(
                  height: 56,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: Gap.screen, vertical: Gap.sm),
                    children: [
                      ChoiceChip(
                        label: const Text('Tất cả'),
                        selected: _category == null,
                        onSelected: (_) {
                          setState(() => _category = null);
                          _load(force: true);
                        },
                      ),
                      for (final c in meta.categories) ...[
                        Gap.w8,
                        ChoiceChip(
                          label: Text('${c.icon} ${c.label}'),
                          selected: _category == c.value,
                          onSelected: (_) {
                            setState(() => _category = c.value);
                            _load(force: true);
                          },
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            left: Gap.screen,
            bottom: Gap.lg,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: Gap.sm),
              decoration: BoxDecoration(
                color: palette.surface,
                borderRadius: BorderRadius.circular(Radii.button),
                border: Border.all(color: palette.border),
              ),
              child: Text(
                _error != null
                    ? (_error!.kind == AppErrorKind.network ? 'Ngoại tuyến — không tải được' : _error!.message)
                    : '${_issues.length} sự cố đang mở trong khung nhìn'
                        '${_issues.length >= 500 ? ' (tối đa 500 — phóng to để xem thêm)' : ''}',
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ),
          ),
          Positioned(
            right: Gap.screen,
            bottom: Gap.lg,
            child: FloatingActionButton.small(
              heroTag: 'map-locate',
              tooltip: 'Vị trí của tôi',
              onPressed: _locate,
              child: const Icon(Icons.my_location),
            ),
          ),
        ],
      ),
    );
  }
}

class _IssuePreview extends ConsumerWidget {
  const _IssuePreview({required this.issue});

  final Issue issue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = ref.watch(metaProvider);
    final textTheme = Theme.of(context).textTheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Gap.screen, 0, Gap.screen, Gap.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (issue.imageUrl != null) ...[
                  ClipRRect(
                    borderRadius: BorderRadius.circular(Radii.image),
                    child: SizedBox.square(dimension: 72, child: AppImage(PhotoSource.url(issue.imageUrl!))),
                  ),
                  Gap.w12,
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('${meta.category(issue.category).icon} ${meta.categoryLabel(issue.category)}',
                          style: textTheme.labelMedium),
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
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                StatusChip(issue.status, dense: true),
                Text('${issue.voteCount} ủng hộ · ${Fmt.relative(issue.createdAt)}', style: textTheme.bodySmall),
              ],
            ),
            Gap.h16,
            SizedBox(
              width: double.infinity,
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
      ),
    );
  }
}
