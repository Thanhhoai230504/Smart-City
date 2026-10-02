import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/platform/location.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/debouncer.dart';
import '../../../core/widgets/app_map.dart';
import '../../../data/models/report_support.dart';
import '../../../data/repositories/support_repositories.dart';
import '../report_controller.dart';

/// Bước 3 — vị trí (task 3.3): GPS với đủ nhánh quyền, kéo bản đồ dưới ghim
/// cố định, tìm địa chỉ qua proxy B3, và luôn cho nhập tay.
class LocationStep extends ConsumerStatefulWidget {
  const LocationStep({super.key});

  @override
  ConsumerState<LocationStep> createState() => _LocationStepState();
}

class _LocationStepState extends ConsumerState<LocationStep> {
  final _map = MapController();
  final _search = TextEditingController();
  late final TextEditingController _address;
  final _commit = Debouncer(const Duration(milliseconds: 450));
  final _autocomplete = LatestRequest<List<GeoPrediction>>(const Duration(milliseconds: 400));
  List<GeoPrediction> _predictions = const [];
  bool _searching = false;
  bool _mapReady = false;

  @override
  void initState() {
    super.initState();
    _address = TextEditingController(text: ref.read(reportControllerProvider).address);
  }

  @override
  void dispose() {
    _commit.cancel();
    _autocomplete.cancel();
    _search.dispose();
    _address.dispose();
    _map.dispose();
    super.dispose();
  }

  void _onSearchChanged(String text) {
    if (text.trim().length < 2) {
      _autocomplete.cancel();
      setState(() {
        _predictions = const [];
        _searching = false;
      });
      return;
    }
    final center = ref.read(reportControllerProvider).position ?? kDaNangCenter;
    _autocomplete.run(
      (cancel) => ref.read(geoRepositoryProvider).autocomplete(
            text.trim(),
            lat: center.latitude,
            lng: center.longitude,
            cancel: cancel,
          ),
      onStart: () => setState(() => _searching = true),
      onResult: (r) {
        if (!mounted) return;
        setState(() {
          _predictions = r;
          _searching = false;
        });
      },
      onError: (_) {
        if (mounted) setState(() => _searching = false);
      },
    );
  }

