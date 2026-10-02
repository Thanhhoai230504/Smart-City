import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/common.dart';
import '../network/app_exception.dart';

class PagedState<T> {
  const PagedState({
    this.items = const [],
    this.pagination = Pagination.empty,
    this.isLoading = true,
    this.isLoadingMore = false,
    this.error,
    this.loadMoreError,
  });

  final List<T> items;
  final Pagination pagination;

  /// Đang tải trang đầu (skeleton).
  final bool isLoading;
  final bool isLoadingMore;
  final AppException? error;
  final AppException? loadMoreError;

  bool get hasMore => pagination.hasMore;
  bool get isEmpty => !isLoading && error == null && items.isEmpty;

  PagedState<T> copyWith({
    List<T>? items,
    Pagination? pagination,
    bool? isLoading,
    bool? isLoadingMore,
    Object? error = _keep,
    Object? loadMoreError = _keep,
  }) =>
      PagedState(
        items: items ?? this.items,
        pagination: pagination ?? this.pagination,
        isLoading: isLoading ?? this.isLoading,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
        error: error == _keep ? this.error : error as AppException?,
        loadMoreError: loadMoreError == _keep ? this.loadMoreError : loadMoreError as AppException?,
      );

  static const _keep = Object();
}

/// Infinite scroll dùng chung (task 2.2):
/// - **cuộn nhanh không tải trùng trang** — chỉ một lượt `loadMore` tại một thời
///   điểm, và gộp theo id nếu server trả trùng (dữ liệu mới chèn đầu danh sách
///   làm trang sau dịch đi một phần tử);
/// - **đổi bộ lọc khi đang tải không hiện dữ liệu cũ** — huỷ request cũ bằng
///   `CancelToken` và bỏ qua phản hồi của "thế hệ" cũ, tương đương guard chống
///   phản hồi cũ của `issueSlice` trên web.
abstract class PagedController<T> extends AutoDisposeNotifier<PagedState<T>> {
  CancelToken? _cancel;
  int _generation = 0;
  bool _disposed = false;

  Future<Paged<T>> fetchPage(int page, CancelToken cancel);

  String idOf(T item);

  /// Gọi `super.build()` từ lớp con. Lớp con có thể `ref.watch` bộ lọc —
  /// khi bộ lọc đổi, Riverpod chạy lại build (sau khi gọi onDispose), nên phải
  /// đặt lại cờ ở đây.
  @override
  PagedState<T> build() {
    _disposed = false;
    ref.onDispose(() {
      _disposed = true;
      _cancel?.cancel('disposed');
    });
    unawaited(Future.microtask(refresh));
    return PagedState<T>();
  }

  Future<void> refresh() async {
    _cancel?.cancel('superseded');
    final cancel = CancelToken();
    _cancel = cancel;
    final generation = ++_generation;
    state = state.copyWith(isLoading: true, error: null, loadMoreError: null, isLoadingMore: false);
    try {
      final page = await fetchPage(1, cancel);
      if (_disposed || generation != _generation) return;
      state = PagedState(items: page.items, pagination: page.pagination, isLoading: false);
    } catch (e) {
      if (_disposed || generation != _generation || cancel.isCancelled) return;
      state = state.copyWith(isLoading: false, error: AppException.from(e));
    }
  }

  Future<void> loadMore() async {
    final s = state;
    if (s.isLoading || s.isLoadingMore || !s.hasMore || s.error != null) return;
    final generation = _generation;
    final cancel = _cancel ?? CancelToken();
    state = s.copyWith(isLoadingMore: true, loadMoreError: null);
    try {
      final page = await fetchPage(s.pagination.current + 1, cancel);
      if (_disposed || generation != _generation) return;
      final seen = {for (final i in state.items) idOf(i)};
      state = state.copyWith(
        items: [...state.items, ...page.items.where((i) => seen.add(idOf(i)))],
        pagination: page.pagination,
        isLoadingMore: false,
      );
    } catch (e) {
      if (_disposed || generation != _generation) return;
      state = state.copyWith(isLoadingMore: false, loadMoreError: AppException.from(e));
    }
  }

  /// Cập nhật một phần tử tại chỗ (vote, nhận việc…) mà không tải lại.
  void replace(T item) {
    final id = idOf(item);
    state = state.copyWith(items: [for (final i in state.items) idOf(i) == id ? item : i]);
  }

  void removeWhere(bool Function(T) test) =>
      state = state.copyWith(items: state.items.where((i) => !test(i)).toList());
}
