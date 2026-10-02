import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/app_exception.dart';
import '../../core/platform/connectivity.dart';
import '../../data/local/draft_store.dart';
import '../../data/models/issue.dart';
import '../../data/repositories/issue_repository.dart';
import '../auth/auth_controller.dart';

typedef SendReport = Future<Issue> Function(ReportPayload payload, List<UploadImage> images);

/// Kết quả một lượt đẩy hàng đợi.
class FlushResult {
  const FlushResult({
    this.sent = const [],
    this.stoppedBy,
    this.retryAt,
    this.skipped = false,
  });

  final List<Issue> sent;

  /// Lý do dừng giữa chừng (mất mạng, chạm rate limit…). `null` = chạy hết.
  final AppErrorKind? stoppedBy;
  final DateTime? retryAt;

  /// Đang có một lượt khác chạy — không làm gì.
  final bool skipped;
}

/// Logic thuần của hàng đợi offline — không phụ thuộc Flutter để test được
/// mọi nhánh (mất mạng, 429, 400, 5xx).
///
/// Quy tắc:
/// - **Gửi tuần tự**, không song song: `createIssueLimiter` chỉ cho
///   **20 phiếu/15 phút** (Phụ lục E.2); đẩy 30 phiếu một lượt là bị chặn
///   giữa chừng.
/// - Gặp **429 thì dừng và hẹn lại** theo `Retry-After` (mặc định 15 phút).
/// - Lỗi mạng/timeout/5xx: dừng, giữ nguyên phiếu, lượt sau thử lại.
/// - 400/403/404: server từ chối vĩnh viễn → đánh dấu "cần sửa", đi tiếp phiếu
///   sau (một phiếu hỏng không được chặn cả hàng).
/// - Chỉ một lượt chạy tại một thời điểm.
class OfflineQueueEngine {
  OfflineQueueEngine({required this.store, required this.send, DateTime Function()? clock})
      : _clock = clock ?? DateTime.now;

  final DraftStore store;
  final SendReport send;
  final DateTime Function() _clock;

  static const defaultRateLimitBackoff = Duration(minutes: 15);

  bool _running = false;
  bool get isRunning => _running;

  Future<ReportDraft> enqueue(
    ReportPayload payload,
    List<Uint8List> images, {
    String? lastError,
    DateTime? nextAttemptAt,
  }) async {
    final now = _clock();
    final draft = ReportDraft(
      id: '${now.microsecondsSinceEpoch}-${payload.title.hashCode.abs()}',
      payload: payload,
      createdAt: now,
      imageCount: images.length,
      lastError: lastError,
      nextAttemptAt: nextAttemptAt,
    );
    await store.save(draft, images: images);
    return draft;
  }

  Future<FlushResult> flush() async {
    if (_running) return const FlushResult(skipped: true);
    _running = true;
    final sent = <Issue>[];
    try {
      final drafts = await store.all();
      for (final draft in drafts) {
        if (draft.state == DraftState.needsAttention) continue;

        final now = _clock();
        if (draft.nextAttemptAt != null && now.isBefore(draft.nextAttemptAt!)) {
          // Rate limit theo IP/người dùng — phiếu sau cũng sẽ bị chặn.
          return FlushResult(
            sent: sent,
            stoppedBy: AppErrorKind.rateLimited,
            retryAt: draft.nextAttemptAt,
          );
        }

        try {
          final images = await store.images(draft.id);
          final issue = await send(
            draft.payload,
            [
              for (var i = 0; i < images.length; i++)
                UploadImage(images[i], filename: 'photo_${i + 1}.jpg'),
            ],
          );
          await store.remove(draft.id);
          sent.add(issue);
        } on AppException catch (e) {
          switch (e.kind) {
            case AppErrorKind.rateLimited:
              final retryAt = now.add(e.retryAfter ?? defaultRateLimitBackoff);
              await store.save(draft.copyWith(
                attempts: draft.attempts + 1,
                lastError: e.message,
                nextAttemptAt: retryAt,
              ));
              return FlushResult(sent: sent, stoppedBy: e.kind, retryAt: retryAt);
            case AppErrorKind.network:
            case AppErrorKind.timeout:
            case AppErrorKind.server:
            case AppErrorKind.unauthorized:
            case AppErrorKind.cancelled:
            case AppErrorKind.unknown:
              await store.save(draft.copyWith(attempts: draft.attempts + 1, lastError: e.message));
              return FlushResult(sent: sent, stoppedBy: e.kind);
            case AppErrorKind.badRequest:
            case AppErrorKind.forbidden:
            case AppErrorKind.notFound:
              await store.save(draft.copyWith(
                attempts: draft.attempts + 1,
                lastError: e.message,
                state: DraftState.needsAttention,
              ));
          }
        }
      }
      return FlushResult(sent: sent);
    } finally {
      _running = false;
    }
  }
}

