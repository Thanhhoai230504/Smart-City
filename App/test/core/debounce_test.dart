import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smart_city_app/core/utils/debouncer.dart';
import 'package:smart_city_app/data/models/issue.dart';
import 'package:smart_city_app/features/map/map_screen.dart';

void main() {
  test('dò trùng: gõ nhanh 10 ký tự → đúng 1 request (task 3.5, debounce 600ms)', () {
    fakeAsync((async) {
      final latest = LatestRequest<String>(const Duration(milliseconds: 600));
      final requests = <String>[];
      final results = <String>[];
      var text = '';
      for (final ch in 'Ổ gà to lớ'.split('')) {
        text += ch;
        final snapshot = text;
        latest.run(
          (cancel) async {
            requests.add(snapshot);
            return snapshot;
          },
          onResult: results.add,
        );
        async.elapse(const Duration(milliseconds: 120)); // gõ nhanh hơn ngưỡng
      }
      async.elapse(const Duration(milliseconds: 700));

      expect(requests, ['Ổ gà to lớ']);
      expect(results, ['Ổ gà to lớ']);
    });
  });

  test('phản hồi cũ về muộn KHÔNG ghi đè kết quả mới (stale response)', () {
    fakeAsync((async) {
      final latest = LatestRequest<String>(const Duration(milliseconds: 100));
      final results = <String>[];
      final cancelled = <String>[];

      Future<String> slow(String v, Duration d, CancelToken c) async {
        unawaited(c.whenCancel.then((_) => cancelled.add(v)));
        await Future<void>.delayed(d);
        return v;
      }

      latest.run((c) => slow('cũ', const Duration(seconds: 3), c), onResult: results.add);
      async.elapse(const Duration(milliseconds: 150)); // lượt 1 đã bắn
      latest.run((c) => slow('mới', const Duration(milliseconds: 200), c), onResult: results.add);
      async.elapse(const Duration(seconds: 5));

      expect(results, ['mới']);
      expect(cancelled, ['cũ'], reason: 'request cũ bị huỷ bằng CancelToken');
    });
  });

  test('bản đồ: kéo 10 lần liên tiếp → ≤ 2 request (task 2.5, debounce 250ms)', () {
    fakeAsync((async) {
      var calls = 0;
      final loader = MapIssueLoader((bounds, category, cancel) async {
        calls++;
        return <Issue>[];
      });
      for (var i = 0; i < 10; i++) {
        final shift = i * 0.001;
        loader.request(
          MapBounds(108.1 + shift, 16.0, 108.3 + shift, 16.1),
          onResult: (_) {},
          onError: (_) {},
        );
        async.elapse(const Duration(milliseconds: 60)); // khung hình của thao tác kéo
      }
      async.elapse(const Duration(seconds: 1));

      expect(calls, lessThanOrEqualTo(2));
      expect(calls, greaterThanOrEqualTo(1));
    });
  });

  test('bản đồ: khung nhìn không đổi (chỉ rung tay) → không gọi lại', () {
    fakeAsync((async) {
      var calls = 0;
      final loader = MapIssueLoader((b, c, t) async {
        calls++;
        return <Issue>[];
      });
      const bounds = MapBounds(108.1, 16.0, 108.3, 16.1);
      loader.request(bounds, onResult: (_) {}, onError: (_) {});
      async.elapse(const Duration(seconds: 1));
      loader.request(bounds, onResult: (_) {}, onError: (_) {});
      async.elapse(const Duration(seconds: 1));
      expect(calls, 1);
    });
  });

  test('khung nhìn sai (west >= east) bị bỏ qua', () {
    expect(const MapBounds(108.3, 16.0, 108.1, 16.1).isValid, isFalse);
  });
}
