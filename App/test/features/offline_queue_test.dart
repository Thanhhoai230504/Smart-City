import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:smart_city_app/core/network/app_exception.dart';
import 'package:smart_city_app/data/local/draft_store.dart';
import 'package:smart_city_app/data/models/issue.dart';
import 'package:smart_city_app/data/repositories/issue_repository.dart';
import 'package:smart_city_app/features/report/offline_queue.dart';

ReportPayload _payload(String title) => ReportPayload(
      title: title,
      description: 'Mô tả $title',
      category: 'pothole',
      location: 'Hải Châu',
      latitude: 16.07,
      longitude: 108.22,
    );

AppException _err(AppErrorKind kind, {Duration? retryAfter}) =>
    AppException(kind: kind, message: kind.name, retryAfter: retryAfter);

/// ⭐ Task 3.6 — hàng đợi offline: gửi tuần tự, gặp 429 thì dừng và hẹn lại
/// (`createIssueLimiter` 20 phiếu/15 phút), lỗi mạng giữ phiếu, 400 không chặn
/// cả hàng.
void main() {
  late MemoryDraftStore store;
  late DateTime now;
  late List<String> sent;
  late Map<String, AppException> failures;

  OfflineQueueEngine engine() => OfflineQueueEngine(
        store: store,
        clock: () => now,
        send: (payload, images) async {
          final failure = failures[payload.title];
          if (failure != null) throw failure;
          sent.add(payload.title);
          return Issue.fromJson({'_id': 'srv-${payload.title}', 'title': payload.title, 'status': 'reported'});
        },
      );

  Future<void> enqueue(OfflineQueueEngine e, List<String> titles) async {
    for (final t in titles) {
      await e.enqueue(_payload(t), [Uint8List.fromList([0xFF, 0xD8, 0xFF, t.length])]);
      now = now.add(const Duration(seconds: 1));
    }
  }

  setUp(() {
    store = MemoryDraftStore();
    now = DateTime(2026, 10, 2, 8);
    sent = [];
    failures = {};
  });

  test('kịch bản demo: lưu khi offline → có mạng → tự đẩy hết theo đúng thứ tự', () async {
    final e = engine();
    await enqueue(e, ['A', 'B', 'C']);
    expect((await store.all()).length, 3);

    final result = await e.flush();

    expect(sent, ['A', 'B', 'C']);
    expect(result.sent, hasLength(3));
    expect(result.stoppedBy, isNull);
    expect(await store.all(), isEmpty);
    expect(store.imageData, isEmpty, reason: 'ảnh cũng được dọn sau khi gửi');
  });

  test('ảnh đi kèm đúng phiếu', () async {
    final received = <List<UploadImage>>[];
    final e = OfflineQueueEngine(
      store: store,
      clock: () => now,
      send: (p, images) async {
        received.add(images);
        return Issue.fromJson({'_id': 'x'});
      },
    );
    await e.enqueue(_payload('A'), [Uint8List(3), Uint8List(4)]);
    await e.flush();
    expect(received.single.map((i) => i.bytes.length), [3, 4]);
    expect(received.single.first.filename, 'photo_1.jpg');
  });

  test('mất mạng giữa chừng → dừng, giữ phiếu chưa gửi, tăng số lần thử', () async {
    final e = engine();
    await enqueue(e, ['A', 'B', 'C']);
    failures['B'] = _err(AppErrorKind.network);

    final result = await e.flush();

    expect(sent, ['A']);
    expect(result.stoppedBy, AppErrorKind.network);
    final left = await store.all();
    expect(left.map((d) => d.payload.title), ['B', 'C']);
    expect(left.first.attempts, 1);
    expect(left.first.state, DraftState.pending);
  });

  test('429 → dừng ngay, KHÔNG thử các phiếu sau, hẹn lại theo Retry-After', () async {
    final e = engine();
    await enqueue(e, ['A', 'B', 'C']);
    failures['B'] = _err(AppErrorKind.rateLimited, retryAfter: const Duration(minutes: 7));

    final result = await e.flush();

    expect(sent, ['A']);
    expect(result.stoppedBy, AppErrorKind.rateLimited);
    expect(result.retryAt, now.add(const Duration(minutes: 7)));

    // Chưa tới giờ hẹn: lượt sau không gọi server lần nào.
    failures.clear();
    final again = await e.flush();
    expect(again.stoppedBy, AppErrorKind.rateLimited);
    expect(sent, ['A']);

    // Qua giờ hẹn: gửi tiếp phần còn lại.
    now = now.add(const Duration(minutes: 8));
    await e.flush();
    expect(sent, ['A', 'B', 'C']);
  });

  test('429 không có header → hẹn mặc định 15 phút (cửa sổ của limiter)', () async {
    final e = engine();
    await enqueue(e, ['A']);
    failures['A'] = _err(AppErrorKind.rateLimited);
    final result = await e.flush();
    expect(result.retryAt, now.add(OfflineQueueEngine.defaultRateLimitBackoff));
  });

  test('400 (dữ liệu bị từ chối) → đánh dấu "cần sửa" và ĐI TIẾP phiếu sau', () async {
    final e = engine();
    await enqueue(e, ['A', 'B', 'C']);
    failures['A'] = _err(AppErrorKind.badRequest);

    final result = await e.flush();

    expect(sent, ['B', 'C']);
    expect(result.stoppedBy, isNull);
    final left = await store.all();
    expect(left.single.payload.title, 'A');
    expect(left.single.state, DraftState.needsAttention);

    // Phiếu cần sửa không bị gửi lại tự động.
    failures.clear();
    await e.flush();
    expect(sent, ['B', 'C']);
  });

  test('5xx → dừng và thử lại lượt sau (không đánh dấu hỏng vĩnh viễn)', () async {
    final e = engine();
    await enqueue(e, ['A']);
    failures['A'] = _err(AppErrorKind.server);
    await e.flush();
    expect((await store.all()).single.state, DraftState.pending);

    failures.clear();
    await e.flush();
    expect(sent, ['A']);
  });

  test('hai lượt flush chồng nhau → lượt sau bỏ qua, không gửi trùng', () async {
    var inFlight = 0;
    var maxInFlight = 0;
    final e = OfflineQueueEngine(
      store: store,
      clock: () => now,
      send: (p, _) async {
        inFlight++;
        maxInFlight = inFlight > maxInFlight ? inFlight : maxInFlight;
        await Future<void>.delayed(const Duration(milliseconds: 10));
        inFlight--;
        sent.add(p.title);
        return Issue.fromJson({'_id': p.title});
      },
    );
    await enqueue(e, ['A', 'B']);

    final results = await Future.wait([e.flush(), e.flush()]);

    expect(results.where((r) => r.skipped), hasLength(1));
    expect(sent, ['A', 'B']);
    expect(maxInFlight, 1, reason: 'gửi tuần tự, không song song');
  });

  test('ReportDraft tuần tự hoá/khôi phục đủ trường', () {
    final d = ReportDraft(
      id: 'd1',
      payload: _payload('A'),
      createdAt: DateTime.utc(2026, 10, 2, 1),
      imageCount: 2,
      attempts: 3,
      lastError: 'x',
      state: DraftState.needsAttention,
      nextAttemptAt: DateTime.utc(2026, 10, 2, 2),
    );
    final back = ReportDraft.fromJson(d.toJson());
    expect(back.payload.title, 'A');
    expect(back.imageCount, 2);
    expect(back.attempts, 3);
    expect(back.state, DraftState.needsAttention);
    expect(back.nextAttemptAt?.toUtc(), DateTime.utc(2026, 10, 2, 2));
  });
}
