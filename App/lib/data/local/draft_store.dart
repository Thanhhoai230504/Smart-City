import 'dart:typed_data';

import 'package:hive_ce/hive.dart';

import '../../core/utils/json.dart';
import '../repositories/issue_repository.dart';

enum DraftState {
  /// Chờ mạng / chờ hết hạn rate limit — sẽ tự gửi.
  pending,

  /// Server từ chối vĩnh viễn (400/403/404) — người dân phải sửa rồi gửi lại.
  needsAttention,
}

/// Phiếu báo cáo chưa gửi được, lưu trên máy.
///
/// Ảnh tách khỏi metadata: danh sách phiếu chờ (badge, banner, màn hình) chỉ
/// đọc metadata nhẹ, ảnh chỉ nạp lúc gửi hoặc lúc xem chi tiết.
class ReportDraft {
  const ReportDraft({
    required this.id,
    required this.payload,
    required this.createdAt,
    required this.imageCount,
    this.ownerId,
    this.attempts = 0,
    this.lastError,
    this.state = DraftState.pending,
    this.nextAttemptAt,
  });

  final String id;
  final ReportPayload payload;
  final DateTime createdAt;
  final int imageCount;

  /// Id tài khoản đã soạn phiếu. Chỉ **chủ phiếu** mới thấy phiếu, được đếm trên
  /// badge/banner và được gửi phiếu: máy dùng chung (người nhà, máy demo đổi qua
  /// lại người dân ↔ cán bộ) không được gửi ảnh, vị trí, SĐT của người này dưới
  /// tên người kia. `null` = phiếu lưu từ trước khi có trường này — xử lý một lần
  /// lúc mở app (`OfflineQueueEngine.settleLegacy`).
  final String? ownerId;
  final int attempts;
  final String? lastError;
  final DraftState state;

  /// Sau 429 (`createIssueLimiter` 20 phiếu/15 phút) — chưa tới giờ thì không gửi.
  final DateTime? nextAttemptAt;

  JsonMap toJson() => {
        'id': id,
        'payload': payload.toJson(),
        'createdAt': createdAt.toUtc().toIso8601String(),
        'imageCount': imageCount,
        'ownerId': ownerId,
        'attempts': attempts,
        'lastError': lastError,
        'state': state.name,
        'nextAttemptAt': nextAttemptAt?.toUtc().toIso8601String(),
      };

  factory ReportDraft.fromJson(Object? value) {
    final m = asMap(value);
    return ReportDraft(
      id: asStringOr(m['id']),
      payload: ReportPayload.fromJson(m['payload']),
      createdAt: asDate(m['createdAt']) ?? DateTime.now(),
      imageCount: asInt(m['imageCount']) ?? 0,
      // Bản ghi cũ không có khoá này → null (phiếu chưa có chủ).
      ownerId: asString(m['ownerId']),
      attempts: asInt(m['attempts']) ?? 0,
      lastError: asString(m['lastError']),
      state: m['state'] == DraftState.needsAttention.name
          ? DraftState.needsAttention
          : DraftState.pending,
      nextAttemptAt: asDate(m['nextAttemptAt']),
    );
  }

  ReportDraft copyWith({
    ReportPayload? payload,
    String? ownerId,
    int? attempts,
    Object? lastError = _keep,
    DraftState? state,
    Object? nextAttemptAt = _keep,
  }) =>
      ReportDraft(
        id: id,
        payload: payload ?? this.payload,
        createdAt: createdAt,
        imageCount: imageCount,
        ownerId: ownerId ?? this.ownerId,
        attempts: attempts ?? this.attempts,
        lastError: lastError == _keep ? this.lastError : lastError as String?,
        state: state ?? this.state,
        nextAttemptAt: nextAttemptAt == _keep ? this.nextAttemptAt : nextAttemptAt as DateTime?,
      );

  static const _keep = Object();
}

abstract class DraftStore {
  Future<List<ReportDraft>> all();

  /// Phiếu còn trong kho không — một lượt gửi chạy trên ảnh chụp danh sách lúc
  /// bắt đầu, nên trước mỗi phiếu phải hỏi lại (người dùng vừa xoá tay, hay xoá
  /// tài khoản giữa chừng thì phiếu đó KHÔNG được gửi).
  Future<bool> contains(String id);
  Future<void> save(ReportDraft draft, {List<Uint8List>? images});
  Future<List<Uint8List>> images(String id);
  Future<void> remove(String id);
}

/// Hive — chạy được trên Android, iOS và web (IndexedDB).
class HiveDraftStore implements DraftStore {
  HiveDraftStore._(this._meta, this._images);

  static const _metaBox = 'report_drafts_v1';
  static const _imageBox = 'report_draft_images_v1';

  final Box<Map<dynamic, dynamic>> _meta;
  final LazyBox<List<dynamic>> _images;

  static Future<HiveDraftStore> open() async {
    final meta = await Hive.openBox<Map<dynamic, dynamic>>(_metaBox);
    final images = await Hive.openLazyBox<List<dynamic>>(_imageBox);
    return HiveDraftStore._(meta, images);
  }

  @override
  Future<List<ReportDraft>> all() async {
    final drafts = [for (final raw in _meta.values) ReportDraft.fromJson(raw)];
    drafts.sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return drafts;
  }

  @override
  Future<bool> contains(String id) async => _meta.containsKey(id);

  @override
  Future<void> save(ReportDraft draft, {List<Uint8List>? images}) async {
    if (images != null) await _images.put(draft.id, images);
    await _meta.put(draft.id, draft.toJson());
  }

  @override
  Future<List<Uint8List>> images(String id) async {
    final raw = await _images.get(id);
    return [
      for (final item in raw ?? const <dynamic>[])
        if (item is Uint8List) item else if (item is List<int>) Uint8List.fromList(item),
    ];
  }

  @override
  Future<void> remove(String id) async {
    await _meta.delete(id);
    await _images.delete(id);
  }
}

/// Bản trong bộ nhớ cho test.
class MemoryDraftStore implements DraftStore {
  final Map<String, ReportDraft> drafts = {};
  final Map<String, List<Uint8List>> imageData = {};

  @override
  Future<List<ReportDraft>> all() async =>
      drafts.values.toList()..sort((a, b) => a.createdAt.compareTo(b.createdAt));

  @override
  Future<bool> contains(String id) async => drafts.containsKey(id);

  @override
  Future<void> save(ReportDraft draft, {List<Uint8List>? images}) async {
    drafts[draft.id] = draft;
    if (images != null) imageData[draft.id] = images;
  }

  @override
  Future<List<Uint8List>> images(String id) async => imageData[id] ?? const [];

  @override
  Future<void> remove(String id) async {
    drafts.remove(id);
    imageData.remove(id);
  }
}
