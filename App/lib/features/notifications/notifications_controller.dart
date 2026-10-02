import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/app_exception.dart';
import '../../data/models/common.dart';
import '../../data/models/notification.dart';
import '../../data/repositories/support_repositories.dart';
import '../auth/auth_controller.dart';

class NotificationsState {
  const NotificationsState({
    this.items = const [],
    this.unreadCount = 0,
    this.pagination = Pagination.empty,
    this.loading = false,
    this.loadingMore = false,
    this.error,
    this.loaded = false,
  });

  final List<AppNotification> items;

  /// Khớp `unreadCount` của server (nghiệm thu 5.6) — dùng cho badge tab.
  final int unreadCount;
  final Pagination pagination;
  final bool loading;
  final bool loadingMore;
  final AppException? error;
  final bool loaded;

  NotificationsState copyWith({
    List<AppNotification>? items,
    int? unreadCount,
    Pagination? pagination,
    bool? loading,
    bool? loadingMore,
    Object? error = _keep,
    bool? loaded,
  }) =>
      NotificationsState(
        items: items ?? this.items,
        unreadCount: unreadCount ?? this.unreadCount,
        pagination: pagination ?? this.pagination,
        loading: loading ?? this.loading,
        loadingMore: loadingMore ?? this.loadingMore,
        error: error == _keep ? this.error : error as AppException?,
        loaded: loaded ?? this.loaded,
      );

  static const _keep = Object();
}

/// Trung tâm thông báo (task 5.6). Nhận thêm thông báo đẩy qua socket khi app
/// đang mở (5.4); **khử trùng theo `_id`** để sau này bật FCM (B2) thì cùng một
/// thông báo đến từ hai kênh vẫn chỉ hiện một lần (5.5).
class NotificationsController extends Notifier<NotificationsState> {
  NotificationRepository get _repo => ref.read(notificationRepositoryProvider);

  @override
  NotificationsState build() {
    ref.listen(currentUserProvider.select((u) => u?.id), (prev, next) {
      if (next == null) {
        state = const NotificationsState();
      } else if (next != prev) {
        unawaited(refresh());
      }
    });
    // KHÔNG dùng `fireImmediately`: callback sẽ chạy refresh() ngay trong build,
    // đọc `state` khi provider chưa khởi tạo xong → StateError lúc mở app đã
    // đăng nhập. Hẹn sang microtask để build trả về trước.
    if (ref.read(currentUserProvider) != null) unawaited(Future.microtask(refresh));
    return const NotificationsState();
  }

  Future<void> refresh() async {
    if (ref.read(currentUserProvider) == null) return;
    state = state.copyWith(loading: true, error: null);
    try {
      final page = await _repo.list();
      state = NotificationsState(
        items: page.items,
        unreadCount: page.unreadCount,
        pagination: page.pagination,
        loaded: true,
      );
    } on AppException catch (e) {
      state = state.copyWith(loading: false, error: e, loaded: true);
    }
  }

  Future<void> loadMore() async {
    if (state.loading || state.loadingMore || !state.pagination.hasMore) return;
    state = state.copyWith(loadingMore: true);
    try {
      final page = await _repo.list(page: state.pagination.current + 1);
      final seen = {for (final n in state.items) n.id};
      state = state.copyWith(
        items: [...state.items, ...page.items.where((n) => seen.add(n.id))],
        pagination: page.pagination,
        unreadCount: page.unreadCount,
        loadingMore: false,
      );
    } on AppException {
      state = state.copyWith(loadingMore: false);
    }
  }

  /// Thông báo mới từ socket. Trả `false` nếu đã có (trùng).
  bool onIncoming(AppNotification n) {
    if (n.id.isEmpty || state.items.any((i) => i.id == n.id)) return false;
    state = state.copyWith(
      items: [n, ...state.items],
      unreadCount: state.unreadCount + (n.isRead ? 0 : 1),
    );
    return true;
  }

  Future<void> markRead(AppNotification n) async {
    if (n.isRead) return;
    state = state.copyWith(
      items: [for (final i in state.items) i.id == n.id ? i.markRead() : i],
      unreadCount: (state.unreadCount - 1).clamp(0, 1 << 30),
    );
    try {
      await _repo.markRead(n.id);
    } on AppException {
      await syncUnread();
    }
  }

  Future<void> markAllRead() async {
    final before = state;
    state = state.copyWith(items: [for (final i in state.items) i.markRead()], unreadCount: 0);
    try {
      await _repo.markAllRead();
    } on AppException {
      state = before;
      rethrow;
    }
  }

  Future<void> syncUnread() async {
    if (ref.read(currentUserProvider) == null) return;
    try {
      state = state.copyWith(unreadCount: await _repo.unreadCount());
    } on AppException {
      // Giữ số đang có.
    }
  }
}

final notificationsProvider =
    NotifierProvider<NotificationsController, NotificationsState>(NotificationsController.new);

final unreadCountProvider = Provider<int>((ref) => ref.watch(notificationsProvider).unreadCount);
