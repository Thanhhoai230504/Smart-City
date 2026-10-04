import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/app_exception.dart';
import '../../core/platform/location.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/debouncer.dart';
import '../../core/widgets/surfaces.dart';
import '../../data/models/report_support.dart';
import '../../data/repositories/support_repositories.dart';

/// Một đầu của tuyến đường: "Vị trí của tôi" (lấy GPS lúc tìm đường) hoặc một
/// địa điểm đã chọn.
class RouteEndpoint {
  const RouteEndpoint(this.label, this.lat, this.lng) : isMe = false;

  const RouteEndpoint.me()
      : label = 'Vị trí của tôi',
        lat = null,
        lng = null,
        isMe = true;

  final String label;
  final double? lat;
  final double? lng;
  final bool isMe;
}

enum _Field { from, to }

/// Màn chọn điểm đi/đến (web: panel "Chỉ đường" của trang Bản đồ). Trả về cặp
/// (đi, đến) cho bản đồ tự gọi `/geo/route` và vẽ tuyến.
class RoutePlannerPage extends ConsumerStatefulWidget {
  const RoutePlannerPage({super.key, this.initialTo});

  final RouteEndpoint? initialTo;

  static Future<(RouteEndpoint, RouteEndpoint)?> open(BuildContext context, {RouteEndpoint? to}) =>
      Navigator.of(context, rootNavigator: true).push<(RouteEndpoint, RouteEndpoint)>(
        MaterialPageRoute(builder: (_) => RoutePlannerPage(initialTo: to), fullscreenDialog: true),
      );

  @override
  ConsumerState<RoutePlannerPage> createState() => _RoutePlannerPageState();
}

class _RoutePlannerPageState extends ConsumerState<RoutePlannerPage> {
  RouteEndpoint _from = const RouteEndpoint.me();
  late RouteEndpoint? _to = widget.initialTo;
  late _Field? _active = widget.initialTo == null ? _Field.to : null;
  final _query = TextEditingController();
  final _latest = LatestRequest<List<GeoPrediction>>(const Duration(milliseconds: 350));
  List<GeoPrediction> _results = const [];
  bool _searching = false;
  bool _resolving = false;
  String? _error;

  @override
  void dispose() {
    _latest.cancel();
    _query.dispose();
    super.dispose();
  }

  void _edit(_Field field) => setState(() {
        _active = field;
        _query.clear();
        _results = const [];
        _error = null;
      });

  void _search(String text) {
    if (text.trim().length < 2) {
      _latest.cancel();
      setState(() {
        _results = const [];
        _searching = false;
      });
      return;
    }
    _latest.run(
      (cancel) => ref.read(geoRepositoryProvider).autocomplete(
            text.trim(),
            lat: kDaNangCenter.latitude,
            lng: kDaNangCenter.longitude,
            cancel: cancel,
          ),
      onStart: () => setState(() => _searching = true),
      onResult: (r) => setState(() {
        _results = r;
        _searching = false;
        _error = null;
      }),
      onError: (e) => setState(() {
        _searching = false;
        _error = AppException.from(e).message;
      }),
    );
  }

  void _set(RouteEndpoint endpoint) => setState(() {
        if (_active == _Field.from) {
          _from = endpoint;
        } else {
          _to = endpoint;
        }
        _active = null;
        _results = const [];
      });

  Future<void> _pick(GeoPrediction p) async {
    setState(() => _resolving = true);
    try {
      final place = await ref.read(geoRepositoryProvider).placeDetail(p.placeId);
      _set(RouteEndpoint(p.mainText ?? p.description, place.lat, place.lng));
    } on AppException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _resolving = false);
    }
  }

  void _swap() {
    final to = _to;
    if (to == null) return;
    setState(() {
      _to = _from;
      _from = to;
    });
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;

    Widget endpointRow(_Field field, IconData icon, Color color, String label, String value, {bool placeholder = false}) =>
        InkWell(
          borderRadius: BorderRadius.circular(Radii.tile),
          onTap: () => _edit(field),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: Gap.sm, horizontal: Gap.xs),
            child: Row(
              children: [
                Icon(icon, color: color),
                Gap.w12,
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label, style: textTheme.labelSmall?.copyWith(color: palette.textSecondary)),
                      Text(
                        value,
                        style: textTheme.titleSmall?.copyWith(
                          color: placeholder ? palette.textSecondary : null,
                          fontWeight: _active == field ? FontWeight.w700 : null,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (_active == field) Icon(Icons.edit, size: 18, color: palette.primary),
              ],
            ),
          ),
        );

    return Scaffold(
      appBar: AppBar(title: const Text('Chỉ đường')),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.screen, 0),
            child: AppCard(
              padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: Gap.xs),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      children: [
                        endpointRow(_Field.from, Icons.trip_origin, palette.success.text, 'Từ', _from.label),
                        const Divider(),
                        endpointRow(
                          _Field.to,
                          Icons.place,
                          palette.error,
                          'Đến',
                          _to?.label ?? 'Chọn điểm đến',
                          placeholder: _to == null,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Đổi chiều',
                    onPressed: _to == null ? null : _swap,
                    icon: const Icon(Icons.swap_vert),
                  ),
                ],
              ),
            ),
          ),
          if (_active != null) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.md, Gap.screen, 0),
              child: TextField(
                controller: _query,
                autofocus: true,
                textInputAction: TextInputAction.search,
                onChanged: _search,
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search),
                  hintText: _active == _Field.from ? 'Tìm điểm xuất phát…' : 'Tìm điểm đến…',
                  suffixIcon: _searching || _resolving
                      ? const Padding(
                          padding: EdgeInsets.all(14),
                          child: SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                        )
                      : null,
                ),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.screen, 0),
                child: Text(_error!, style: textTheme.bodySmall?.copyWith(color: palette.error)),
              ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: Gap.sm, vertical: Gap.sm),
                children: [
                  ListTile(
                    leading: IconBubble(
                      icon: Icons.my_location,
                      ink: palette.primary,
                      container: Theme.of(context).colorScheme.primaryContainer,
                      size: 40,
                    ),
                    title: const Text('Vị trí của tôi'),
                    subtitle: const Text('Lấy từ GPS khi tìm đường'),
                    onTap: () => _set(const RouteEndpoint.me()),
                  ),
                  for (final p in _results)
                    ListTile(
                      leading: const Icon(Icons.place_outlined),
                      title: Text(p.mainText ?? p.description, maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: p.secondaryText == null
                          ? null
                          : Text(p.secondaryText!, maxLines: 2, overflow: TextOverflow.ellipsis),
                      onTap: _resolving ? null : () => _pick(p),
                    ),
                ],
              ),
            ),
          ] else
            const Spacer(),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(Gap.screen),
              child: FilledButton.icon(
                onPressed: _to == null ? null : () => Navigator.pop(context, (_from, _to!)),
                icon: const Icon(Icons.directions),
                label: const Text('Tìm đường'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
