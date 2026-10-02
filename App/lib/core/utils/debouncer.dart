import 'dart:async';

import 'package:dio/dio.dart';

/// Gộp nhiều lần gọi liên tiếp thành một, sau [delay] im lặng.
class Debouncer {
  Debouncer(this.delay);

  final Duration delay;
  Timer? _timer;

  void call(void Function() action) {
    _timer?.cancel();
    _timer = Timer(delay, action);
  }

  bool get isPending => _timer?.isActive ?? false;

  void cancel() => _timer?.cancel();
}

/// Debounce + huỷ request cũ — chiến lược web dùng cho bản đồ (250ms) và dò
/// trùng (600ms): chỉ request cuối cùng được về tới UI, phản hồi cũ đến muộn
/// không ghi đè được kết quả mới (chống "stale response").
class LatestRequest<T> {
  LatestRequest(Duration delay) : _debouncer = Debouncer(delay);

  final Debouncer _debouncer;
  CancelToken? _inFlight;
  int _generation = 0;

  /// [onResult] chỉ được gọi cho lượt mới nhất. Lỗi huỷ bị nuốt; lỗi khác đi
  /// vào [onError].
  void run(
    Future<T> Function(CancelToken cancel) request, {
    required void Function(T value) onResult,
    void Function(Object error)? onError,
    void Function()? onStart,
  }) {
    _debouncer(() async {
      _inFlight?.cancel('superseded');
      final token = CancelToken();
      _inFlight = token;
      final generation = ++_generation;
      onStart?.call();
      try {
        final value = await request(token);
        if (generation == _generation && !token.isCancelled) onResult(value);
      } catch (e) {
        if (generation != _generation || token.isCancelled) return;
        onError?.call(e);
      }
    });
  }

  void cancel() {
    _debouncer.cancel();
    _inFlight?.cancel('disposed');
    _generation++;
  }
}
