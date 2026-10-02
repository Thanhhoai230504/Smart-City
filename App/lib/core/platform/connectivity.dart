import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

bool isOnlineResult(List<ConnectivityResult> results) =>
    results.any((r) => r != ConnectivityResult.none);

/// Trạng thái có mạng hay không. "Có wifi" chưa chắc có Internet — lỗi gửi
/// thật vẫn được xử lý ở hàng đợi (3.6); đây chỉ là tín hiệu để hiện
/// `OfflineBanner` và để thử gửi lại khi mạng đổi.
final connectivityProvider = StreamProvider<bool>((ref) async* {
  final connectivity = Connectivity();
  try {
    yield isOnlineResult(await connectivity.checkConnectivity());
  } catch (_) {
    yield true;
  }
  yield* connectivity.onConnectivityChanged.map(isOnlineResult);
});

/// Mặc định coi là có mạng khi chưa biết — tránh nháy banner offline lúc mở app.
final isOnlineProvider = Provider<bool>(
  (ref) => ref.watch(connectivityProvider).valueOrNull ?? true,
);
