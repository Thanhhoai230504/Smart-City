import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/network/app_exception.dart';
import '../../core/platform/connectivity.dart';
import '../../data/local/draft_store.dart';
import '../../data/models/issue.dart';
import '../../data/repositories/auth_repository.dart';
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
/// - Phiếu thuộc về **tài khoản đã soạn** ([ReportDraft.ownerId]): chỉ liệt kê và
///   gửi phiếu của người đang đăng nhập.
class OfflineQueueEngine {
  OfflineQueueEngine({
    required this.store,
    required this.send,
    required this.currentOwner,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final DraftStore store;
  final SendReport send;

  /// Id tài khoản đang đăng nhập, `null` khi là khách. Hỏi lại ở mỗi phiếu
  /// trong một lượt gửi, không chỉ lúc bắt đầu.
  final String? Function() currentOwner;
  final DateTime Function() _clock;

  static const defaultRateLimitBackoff = Duration(minutes: 15);

  bool _running = false;
  bool get isRunning => _running;

  /// Lưu phiếu cho tài khoản đang đăng nhập. Wizard báo cáo nằm sau route
  /// guard (và `ReportController.submit` tự kiểm tra trước), nên không có ai
  /// đăng nhập ở đây là lỗi lập trình — không được lưu một phiếu vô chủ.
  Future<ReportDraft> enqueue(
    ReportPayload payload,
    List<Uint8List> images, {
    String? lastError,
    DateTime? nextAttemptAt,
  }) async {
    final owner = currentOwner();
    if (owner == null) throw StateError('Chỉ lưu được phiếu chờ khi đã đăng nhập.');
    final now = _clock();
    final draft = ReportDraft(
      id: '${now.microsecondsSinceEpoch}-${payload.title.hashCode.abs()}',
      payload: payload,
      createdAt: now,
      imageCount: images.length,
      ownerId: owner,
      lastError: lastError,
      nextAttemptAt: nextAttemptAt,
    );
    await store.save(draft, images: images);
    return draft;
  }

  /// Phiếu chờ của tài khoản đang đăng nhập (khách: rỗng) — thứ duy nhất màn
  /// hình, badge và banner được thấy.
  Future<List<ReportDraft>> pending() async {
    final owner = currentOwner();
    return owner == null ? const [] : _draftsOf(owner);
  }

  Future<List<ReportDraft>> _draftsOf(String owner) async =>
      [for (final d in await store.all()) if (d.ownerId == owner) d];

  Future<FlushResult> flush() async {
    final owner = currentOwner();
    if (owner == null || _running) return const FlushResult(skipped: true);
    _running = true;
    final sent = <Issue>[];
    try {
      final drafts = await _draftsOf(owner);
      for (final draft in drafts) {
        // Đổi tài khoản giữa lượt (đăng xuất → người khác đăng nhập): dừng ngay,
        // phần còn lại không được đi bằng phiên của người mới.
        if (currentOwner() != owner) return FlushResult(sent: sent, stoppedBy: AppErrorKind.cancelled);
        if (!await store.contains(draft.id)) continue;
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
              await _saveIfQueued(draft.copyWith(
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
              await _saveIfQueued(draft.copyWith(attempts: draft.attempts + 1, lastError: e.message));
              return FlushResult(sent: sent, stoppedBy: e.kind);
            case AppErrorKind.badRequest:
            case AppErrorKind.forbidden:
            case AppErrorKind.notFound:
              await _saveIfQueued(draft.copyWith(
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

  /// Ghi lại số lần thử / lỗi — trừ khi phiếu đã bị xoá trong lúc đang gửi:
  /// ghi lại lúc đó là dựng lại một phiếu người dùng vừa xoá (mất ảnh, còn nội dung).
  Future<void> _saveIfQueued(ReportDraft draft) async {
    if (await store.contains(draft.id)) await store.save(draft);
  }

  /// Xoá mọi phiếu (kèm ảnh) của [ownerId] — khi tài khoản bị xoá. Trả số phiếu đã xoá.
  Future<int> purgeOwner(String ownerId) async {
    final mine = [for (final d in await store.all()) if (d.ownerId == ownerId) d];
    for (final d in mine) {
      await store.remove(d.id);
    }
    return mine.length;
  }

  /// Phiếu chưa có chủ — lưu từ trước khi phiếu mang [ReportDraft.ownerId]. Gọi
  /// MỘT lần, khi vừa biết kết quả khôi phục phiên lúc mở app:
  /// - [adoptTo] là tài khoản được khôi phục → giao phiếu cho tài khoản đó: đó là
  ///   tài khoản đang đăng nhập khi app đóng lại, tức (gần như luôn) người đã
  ///   soạn chúng — bản cũ gửi phiếu chờ ngay khi có người đăng nhập, nên phiếu
  ///   còn sót lại hầu như chỉ thuộc về phiên cuối cùng;
  /// - [adoptTo] null (mở app ở trạng thái khách) → **xoá** kèm ảnh: không còn cách
  ///   biết chủ, và gửi dưới tên người đăng nhập kế tiếp là gửi nhầm người.
  /// Mất phiếu ở nhánh xoá (hay giao nhầm trong trường hợp hiếm) là chấp nhận
  /// được vì app chưa phát hành — phiếu vô chủ chỉ có trên máy thử nghiệm.
  Future<int> settleLegacy(String? adoptTo) async {
    final legacy = [for (final d in await store.all()) if (d.ownerId == null) d];
    for (final d in legacy) {
      if (adoptTo == null) {
        await store.remove(d.id);
      } else {
        await store.save(d.copyWith(ownerId: adoptTo)); // không truyền ảnh → giữ nguyên ảnh đã lưu
      }
    }
    return legacy.length;
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

  /// Phiếu vô chủ của bản cũ đã được xử lý chưa ([OfflineQueueEngine.settleLegacy]).
  bool _legacySettled = false;

  @override
  OfflineQueueState build() {
    final repo = ref.watch(issueRepositoryProvider);
    _engine = OfflineQueueEngine(
      store: ref.watch(draftStoreProvider),
      currentOwner: _owner,
      send: (payload, images) async {
        await _ensureAccessToken();
        return repo.create(payload, images);
      },
    );

    ref.listen<bool>(isOnlineProvider, (prev, online) {
      if (online && prev == false) unawaited(flush());
    });
    // `main()` dựng controller này TRƯỚC bước khôi phục phiên, nên luôn thấy lần
    // chuyển đầu tiên AuthUnknown → đăng nhập / khách.
    ref.listen<AuthState>(authControllerProvider, (prev, next) => unawaited(_onAuthChanged(prev, next)));

    _lifecycle = AppLifecycleListener(onResume: () => unawaited(flush()));
    ref.onDispose(() {
      _retryTimer?.cancel();
      _lifecycle?.dispose();
    });

    unawaited(_reload());
    return const OfflineQueueState();
  }

  /// Hàng đợi đi theo tài khoản đang đăng nhập, theo thứ tự: (1) lần đầu biết
  /// kết quả khôi phục phiên → xử lý phiếu vô chủ của bản cũ; (2) đổi người
  /// (đăng nhập, đăng xuất, đổi tài khoản) → nạp lại danh sách của chủ mới, khách
  /// thấy rỗng — phiếu vẫn nằm trên máy chờ chủ đăng nhập lại; (3) vừa đăng nhập
  /// → gửi phiếu của chính người đó.
  Future<void> _onAuthChanged(AuthState? prev, AuthState next) async {
    if (next is AuthUnknown) return;
    if (!_legacySettled) {
      _legacySettled = true;
      await _engine.settleLegacy(_ownerOf(next));
    }
    if (prev is AuthUnknown || _ownerOf(prev) != _ownerOf(next)) await _reload();
    if (next is AuthSignedIn && prev is! AuthSignedIn) await flush();
  }

  static String? _ownerOf(AuthState? s) => s is AuthSignedIn ? s.user.id : null;

  /// Chủ phiếu = tài khoản đang đăng nhập, đọc THẲNG từ trạng thái đăng nhập chứ
  /// không qua `currentUserProvider`: Riverpod gọi các `ref.listen` trước rồi mới
  /// đánh dấu provider dẫn xuất cần tính lại, nên đọc `currentUserProvider` ngay
  /// trong listener đổi tài khoản là đọc phải người CŨ (trước đây đăng nhập lại
  /// sau khi đăng xuất thì lượt tự gửi bị bỏ qua vì đọc thấy "chưa ai đăng nhập").
  String? _owner() => _ownerOf(ref.read(authControllerProvider));

  /// Phiếu của chủ hiện tại; `null` nếu tài khoản đổi trong lúc đang đọc kho —
  /// bỏ kết quả đó (lượt nạp của chủ mới tự ghi), để danh sách của người trước
  /// không lọt sang màn hình của người sau.
  Future<List<ReportDraft>?> _currentDrafts() async {
    final owner = _engine.currentOwner();
    final drafts = await _engine.pending();
    return _engine.currentOwner() == owner ? drafts : null;
  }

  Future<void> _reload() async {
    final drafts = await _currentDrafts();
    if (drafts != null) state = state.copyWith(drafts: drafts);
  }

  /// Mở app: hồ sơ cache đưa người dùng vào trạng thái đăng nhập ngay, nhưng
  /// access token chỉ nằm trong RAM — chưa có cho tới khi bước khôi phục phiên
  /// refresh xong, mà hàng đợi chạy ngay lúc đó. Gửi multipart khi chưa có token
  /// là tải hết ảnh lên chỉ để nhận 401 rồi tải lại lần nữa. Xin token trước, qua
  /// CÙNG `RefreshCoordinator` nên nhập chung lượt refresh đang chạy của bước
  /// khôi phục (refresh token có rotation — không được refresh song song).
  /// Lỗi (mất mạng, phiên bị thu hồi) là [AppException] → engine dừng, giữ phiếu.
  Future<void> _ensureAccessToken() async {
    if (ref.read(tokenStoreProvider).accessToken != null) return;
    await ref.read(authRepositoryProvider).refreshSession();
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
    final owner = _owner();
    if (owner == null) return const FlushResult(skipped: true);
    if (_engine.isRunning) return const FlushResult(skipped: true);
    state = state.copyWith(flushing: true);
    try {
      final result = await _engine.flush();
      final drafts = await _currentDrafts();
      // Đổi tài khoản trong lúc gửi: không báo "đã tự gửi" phiếu của người trước
      // trên màn hình của người sau.
      final sameOwner = _engine.currentOwner() == owner;
      state = state.copyWith(
        drafts: sameOwner ? drafts : null,
        flushing: false,
        retryAt: result.retryAt,
        lastSent: sameOwner && result.sent.isNotEmpty ? result.sent : state.lastSent,
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

  /// Chỉ trả ảnh của phiếu đang hiện cho chủ hiện tại.
  Future<List<Uint8List>> imagesOf(String id) async =>
      state.drafts.any((d) => d.id == id) ? _engine.store.images(id) : const [];

  /// Sửa phiếu bị server từ chối rồi đưa lại vào hàng chờ.
  /// Chỉ phiếu đang hiện cho chủ hiện tại mới sửa / xoá được — cùng luật với
  /// [imagesOf]. Màn hình vốn chỉ liệt kê phiếu của chủ phiếu, nhưng đổi tài khoản
  /// giữa lúc đang mở sheet sửa thì [draft] trong tay là phiếu của người trước.
  bool _isMine(String id) => state.drafts.any((d) => d.id == id);

  Future<void> update(ReportDraft draft, ReportPayload payload) async {
    if (!_isMine(draft.id)) return;
    await _engine.store.save(draft.copyWith(
      payload: payload,
      state: DraftState.pending,
      lastError: null,
    ));
    await _reload();
    unawaited(flush());
  }

  Future<void> remove(String id) async {
    if (!_isMine(id)) return;
    await _engine.store.remove(id);
    await _reload();
  }

  /// Xoá tài khoản (B8) → xoá luôn phiếu chờ của tài khoản đó trên máy, kèm ảnh:
  /// ảnh, vị trí, SĐT trong phiếu là dữ liệu cá nhân người dùng vừa yêu cầu xoá.
  /// Đăng xuất thường thì KHÔNG gọi — phiếu nằm chờ chủ đăng nhập lại.
  Future<void> purgeAccount(String ownerId) async {
    await _engine.purgeOwner(ownerId);
    await _reload();
  }

  void consumeLastSent() => state = state.copyWith(lastSent: const []);
}

final offlineQueueProvider =
    NotifierProvider<OfflineQueueController, OfflineQueueState>(OfflineQueueController.new);
