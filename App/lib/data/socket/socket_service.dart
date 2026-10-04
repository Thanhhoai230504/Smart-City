import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../core/config/app_config.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/json.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/issues/issue_detail_controller.dart';
import '../../features/my_issues/my_issues_screen.dart';
import '../../features/notifications/notifications_controller.dart';
import '../../features/staff/work_list_screen.dart';
import '../models/notification.dart';

/// Sự kiện app phải nghe (Phụ lục B). `issue:created`/`issue:assigned` chỉ bắn
/// vào room `admins` — app không làm admin nên bỏ.
abstract final class SocketEvents {
  static const notification = 'notification:new';
  static const issueUpdated = 'issue:updated';
  static const issueResolved = 'issue:resolved';
}

/// Màn cần làm mới khi có một thông báo realtime.
enum RealtimeTarget { issueDetail, workList, myIssues }

/// Socket.IO khi app ở **foreground** (task 5.4) — port `hooks/useSocket.ts`.
///
/// - `auth: {token}` đọc lại token ở MỖI lần bắt tay, nên sau refresh lần nối
///   lại tự dùng token mới.
/// - `connect_error` chứa `TOKEN_EXPIRED`/`UNAUTHORIZED` → xin token mới qua
///   **cùng `RefreshCoordinator`** với Dio (refresh có rotation, hai đường
///   refresh song song là một đường cầm token chết), **trần 2 lần**.
/// - Vào nền thì ngắt — iOS/Android đều giết socket nền; nền là việc của FCM (B2).
/// - Nối lại KHÔNG giới hạn số lần, và mỗi lần nối lại thì tải bù: server không
///   gửi lại thông báo phát ra lúc socket rớt.
class SocketService {
  SocketService(this._ref);

  final Ref _ref;
  io.Socket? _socket;
  int _authRetries = 0;
  static const maxAuthRetries = 2;

  /// Socket từng rớt (mất mạng, server khởi động lại, app vào nền) → lần nối
  /// sau phải tải bù thông báo và danh sách.
  bool _needsResync = false;

  /// Thông báo làm đổi danh sách việc của cán bộ.
  static const workTypes = {'issue_assigned', 'issue_unassigned', 'issue_reopened', 'sla_reminder', 'sla_escalated'};

  /// Thông báo làm đổi phiếu của chính người dân.
  static const myIssueTypes = {'issue_updated', 'issue_resolved', 'issue_rejected', 'issue_merged'};

  bool get isConnected => _socket?.connected ?? false;

  void connect() {
    if (_socket != null) return;
    final tokens = _ref.read(tokenStoreProvider);
    final socket = io.io(AppConfig.serverOrigin, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'forceNew': true,
      'reconnection': true,
      // Không đặt `reconnectionAttempts`: trước đây chỉ thử 5 lần (~25 giây)
      // rồi bỏ hẳn — server khởi động lại / ngủ đông lâu hơn thế là app mất
      // realtime tới khi đưa xuống nền rồi mở lại.
      'reconnectionDelay': 2000,
      'reconnectionDelayMax': 10000,
      'auth': (void Function(Object?) callback) => callback({'token': tokens.accessToken}),
    });
    _socket = socket;

