import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../core/network/app_exception.dart';
import '../../core/platform/connectivity.dart';
import '../../core/platform/location.dart';
import '../../core/utils/debouncer.dart';
import '../../data/models/issue.dart';
import '../../data/models/report_support.dart';
import '../../data/repositories/issue_repository.dart';
import '../../data/repositories/meta_repository.dart';
import '../../data/repositories/support_repositories.dart';
import '../auth/auth_controller.dart';
import 'offline_queue.dart';
import 'photo_tools.dart';

enum AiStatus { idle, loading, done, failed }

enum LookupStatus { idle, loading, done, failed }

/// Trạng thái wizard — **giữ ở controller**, không ở từng bước, để quay lại
/// không mất dữ liệu đã nhập (design system mục 8, `WizardStepper`).
class ReportState {
  const ReportState({
    this.step = 0,
    this.photos = const [],
    this.ai = AiStatus.idle,
    this.suggestion,
    this.category,
    this.title = '',
    this.description = '',
    this.phone = '',
    this.position,
    this.address = '',
    this.addressStatus = LookupStatus.idle,
    this.locationIssue,
    this.duplicates = DuplicateResult.empty,
    this.duplicateStatus = LookupStatus.idle,
    this.submitting = false,
    this.progress = 0,
    this.error,
    this.fieldErrors = const {},
  });

  final int step;
  final List<PickedPhoto> photos;
  final AiStatus ai;
  final AiSuggestion? suggestion;
  final String? category;
  final String title;
  final String description;
  final String phone;
  final LatLng? position;
  final String address;
  final LookupStatus addressStatus;

  /// Kết quả xin vị trí gần nhất nếu không thành công — để hiện đúng hướng dẫn.
  final LocationResult? locationIssue;
  final DuplicateResult duplicates;
  final LookupStatus duplicateStatus;
  final bool submitting;
  final double progress;
  final String? error;
  final Map<String, String> fieldErrors;

  ReportPayload toPayload() => ReportPayload(
        title: title.trim(),
        description: description.trim(),
        category: category ?? 'other',
        location: address.trim(),
        latitude: position?.latitude ?? 0,
        longitude: position?.longitude ?? 0,
        phone: phone.trim().isEmpty ? null : phone.trim(),
      );

  /// Đủ điều kiện để dò trùng: cùng ngưỡng với `duplicateCandidateValidator`.
  bool get canCheckDuplicates =>
      position != null &&
      category != null &&
      title.trim().length >= 3 &&
      description.trim().length >= 10;

  ReportState copyWith({
    int? step,
    List<PickedPhoto>? photos,
    AiStatus? ai,
    Object? suggestion = _keep,
    Object? category = _keep,
    String? title,
    String? description,
    String? phone,
    Object? position = _keep,
    String? address,
    LookupStatus? addressStatus,
    Object? locationIssue = _keep,
    DuplicateResult? duplicates,
    LookupStatus? duplicateStatus,
    bool? submitting,
    double? progress,
    Object? error = _keep,
    Map<String, String>? fieldErrors,
  }) =>
      ReportState(
        step: step ?? this.step,
        photos: photos ?? this.photos,
        ai: ai ?? this.ai,
        suggestion: suggestion == _keep ? this.suggestion : suggestion as AiSuggestion?,
        category: category == _keep ? this.category : category as String?,
        title: title ?? this.title,
        description: description ?? this.description,
        phone: phone ?? this.phone,
        position: position == _keep ? this.position : position as LatLng?,
        address: address ?? this.address,
        addressStatus: addressStatus ?? this.addressStatus,
        locationIssue:
            locationIssue == _keep ? this.locationIssue : locationIssue as LocationResult?,
        duplicates: duplicates ?? this.duplicates,
        duplicateStatus: duplicateStatus ?? this.duplicateStatus,
        submitting: submitting ?? this.submitting,
        progress: progress ?? this.progress,
        error: error == _keep ? this.error : error as String?,
        fieldErrors: fieldErrors ?? this.fieldErrors,
      );

  static const _keep = Object();
}

sealed class SubmitOutcome {
  const SubmitOutcome();
}

class SubmitSent extends SubmitOutcome {
  const SubmitSent(this.issue);

  final Issue issue;
}

