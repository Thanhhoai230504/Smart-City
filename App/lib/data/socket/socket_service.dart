import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../core/config/app_config.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/json.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/issues/issue_detail_controller.dart';
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

/// Socket.IO khi app ở **foreground** (task 5.4) — port `hooks/useSocket.ts`.
///
/// - `auth: {token}` đọc lại token ở MỖI lần bắt tay, nên sau refresh lần nối
///   lại tự dùng token mới.
/// - `connect_error` chứa `TOKEN_EXPIRED`/`UNAUTHORIZED` → xin token mới qua
///   **cùng `RefreshCoordinator`** với Dio (refresh có rotation, hai đường
///   refresh song song là một đường cầm token chết), **trần 2 lần**.
/// - Vào nền thì ngắt — iOS/Android đều giết socket nền; nền là việc của FCM (B2).
class SocketService {
  SocketService(this._ref);

  final Ref _ref;
  io.Socket? _socket;
  int _authRetries = 0;
  static const maxAuthRetries = 2;

  bool get isConnected => _socket?.connected ?? false;

  void connect() {
    if (_socket != null) return;
    final tokens = _ref.read(tokenStoreProvider);
    final socket = io.io(AppConfig.serverOrigin, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'forceNew': true,
      'reconnection': true,
      'reconnectionDelay': 3000,
      'reconnectionAttempts': 5,
      'auth': (void Function(Object?) callback) => callback({'token': tokens.accessToken}),
    });
    _socket = socket;

    socket.onConnect((_) => _authRetries = 0);
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
    _incoming.add(n);
  }

  void _onIssueEvent(dynamic data) {
    final issueId = refId(asMap(data)['issue']);
    if (issueId != null) _ref.invalidate(issueDetailProvider(issueId));
    _ref.invalidate(workListProvider);
  }

  final _incoming = StreamController<AppNotification>.broadcast();

  /// Shell hiện banner trong app cho thông báo mới khi đang mở.
  Stream<AppNotification> get incoming => _incoming.stream;

  void disconnect() {
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