    socket.onConnect((_) {
      _authRetries = 0;
      if (_needsResync) _resync();
      _needsResync = false;
    });
    socket.onDisconnect((_) => _needsResync = true);
    socket.onConnectError((data) => unawaited(_onConnectError(data)));
    socket.on(SocketEvents.notification, _onNotification);
    socket.on(SocketEvents.issueUpdated, _onIssueEvent);
    socket.on(SocketEvents.issueResolved, _onIssueEvent);
    socket.connect();
  }

  Future<void> _onConnectError(Object? data) async {
    final text = data is Map ? '${data['message']}' : '$data';
    final isAuthError = text.contains('TOKEN_EXPIRED') || text.contains('UNAUTHORIZED');
    if (!isAuthError || _authRetries >= maxAuthRetries) return;
    _authRetries++;
    try {
      await _ref.read(apiClientProvider).refreshCoordinator.refresh();
      _socket?.connect();
    } catch (_) {
      // Refresh bị từ chối → AuthController tự đăng xuất qua SessionExpiryBus.
    }
  }

  void _onNotification(dynamic data) {
    final n = AppNotification.fromJson(data);
    _ref.read(notificationsProvider.notifier).onIncoming(n);
    final targets = targetsFor(n);
    final issueId = n.issueId;
    if (issueId != null && targets.contains(RealtimeTarget.issueDetail)) {
      _ref.invalidate(issueDetailProvider(issueId));
    }
    if (targets.contains(RealtimeTarget.workList)) _refreshWork();
    if (targets.contains(RealtimeTarget.myIssues)) _refreshMyIssues();
    _incoming.add(n);
  }

  /// Thông báo nào làm đổi dữ liệu đang hiển thị thì làm mới chỗ đó. Trước đây
  /// chỉ có banner: cán bộ được giao việc mà danh sách "Công việc" vẫn cũ, người
  /// dân thấy "đã xử lý" mà "Sự cố của tôi" vẫn ghi "đang xử lý" tới khi kéo làm mới.
  static Set<RealtimeTarget> targetsFor(AppNotification n) => {
        if (n.issueId != null) RealtimeTarget.issueDetail,
        if (workTypes.contains(n.type)) RealtimeTarget.workList,
        if (myIssueTypes.contains(n.type)) RealtimeTarget.myIssues,
      };

  // Làm mới tại chỗ (giữ danh sách đang xem, chỉ hiện thanh tiến trình) thay vì
  // invalidate — invalidate xoá trắng danh sách rồi hiện khung chờ.
  void _refreshWork() {
    if (_ref.exists(workListProvider)) unawaited(_ref.read(workListProvider.notifier).refresh());
    _ref.invalidate(workSummaryProvider);
  }

  void _refreshMyIssues() {
    if (_ref.exists(myIssuesProvider)) unawaited(_ref.read(myIssuesProvider.notifier).refresh());
  }

  void _resync() {
    unawaited(_ref.read(notificationsProvider.notifier).refresh());
    _refreshWork();
    _refreshMyIssues();
  }

  void _onIssueEvent(dynamic data) {
    final issueId = refId(asMap(data)['issue']);
    if (issueId != null) _ref.invalidate(issueDetailProvider(issueId));
    invalidateWork(_ref.invalidate);
  }

  final _incoming = StreamController<AppNotification>.broadcast();

  /// Shell hiện banner trong app cho thông báo mới khi đang mở.
  Stream<AppNotification> get incoming => _incoming.stream;

  void disconnect() {
    if (_socket != null) _needsResync = true;
    _socket
      ?..clearListeners()
      ..disconnect()
      ..dispose();
    _socket = null;
  }

  Future<void> dispose() async {
    disconnect();
    await _incoming.close();
  }
}

final socketServiceProvider = Provider<SocketService>((ref) {
  final service = SocketService(ref);
  ref.onDispose(service.dispose);
  return service;
});

/// Nối/ngắt socket theo trạng thái đăng nhập và vòng đời app.
class SocketLifecycle {
  SocketLifecycle(this._ref) {
    _sub = _ref.listen<AuthState>(authControllerProvider, (_, next) => _sync(), fireImmediately: true);
    _listener = AppLifecycleListener(
      onResume: () {
        _foreground = true;
        _sync();
        unawaited(_ref.read(notificationsProvider.notifier).syncUnread());
      },
      onHide: () {
        _foreground = false;
        _sync();
      },
    );
  }

  final Ref _ref;
  late final ProviderSubscription<AuthState> _sub;
  late final AppLifecycleListener _listener;
  bool _foreground = true;

  void _sync() {
    final signedIn = _ref.read(authControllerProvider) is AuthSignedIn;
    final socket = _ref.read(socketServiceProvider);
    if (signedIn && _foreground) {
      socket.connect();
    } else {
      socket.disconnect();
    }
  }

  void dispose() {
    _sub.close();
    _listener.dispose();
  }
}

final socketLifecycleProvider = Provider<SocketLifecycle>((ref) {
  final lifecycle = SocketLifecycle(ref);
  ref.onDispose(lifecycle.dispose);
  return lifecycle;
});