/// Đã lưu vào hàng đợi — sẽ tự gửi khi có mạng (3.6).
class SubmitQueued extends SubmitOutcome {
  const SubmitQueued({required this.reason});

  final String reason;
}

class SubmitFailed extends SubmitOutcome {
  const SubmitFailed(this.message);

  final String message;
}

class ReportController extends AutoDisposeNotifier<ReportState> {
  static const stepCount = 4;

  /// Debounce 600ms + huỷ request cũ — port `ReportIssue/index.tsx` (task 3.5).
  final _duplicates = LatestRequest<DuplicateResult>(const Duration(milliseconds: 600));
  final _reverse = LatestRequest<String?>(const Duration(milliseconds: 500));

  /// Riverpod 2 không có `ref.mounted`: tự giữ cờ để không ghi state sau khi
  /// người dùng đã rời wizard (lời gọi mạng về muộn).
  bool _disposed = false;

  @override
  ReportState build() {
    _disposed = false;
    ref.onDispose(() {
      _disposed = true;
      _duplicates.cancel();
      _reverse.cancel();
    });
    // Có sẵn quyền vị trí thì lấy luôn ở nền — tới bước 3 đã có toạ độ, và
    // dò trùng chạy được ngay khi người dân đang gõ mô tả.
    unawaited(Future.microtask(() => locate(requestPermission: false)));
    return const ReportState();
  }

  // ── Điều hướng ──

  bool canLeaveStep(int step) => switch (step) {
        0 => true, // ảnh không bắt buộc ở backend
        1 => state.category != null &&
            state.title.trim().isNotEmpty &&
            state.description.trim().isNotEmpty,
        2 => state.position != null && state.address.trim().isNotEmpty,
        _ => true,
      };

  String? blockedHint(int step) => switch (step) {
        1 when state.category == null => 'Chọn loại sự cố để tiếp tục',
        1 when state.title.trim().isEmpty => 'Nhập tiêu đề để tiếp tục',
        1 when state.description.trim().isEmpty => 'Nhập mô tả để tiếp tục',
        2 when state.position == null => 'Chọn vị trí trên bản đồ hoặc dùng GPS',
        2 when state.address.trim().isEmpty => 'Nhập địa chỉ sự cố',
        _ => null,
      };

  void next() {
    if (!canLeaveStep(state.step) || state.step >= stepCount - 1) return;
    final nextStep = state.step + 1;
    state = state.copyWith(step: nextStep, error: null);
    if (nextStep == 1) unawaited(runAi());
    if (nextStep == stepCount - 1) checkDuplicates(immediate: true);
  }

  void back() {
    if (state.step > 0) state = state.copyWith(step: state.step - 1, error: null);
  }

  void goTo(int step) => state = state.copyWith(step: step.clamp(0, stepCount - 1));

  // ── Bước 1: ảnh ──

  /// Trả về thông báo cho người dùng (ảnh trùng, vượt trần, ảnh lỗi) hoặc null.
  Future<String?> addPhotos({required bool camera}) async {
    final meta = ref.read(metaProvider);
    final remaining = meta.limits.maxImages - state.photos.length;
    if (remaining <= 0) {
      return 'Chỉ được tối đa ${meta.limits.maxImages} ảnh cho mỗi báo cáo.';
    }
    final picker = PhotoPicker(maxBytes: meta.limits.maxImageBytes);
    try {
      final picked = await picker.pick(camera: camera, remaining: remaining);
      final merged = mergePhotos(state.photos, picked, maxImages: meta.limits.maxImages);
      final aiStale = merged.photos.isNotEmpty &&
          (state.photos.isEmpty || merged.photos.first.hash != state.photos.first.hash);
      state = state.copyWith(
        photos: merged.photos,
        ai: aiStale ? AiStatus.idle : state.ai,
      );
      final notes = [
        if (merged.duplicates > 0) '${merged.duplicates} ảnh trùng đã bị bỏ qua',
        if (merged.overflow > 0) 'Chỉ giữ tối đa ${meta.limits.maxImages} ảnh',
      ];
      return notes.isEmpty ? null : notes.join(' · ');
    } on PhotoRejected catch (e) {
      return e.message;
    } catch (_) {
      return camera
          ? 'Không mở được camera. Kiểm tra quyền truy cập camera trong Cài đặt.'
          : 'Không mở được thư viện ảnh.';
    }
  }

