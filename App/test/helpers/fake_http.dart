import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// Phản hồi giả: status + JSON + header.
class FakeResponse {
  const FakeResponse(this.status, this.body, {this.headers = const {}, this.delay = Duration.zero});

  final int status;
  final Object? body;
  final Map<String, List<String>> headers;
  final Duration delay;
}

typedef FakeHandler = FutureOr<FakeResponse> Function(RequestOptions options);

/// Thay tầng HTTP của Dio — test đi qua đủ interceptor thật mà không cần mạng.
class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.handler, {this.captureBodies = false});

  FakeHandler handler;
  final List<RequestOptions> requests = [];

  /// Đọc thân request đúng như dio đẩy ra mạng (multipart đã ghép đủ ảnh) vào
  /// [bodies], cùng chỉ số với [requests]. Mặc định tắt để các test sẵn có giữ
  /// nguyên hành vi.
  final bool captureBodies;
  final List<List<int>> bodies = [];

  int countPath(String path) => requests.where((r) => r.path == path).length;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    if (captureBodies) {
      bodies.add(requestStream == null ? const [] : await requestStream.expand((chunk) => chunk).toList());
    }
    final response = await handler(options);
    if (response.delay > Duration.zero) await Future<void>.delayed(response.delay);
    if (options.cancelToken?.isCancelled ?? false) {
      throw DioException.requestCancelled(requestOptions: options, reason: 'cancelled');
    }
    return ResponseBody.fromString(
      jsonEncode(response.body),
      response.status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
        ...response.headers,
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// Lỗi mạng (không có response) — như khi bật chế độ máy bay.
class OfflineAdapter implements HttpClientAdapter {
  int calls = 0;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream,
      Future<void>? cancelFuture) async {
    calls++;
    throw DioException.connectionError(requestOptions: options, reason: 'offline');
  }

  @override
  void close({bool force = false}) {}
}
