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

  /// Tài khoản đang đăng nhập (`null` = khách) — engine hỏi lại ở mỗi phiếu.
  String? owner;

  OfflineQueueEngine engine() => OfflineQueueEngine(
        store: store,
        clock: () => now,
        currentOwner: () => owner,
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
    owner = 'u1';
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
      currentOwner: () => owner,
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
      currentOwner: () => owner,
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
      ownerId: 'u1',
      attempts: 3,
      lastError: 'x',
      state: DraftState.needsAttention,
      nextAttemptAt: DateTime.utc(2026, 10, 2, 2),
    );
    final back = ReportDraft.fromJson(d.toJson());
    expect(back.payload.title, 'A');
    expect(back.imageCount, 2);
    expect(back.ownerId, 'u1');
    expect(back.attempts, 3);
    expect(back.state, DraftState.needsAttention);
    expect(back.nextAttemptAt?.toUtc(), DateTime.utc(2026, 10, 2, 2));
  });

  test('bản ghi cũ (chưa có khoá ownerId) vẫn đọc được — chủ là null', () {
    final json = ReportDraft(id: 'old', payload: _payload('A'), createdAt: now, imageCount: 1).toJson()
      ..remove('ownerId');
    final back = ReportDraft.fromJson(json);
    expect(back.ownerId, isNull);
    expect(back.payload.title, 'A');
  });

  group('phiếu chờ thuộc về tài khoản đã soạn', () {
    Future<void> enqueueAs(OfflineQueueEngine e, String who, List<String> titles) async {
      owner = who;
      await enqueue(e, titles);
    }

    test('lưu phiếu ghi chủ là người đang đăng nhập; chỉ chủ thấy và gửi được phiếu của mình', () async {
      final e = engine();
      await enqueueAs(e, 'u1', ['A1']);
      await enqueueAs(e, 'u2', ['B1', 'B2']);
      expect((await store.all()).map((d) => d.ownerId), ['u1', 'u2', 'u2']);

      owner = 'u2';
      expect((await e.pending()).map((d) => d.payload.title), ['B1', 'B2']);
      await e.flush();
      expect(sent, ['B1', 'B2'], reason: 'phiếu của u1 không được gửi bằng phiên của u2');

      owner = 'u1';
      expect((await e.pending()).map((d) => d.payload.title), ['A1']);
      await e.flush();
      expect(sent, ['B1', 'B2', 'A1']);
    });

    test('khách (đã đăng xuất): không liệt kê, không gửi — phiếu vẫn nằm trên máy chờ chủ', () async {
      final e = engine();
      await enqueueAs(e, 'u1', ['A']);
      owner = null;

      expect(await e.pending(), isEmpty);
      expect((await e.flush()).skipped, isTrue);
      expect(sent, isEmpty);
      expect(await store.all(), hasLength(1));
    });

    test('không ai đăng nhập thì không lưu được phiếu vô chủ', () async {
      owner = null;
      await expectLater(engine().enqueue(_payload('A'), const []), throwsStateError);
      expect(await store.all(), isEmpty);
    });

    test('đổi tài khoản GIỮA lượt gửi → dừng ngay, phần còn lại không đi bằng phiên người mới', () async {
      final e = OfflineQueueEngine(
        store: store,
        clock: () => now,
        currentOwner: () => owner,
        send: (p, _) async {
          sent.add(p.title);
          owner = 'u2'; // u1 đăng xuất, u2 đăng nhập trong lúc phiếu đầu đang lên
          return Issue.fromJson({'_id': p.title});
        },
      );
      await enqueueAs(e, 'u1', ['A', 'B']);

      final result = await e.flush();

      expect(sent, ['A']);
      expect(result.stoppedBy, AppErrorKind.cancelled);
      expect((await store.all()).single.ownerId, 'u1', reason: 'phiếu B vẫn chờ chủ của nó');
    });

    test('xoá tài khoản → xoá mọi phiếu + ảnh của tài khoản đó, phiếu người khác giữ nguyên', () async {
      final e = engine();
      await enqueueAs(e, 'u1', ['A1', 'A2']);
      await enqueueAs(e, 'u2', ['B1']);

      expect(await e.purgeOwner('u1'), 2);

      final left = await store.all();
      expect(left.single.payload.title, 'B1');
      expect(store.imageData.keys, [left.single.id], reason: 'ảnh của phiếu đã xoá cũng bị xoá');
    });

    /// Xoá phiếu theo tiêu đề ngay giữa lúc engine đang gửi — như người dùng bấm
    /// "Xoá" trên màn phiếu chờ, hay xoá tài khoản, khi lượt gửi đang chạy.
    Future<void> removeTitled(String title) async {
      for (final d in await store.all()) {
        if (d.payload.title == title) await store.remove(d.id);
      }
    }

    test('phiếu bị xoá khi lượt gửi đang chạy thì KHÔNG bị gửi (danh sách của lượt là ảnh chụp cũ)', () async {
      final e = OfflineQueueEngine(
        store: store,
        clock: () => now,
        currentOwner: () => owner,
        send: (p, _) async {
          if (p.title == 'A') await removeTitled('B');
          sent.add(p.title);
          return Issue.fromJson({'_id': p.title});
        },
      );
      await enqueue(e, ['A', 'B', 'C']);

      await e.flush();

      expect(sent, ['A', 'C']);
      expect(await store.all(), isEmpty);
    });

    test('phiếu bị xoá trong lúc chính nó đang gửi rồi lỗi mạng → không bị dựng lại', () async {
      final e = OfflineQueueEngine(
        store: store,
        clock: () => now,
        currentOwner: () => owner,
        send: (p, _) async {
          await removeTitled(p.title);
          throw _err(AppErrorKind.network);
        },
      );
      await enqueue(e, ['A']);

      final result = await e.flush();

      expect(result.stoppedBy, AppErrorKind.network);
      expect(await store.all(), isEmpty, reason: 'ghi lại số lần thử lúc này là hồi sinh phiếu đã xoá');
    });

    test('phiếu vô chủ của bản cũ: mở app có phiên → giao cho tài khoản đó; mở app là khách → xoá kèm ảnh', () async {
      // Cũ hơn mọi phiếu khác trong test để thứ tự `all()` cố định.
      Future<void> saveLegacy(String title) => store.save(
            ReportDraft(
              id: 'legacy-$title',
              payload: _payload(title),
              createdAt: now.subtract(const Duration(minutes: 1)),
              imageCount: 1,
            ),
            images: [Uint8List(1)],
          );

      await saveLegacy('L1');
      await enqueueAs(engine(), 'u2', ['B']);
      expect(await engine().settleLegacy('u1'), 1);
      expect((await store.all()).map((d) => (d.payload.title, d.ownerId)), [('L1', 'u1'), ('B', 'u2')]);
      expect(store.imageData['legacy-L1'], hasLength(1), reason: 'giao chủ không làm mất ảnh');

      await saveLegacy('L2');
      expect(await engine().settleLegacy(null), 1);
      expect(await store.contains('legacy-L2'), isFalse);
      expect(store.imageData.containsKey('legacy-L2'), isFalse);
      expect(await store.all(), hasLength(2), reason: 'phiếu đã có chủ không bị đụng tới');
    });
  });
}