  void removePhoto(int index) {
    final photos = [...state.photos]..removeAt(index);
    state = state.copyWith(photos: photos, ai: index == 0 ? AiStatus.idle : state.ai);
  }

  // ── Bước 2: AI gợi ý ──

  /// AI chỉ GỢI Ý — lỗi hay timeout thì form vẫn dùng bình thường (task 3.2).
  Future<void> runAi() async {
    if (state.photos.isEmpty || state.ai == AiStatus.loading || state.ai == AiStatus.done) {
      return;
    }
    state = state.copyWith(ai: AiStatus.loading);
    try {
      final first = state.photos.first;
      final s = await ref.read(aiRepositoryProvider).classify(first.bytes);
      if (_disposed) return;
      if (!s.isUseful) {
        state = state.copyWith(ai: AiStatus.failed, suggestion: null);
        return;
      }
      final meta = ref.read(metaProvider);
      state = state.copyWith(
        ai: AiStatus.done,
        suggestion: s,
        // Không ghi đè thứ người dân đã tự nhập.
        category: state.category ?? s.category,
        description: state.description.trim().isEmpty ? s.description : state.description,
        title: state.title.trim().isEmpty ? meta.categoryLabel(s.category) : state.title,
      );
      scheduleDuplicateCheck();
    } catch (_) {
      if (!_disposed) state = state.copyWith(ai: AiStatus.failed);
    }
  }

  void setCategory(String value) {
    state = state.copyWith(category: value, fieldErrors: _without('category'));
    scheduleDuplicateCheck();
  }

  void setTitle(String value) {
    state = state.copyWith(title: value, fieldErrors: _without('title'));
    scheduleDuplicateCheck();
  }

  void setDescription(String value) {
    state = state.copyWith(description: value, fieldErrors: _without('description'));
    scheduleDuplicateCheck();
  }

  void setPhone(String value) => state = state.copyWith(phone: value, fieldErrors: _without('phone'));

  Map<String, String> _without(String field) =>
      state.fieldErrors.containsKey(field) ? ({...state.fieldErrors}..remove(field)) : state.fieldErrors;

  // ── Bước 3: vị trí ──

  Future<void> locate({bool requestPermission = true}) async {
    final service = ref.read(locationServiceProvider);
    final result = requestPermission ? await service.current() : await service.currentIfGranted();
    if (_disposed) return;
    if (result is LocationOk) {
      setPosition(result.position);
      state = state.copyWith(locationIssue: null);
    } else if (requestPermission) {
      state = state.copyWith(locationIssue: result);
    }
  }

  /// Kéo pin / chạm bản đồ → điền địa chỉ bằng reverse geocode qua proxy B3.
  void setPosition(LatLng p, {bool lookupAddress = true}) {
    state = state.copyWith(position: p, fieldErrors: _without('location'));
    scheduleDuplicateCheck();
    if (!lookupAddress) return;
    _reverse.run(
      (cancel) => ref.read(geoRepositoryProvider).reverse(p.latitude, p.longitude, cancel: cancel),
      onStart: () => state = state.copyWith(addressStatus: LookupStatus.loading),
      onResult: (address) => state = state.copyWith(
        address: address ?? state.address,
        addressStatus: address == null ? LookupStatus.failed : LookupStatus.done,
      ),
      onError: (_) => state = state.copyWith(addressStatus: LookupStatus.failed),
    );
  }

  void setAddress(String value) =>
      state = state.copyWith(address: value, fieldErrors: _without('location'));

  Future<void> choosePrediction(GeoPrediction p) async {
    state = state.copyWith(address: p.description, addressStatus: LookupStatus.loading);
    try {
      final place = await ref.read(geoRepositoryProvider).placeDetail(p.placeId);
      if (_disposed) return;
      state = state.copyWith(
        position: LatLng(place.lat, place.lng),
        address: place.address.isNotEmpty ? place.address : p.description,
        addressStatus: LookupStatus.done,
      );
      scheduleDuplicateCheck();
    } catch (_) {
      if (!_disposed) state = state.copyWith(addressStatus: LookupStatus.failed);
    }
  }