  Future<void> _choose(GeoPrediction p) async {
    FocusScope.of(context).unfocus();
    setState(() => _predictions = const []);
    _search.text = p.mainText ?? p.description;
    await ref.read(reportControllerProvider.notifier).choosePrediction(p);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(reportControllerProvider);
    final controller = ref.read(reportControllerProvider.notifier);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;

    // Vị trí đổi từ GPS / gợi ý địa chỉ → đưa bản đồ tới đó.
    ref.listen(reportControllerProvider.select((s) => s.position), (prev, next) {
      if (next != null && _mapReady && prev != next) {
        final center = _map.camera.center;
        if ((center.latitude - next.latitude).abs() > 1e-6 ||
            (center.longitude - next.longitude).abs() > 1e-6) {
          _map.move(next, _map.camera.zoom < 15 ? 17 : _map.camera.zoom);
        }
      }
    });
    ref.listen(reportControllerProvider.select((s) => s.address), (_, next) {
      if (_address.text != next) _address.text = next;
    });

    return ListView(
      padding: const EdgeInsets.all(Gap.screen),
      children: [
        TextField(
          controller: _search,
          onChanged: _onSearchChanged,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            prefixIcon: const Icon(Icons.search),
            hintText: 'Tìm địa chỉ, tên đường…',
            suffixIcon: _searching
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                  )
                : null,
          ),
        ),
        if (_predictions.isNotEmpty)
          Card(
            margin: const EdgeInsets.only(top: Gap.xs),
            child: Column(
              children: [
                for (final p in _predictions)
                  ListTile(
                    leading: const Icon(Icons.place_outlined),
                    title: Text(p.mainText ?? p.description, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: p.secondaryText == null
                        ? null
                        : Text(p.secondaryText!, maxLines: 1, overflow: TextOverflow.ellipsis),
                    onTap: () => _choose(p),
                  ),
              ],
            ),
          ),
        Gap.h12,
        ClipRRect(
          borderRadius: BorderRadius.circular(Radii.card),
          child: SizedBox(
            height: 300,
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _map,
                  options: MapOptions(
                    initialCenter: state.position ?? kDaNangCenter,
                    initialZoom: state.position == null ? 13 : 17,
                    onMapReady: () => _mapReady = true,
                    onPositionChanged: (camera, hasGesture) {
                      // Chỉ thao tác của người dùng mới đổi vị trí — tránh vòng
                      // lặp khi app tự di chuyển bản đồ.
                      if (!hasGesture) return;
                      _commit(() => controller.setPosition(camera.center));
                    },
                    onTap: (_, point) {
                      _map.move(point, _map.camera.zoom);
                      controller.setPosition(point);
                    },
                  ),
                  children: [baseTileLayer(), mapAttribution()],
                ),
                // Ghim cố định giữa bản đồ: kéo bản đồ để chọn điểm.
                IgnorePointer(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 36),
                      child: Icon(Icons.location_on, size: 44, color: palette.error),
                    ),
                  ),
                ),
                Positioned(
                  right: Gap.sm,
                  bottom: Gap.xl,
                  child: FloatingActionButton.small(
                    heroTag: 'locate',
                    tooltip: 'Dùng vị trí hiện tại',
                    onPressed: () => controller.locate(),
                    child: const Icon(Icons.my_location),
                  ),
                ),
              ],
            ),
          ),
        ),
        Gap.h8,
        Text(
          'Kéo bản đồ để ghim đúng vị trí sự cố, hoặc chạm vào điểm trên bản đồ.',
          style: textTheme.bodySmall,
        ),
        if (state.locationIssue != null) ...[
          Gap.h12,
          _LocationIssueCard(result: state.locationIssue!, onRetry: () => controller.locate()),
        ],
        Gap.h16,
        TextField(
          controller: _address,
          onChanged: controller.setAddress,
          minLines: 1,
          maxLines: 3,
          decoration: InputDecoration(
            labelText: 'Địa chỉ *',
            hintText: 'Số nhà, tên đường, phường…',
            errorText: state.fieldErrors['location'],
            helperText: switch (state.addressStatus) {
              LookupStatus.loading => 'Đang tìm địa chỉ…',
              LookupStatus.failed => 'Không tìm được địa chỉ tự động — bạn hãy nhập tay.',
              _ => null,
            },
            prefixIcon: const Icon(Icons.edit_location_alt_outlined),
          ),
        ),
        if (state.position != null) ...[
          Gap.h8,
          Text(
            'Toạ độ: ${state.position!.latitude.toStringAsFixed(5)}, '
            '${state.position!.longitude.toStringAsFixed(5)}',
            style: textTheme.bodySmall,
          ),
        ],
      ],
    );
  }
}

class _LocationIssueCard extends ConsumerWidget {
  const _LocationIssueCard({required this.result, required this.onRetry});

  final LocationResult result;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final service = ref.read(locationServiceProvider);
    final colors = context.palette.offline;
    final textTheme = Theme.of(context).textTheme;

    final (String message, String? action, VoidCallback? onAction) = switch (result) {
      LocationServiceOff() => (
          'GPS đang tắt. Bật định vị để lấy vị trí chính xác, hoặc kéo bản đồ.',
          'Bật định vị',
          () => service.openLocationSettings(),
        ),
      LocationDenied() => (
          'Bạn chưa cho phép truy cập vị trí. Có thể kéo bản đồ hoặc nhập địa chỉ.',
          'Cho phép lại',
          onRetry,
        ),
      LocationDeniedForever() => (
          'Quyền vị trí đã bị từ chối. Mở Cài đặt để cấp lại, hoặc chọn trên bản đồ.',
          'Mở Cài đặt',
          () => service.openAppSettings(),
        ),
      LocationFailed(:final message) => (message, 'Thử lại', onRetry),
      LocationOk() => ('', null, null),
    };

    return Container(
      padding: const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(
        color: colors.container,
        borderRadius: BorderRadius.circular(Radii.card),
      ),
      child: Row(
        children: [
          Icon(Icons.location_disabled, color: colors.text),
          Gap.w12,
          Expanded(child: Text(message, style: textTheme.bodySmall?.copyWith(color: colors.text))),
          if (action != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(foregroundColor: colors.text),
              child: Text(action),
            ),
        ],
      ),
    );
  }
}