class OfflineQueueState {
  const OfflineQueueState({
    this.drafts = const [],
    this.flushing = false,
    this.retryAt,
    this.lastSent = const [],
  });

  final List<ReportDraft> drafts;
  final bool flushing;
  final DateTime? retryAt;

  /// Phiếu vừa được tự gửi ở lượt gần nhất — shell báo cho người dân.
  final List<Issue> lastSent;

  int get count => drafts.length;
  int get needsAttention => drafts.where((d) => d.state == DraftState.needsAttention).length;

  OfflineQueueState copyWith({
    List<ReportDraft>? drafts,
    bool? flushing,
    Object? retryAt = _keep,
    List<Issue>? lastSent,
  }) =>
      OfflineQueueState(
        drafts: drafts ?? this.drafts,
        flushing: flushing ?? this.flushing,
        retryAt: retryAt == _keep ? this.retryAt : retryAt as DateTime?,
        lastSent: lastSent ?? this.lastSent,
      );

  static const _keep = Object();
}

/// Override trong `main()` bằng [HiveDraftStore.open].
final draftStoreProvider = Provider<DraftStore>((ref) => MemoryDraftStore());

/// Thử gửi lại khi: app mở lại (`resumed`), **mạng đổi** sang có, vừa thêm
/// phiếu, hoặc người dân bấm "Gửi ngay". Không phụ thuộc chạy nền — iOS chỉ
/// cho background job khi OS quyết định (kế hoạch 1.4 mục 5), nên cách này
/// chạy đúng trên cả hai nền tảng và không phải nói quá khi demo.
class OfflineQueueController extends Notifier<OfflineQueueState> {
  late OfflineQueueEngine _engine;
  Timer? _retryTimer;
  AppLifecycleListener? _lifecycle;

  @override
  OfflineQueueState build() {
    final repo = ref.watch(issueRepositoryProvider);
    _engine = OfflineQueueEngine(
      store: ref.watch(draftStoreProvider),
      send: (payload, images) => repo.create(payload, images),
    );

    ref.listen<bool>(isOnlineProvider, (prev, online) {
      if (online && prev == false) unawaited(flush());
    });
    ref.listen<AuthState>(authControllerProvider, (prev, next) {
      if (next is AuthSignedIn && prev is! AuthSignedIn) unawaited(flush());
    });

    _lifecycle = AppLifecycleListener(onResume: () => unawaited(flush()));
    ref.onDispose(() {
      _retryTimer?.cancel();
      _lifecycle?.dispose();
    });

    unawaited(_reload());
    return const OfflineQueueState();
  }

  Future<void> _reload() async {
    final drafts = await _engine.store.all();
    state = state.copyWith(drafts: drafts);
  }

  /// Lưu phiếu khi không gửi được. Có mạng thì thử gửi luôn.
  Future<ReportDraft> enqueue(
    ReportPayload payload,
    List<Uint8List> images, {
    String? reason,
    DateTime? nextAttemptAt,
  }) async {
    final draft = await _engine.enqueue(payload, images,
        lastError: reason, nextAttemptAt: nextAttemptAt);
    await _reload();
    if (nextAttemptAt != null) _scheduleRetry(nextAttemptAt);
    return draft;
  }

  Future<FlushResult> flush() async {
    if (ref.read(currentUserProvider) == null) return const FlushResult(skipped: true);
    if (_engine.isRunning) return const FlushResult(skipped: true);
    state = state.copyWith(flushing: true);
    try {
      final result = await _engine.flush();
      final drafts = await _engine.store.all();
      state = state.copyWith(
        drafts: drafts,
        flushing: false,
        retryAt: result.retryAt,
        lastSent: result.sent.isEmpty ? state.lastSent : result.sent,
      );
      if (result.retryAt != null) _scheduleRetry(result.retryAt!);
      return result;
    } catch (_) {
      state = state.copyWith(flushing: false);
      return const FlushResult(stoppedBy: AppErrorKind.unknown);
    }
  }

  void _scheduleRetry(DateTime at) {
    _retryTimer?.cancel();
    final delay = at.difference(DateTime.now());
    _retryTimer = Timer(delay.isNegative ? Duration.zero : delay, () => unawaited(flush()));
  }

  Future<List<Uint8List>> imagesOf(String id) => _engine.store.images(id);

  /// Sửa phiếu bị server từ chối rồi đưa lại vào hàng chờ.
  Future<void> update(ReportDraft draft, ReportPayload payload) async {
    await _engine.store.save(draft.copyWith(
      payload: payload,
      state: DraftState.pending,
      lastError: null,
    ));
    await _reload();
    unawaited(flush());
  }

  Future<void> remove(String id) async {
    await _engine.store.remove(id);
    await _reload();
  }

  void consumeLastSent() => state = state.copyWith(lastSent: const []);
}

final offlineQueueProvider =
    NotifierProvider<OfflineQueueController, OfflineQueueState>(OfflineQueueController.new);