  // ── Dò trùng ──

  void scheduleDuplicateCheck() => checkDuplicates();

  void checkDuplicates({bool immediate = false}) {
    if (!state.canCheckDuplicates) return;
    final payload = state.toPayload();
    _duplicates.run(
      (cancel) => ref.read(issueRepositoryProvider).duplicateCandidates(payload, cancel: cancel),
      onStart: () => state = state.copyWith(duplicateStatus: LookupStatus.loading),
      onResult: (r) => state = state.copyWith(duplicates: r, duplicateStatus: LookupStatus.done),
      // Dò trùng lỗi KHÔNG chặn người dân gửi báo cáo (Giai đoạn 3).
      onError: (_) => state = state.copyWith(duplicateStatus: LookupStatus.failed),
    );
  }

  Future<bool> confirmDuplicate(String issueId) async {
    try {
      await ref.read(issueRepositoryProvider).confirmDuplicate(issueId);
      return true;
    } on AppException catch (e) {
      state = state.copyWith(error: e.message);
      return false;
    }
  }

  // ── Bước 4: gửi ──

  Future<SubmitOutcome> submit() async {
    if (state.submitting) return const SubmitFailed('Đang gửi…');
    for (var s = 0; s < stepCount - 1; s++) {
      if (!canLeaveStep(s)) {
        state = state.copyWith(step: s, error: blockedHint(s));
        return SubmitFailed(blockedHint(s) ?? 'Thiếu thông tin');
      }
    }

    // Phiếu chờ gắn với tài khoản đang đăng nhập (chủ phiếu). Wizard nằm sau
    // route guard nên chỉ rơi vào đây nếu phiên vừa hết hạn giữa chừng.
    if (ref.read(currentUserProvider) == null) {
      return const SubmitFailed('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    final payload = state.toPayload();
    final images = [for (var i = 0; i < state.photos.length; i++) state.photos[i].toUpload(i)];
    final queue = ref.read(offlineQueueProvider.notifier);

    if (!ref.read(isOnlineProvider)) {
      await queue.enqueue(payload, [for (final p in state.photos) p.bytes],
          reason: 'Gửi khi đang ngoại tuyến');
      return const SubmitQueued(reason: 'Bạn đang ngoại tuyến.');
    }

    state = state.copyWith(submitting: true, progress: 0, error: null, fieldErrors: const {});
    try {
      final issue = await ref.read(issueRepositoryProvider).create(
        payload,
        images,
        onProgress: (sent, total) {
          if (total > 0 && !_disposed) state = state.copyWith(progress: sent / total);
        },
      );
      if (!_disposed) state = state.copyWith(submitting: false, progress: 1);
      return SubmitSent(issue);
    } on AppException catch (e) {
      if (_disposed) return SubmitFailed(e.message);
      state = state.copyWith(submitting: false);
      if (e.isTransient) {
        // Mạng yếu giữa chừng: backend đã rollback ảnh, phiếu vào hàng đợi.
        await queue.enqueue(
          payload,
          [for (final p in state.photos) p.bytes],
          reason: e.message,
          nextAttemptAt: e.kind == AppErrorKind.rateLimited
              ? DateTime.now().add(e.retryAfter ?? OfflineQueueEngine.defaultRateLimitBackoff)
              : null,
        );
        return SubmitQueued(
          reason: e.kind == AppErrorKind.rateLimited
              ? 'Bạn đã gửi nhiều báo cáo trong thời gian ngắn.'
              : 'Kết nối bị gián đoạn khi đang gửi.',
        );
      }
      final fields = {for (final f in e.fieldErrors) f.field: f.message};
      final step = _stepOfField(fields.keys);
      state = state.copyWith(error: e.message, fieldErrors: fields, step: step ?? state.step);
      return SubmitFailed(e.message);
    }
  }

  int? _stepOfField(Iterable<String> fields) {
    for (final f in fields) {
      if (['title', 'description', 'category', 'phone'].contains(f)) return 1;
      if (['location', 'latitude', 'longitude'].contains(f)) return 2;
      if (f == 'images') return 0;
    }
    return null;
  }
}

final reportControllerProvider =
    AutoDisposeNotifierProvider<ReportController, ReportState>(ReportController.new);
