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
    this.attempts = 0,
    this.lastError,
    this.state = DraftState.pending,
    this.nextAttemptAt,
  });

  final String id;
  final ReportPayload payload;
  final DateTime createdAt;
  final int imageCount;
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
        attempts: attempts ?? this.attempts,
        lastError: lastError == _keep ? this.lastError : lastError as String?,
        state: state ?? this.state,
        nextAttemptAt: nextAttemptAt == _keep ? this.nextAttemptAt : nextAttemptAt as DateTime?,
      );

  static const _keep = Object();
}

abstract class DraftStore {
  Future<List<ReportDraft>> all();
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
