import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:smart_city_app/core/network/app_exception.dart';
import 'package:smart_city_app/core/widgets/sla_countdown.dart';
import 'package:smart_city_app/data/models/issue.dart';
import 'package:smart_city_app/data/models/meta.dart';
import 'package:smart_city_app/data/models/report_support.dart';
import 'package:smart_city_app/data/repositories/issue_repository.dart';
import 'package:smart_city_app/features/issues/issue_rules.dart';
import 'package:smart_city_app/features/public_info/statistics_screen.dart';
import 'package:smart_city_app/features/report/photo_tools.dart';
import 'package:smart_city_app/features/staff/resolve_flow.dart';
import 'package:smart_city_app/features/update/app_update.dart';

Issue _issue({
  String status = 'resolved',
  String reporter = 'u1',
  int reopenCount = 0,
  List<Map<String, Object?>> history = const [],
  String? resolvedAt,
  Object? mergedInto,
  Map<String, Object?>? rating,
}) =>
    Issue.fromJson({
      '_id': 'i1',
      'status': status,
      'userId': {'_id': reporter, 'name': 'A'},
      'reopenCount': reopenCount,
      'statusHistory': history,
      'resolvedAt': resolvedAt,
      'mergedInto': mergedInto,
      'rating': rating,
    });

void main() {
  const policy = ReopenPolicy(maxCount: 2, windowDays: 30);
  final closed = DateTime.utc(2026, 9, 1, 12);
  final closedHistory = [
    {'status': 'reported', 'changedAt': '2026-08-30T00:00:00.000Z'},
    {'status': 'resolved', 'changedAt': closed.toIso8601String()},
  ];

  group('Mở lại sự cố — cùng thứ tự với checkCanReopen (task 3.8)', () {
    test('được mở lại, báo còn bao nhiêu ngày', () {
      final r = reopenEligibility(_issue(history: closedHistory), 'u1', policy, now: closed.add(const Duration(days: 10)));
      expect(r.allowed, isTrue);
      expect(r.daysLeft, 20);
    });

    test('đúng ngày thứ 30 vẫn được (backend dùng days > windowDays)', () {
      final r = reopenEligibility(_issue(history: closedHistory), 'u1', policy, now: closed.add(const Duration(days: 30)));
      expect(r.allowed, isTrue);
    });

    test('REOPEN_WINDOW_EXPIRED sau ngày 30', () {
      final r = reopenEligibility(_issue(history: closedHistory), 'u1', policy,
          now: closed.add(const Duration(days: 30, minutes: 1)));
      expect(r.block, ReopenBlock.windowExpired);
    });

    test('NOT_REPORTER', () {
      expect(reopenEligibility(_issue(history: closedHistory), 'u2', policy).block, ReopenBlock.notReporter);
    });

    test('ISSUE_NOT_CLOSED', () {
      expect(reopenEligibility(_issue(status: 'processing'), 'u1', policy).block, ReopenBlock.notClosed);
    });

    test('REOPEN_LIMIT_REACHED', () {
      expect(reopenEligibility(_issue(reopenCount: 2, history: closedHistory), 'u1', policy).block,
          ReopenBlock.limitReached);
    });

    test('MERGED_ISSUE được kiểm TRƯỚC người báo cáo', () {
      expect(reopenEligibility(_issue(mergedInto: 'root', reporter: 'u9'), 'u1', policy).block,
          ReopenBlock.mergedIssue);
    });

    test('phiếu rejected (không có resolvedAt) vẫn mở lại được — mốc đóng từ statusHistory', () {
      final rejected = _issue(status: 'rejected', history: [
        {'status': 'rejected', 'changedAt': closed.toIso8601String(), 'note': 'Không thuộc thẩm quyền'},
      ]);
      expect(rejected.resolvedAt, isNull);
      final r = reopenEligibility(rejected, 'u1', policy, now: closed.add(const Duration(days: 2)));
      expect(r.allowed, isTrue);
    });

    test('phiếu cũ thiếu mọi mốc đóng không bị chặn oan', () {
      final r = reopenEligibility(_issue(), 'u1', policy);
      expect(r.allowed, isTrue);
      expect(r.daysLeft, isNull);
    });

    test('mỗi mã một câu giải thích khác nhau', () {
      final texts = {for (final b in ReopenBlock.values) b.explain(policy)};
      expect(texts, hasLength(ReopenBlock.values.length));
      expect(ReopenBlock.fromCode('REOPEN_LIMIT_REACHED'), ReopenBlock.limitReached);
    });
  });

  group('Đánh giá — mở cho cả rejected (task I1)', () {
    test('người báo cáo, phiếu đóng, chưa chấm', () {
      expect(canRateIssue(_issue(), 'u1'), isTrue);
      expect(canRateIssue(_issue(status: 'rejected'), 'u1'), isTrue);
    });

    test('không cho: người khác, chưa đóng, đã chấm, đã gộp', () {
      expect(canRateIssue(_issue(), 'u2'), isFalse);
      expect(canRateIssue(_issue(status: 'processing'), 'u1'), isFalse);
      expect(canRateIssue(_issue(rating: {'score': 4}), 'u1'), isFalse);
      expect(canRateIssue(_issue(mergedInto: 'x'), 'u1'), isFalse);
    });
  });

  group('Hoàn tất việc — ảnh TRƯỚC, trạng thái SAU (task 4.5)', () {
    late List<String> calls;
    late bool statusShouldFail;

    ResolveFlow flow({List<IssueImage> existing = const []}) => ResolveFlow(
          alreadyUploaded: existing,
          upload: (images) async {
            calls.add('upload:${images.length}');
            return [for (var i = 0; i < images.length + existing.length; i++) IssueImage(url: 'u$i')];
          },
          markResolved: (note) async {
            calls.add('status');
            if (statusShouldFail) {
              throw const AppException(kind: AppErrorKind.network, message: 'mất mạng');
            }
          },
        );

    setUp(() {
      calls = [];
      statusShouldFail = false;
    });

    test('đúng thứ tự: upload rồi mới đổi trạng thái', () async {
      final f = flow()..pending.add(UploadImage(Uint8List(1)));
      expect(await f.run(), isA<ResolveDone>());
      expect(calls, ['upload:1', 'status']);
    });

    test('upload OK + đổi trạng thái lỗi → thử lại KHÔNG upload lại ảnh', () async {
      statusShouldFail = true;
      final f = flow()..pending.add(UploadImage(Uint8List(1)));
      expect(await f.run(), isA<ResolveStatusFailed>());
      expect(f.pending, isEmpty);
      expect(f.uploaded, isNotEmpty);

      statusShouldFail = false;
      expect(await f.run(), isA<ResolveDone>());
      expect(calls, ['upload:1', 'status', 'status']);
    });

    test('chưa có ảnh nào → không gọi đổi trạng thái (tránh NO_RESOLUTION_IMAGE)', () async {
      expect(await flow().run(), isA<ResolveNeedsPhotos>());
      expect(calls, isEmpty);
    });

    test('ảnh đã có trên server từ lần trước → chỉ đổi trạng thái', () async {
      final f = flow(existing: const [IssueImage(url: 'old')]);
      expect(await f.run(), isA<ResolveDone>());
      expect(calls, ['status']);
    });
  });

  group('SLA countdown — đủ 6 trạng thái (task 4.7)', () {
    final now = DateTime(2026, 10, 2, 12);
    String label(SlaStatus s) => s.wire;
    SlaDisplay show(SlaStatus s, {String status = 'processing', Duration? due}) => computeSlaDisplay(
          backendStatus: s,
          issueStatus: IssueStatus.parse(status),
          dueAt: due == null ? null : now.add(due),
          now: now,
          labelOf: label,
        );

    test('none', () => expect(show(SlaStatus.none).status, SlaStatus.none));

    test('on_time: "Còn …"', () {
      final d = show(SlaStatus.onTime, due: const Duration(hours: 2, minutes: 15));
      expect(d.status, SlaStatus.onTime);
      expect(d.label, 'Còn 2 giờ 15 phút');
    });

    test('due_soon giữ trạng thái backend', () {
      expect(show(SlaStatus.dueSoon, due: const Duration(hours: 3)).status, SlaStatus.dueSoon);
    });

    test('overdue: "Quá hạn …"', () {
      final d = show(SlaStatus.overdue, due: const Duration(hours: -5, minutes: -20));
      expect(d.status, SlaStatus.overdue);
      expect(d.label, 'Quá hạn 5 giờ 20 phút');
    });

    test('met / breached là trạng thái đóng, không đếm ngược', () {
      expect(show(SlaStatus.met, status: 'resolved', due: const Duration(hours: -1)).label, 'met');
      expect(show(SlaStatus.breached, status: 'resolved', due: const Duration(hours: -1)).status,
          SlaStatus.breached);
    });

    test('đồng hồ chạy qua hạn khi đang mở màn → đổi sang overdue ngay', () {
      final d = show(SlaStatus.onTime, due: const Duration(minutes: -1));
      expect(d.status, SlaStatus.overdue);
    });
  });

  group('Ảnh — chống chọn trùng + trần số ảnh (task 3.1)', () {
    PickedPhoto p(int b) {
      final bytes = Uint8List.fromList([0xFF, 0xD8, 0xFF, b]);
      return PickedPhoto(bytes: bytes, hash: photoHash(bytes), format: 'jpeg');
    }

    test('bỏ ảnh trùng theo hash', () {
      final r = mergePhotos([p(1)], [p(1), p(2)], maxImages: 5);
      expect(r.photos, hasLength(2));
      expect(r.duplicates, 1);
    });

    test('chọn 6 ảnh khi trần là 5 → giữ 5, báo 1 bị bỏ', () {
      final r = mergePhotos([], [for (var i = 0; i < 6; i++) p(i)], maxImages: 5);
      expect(r.photos, hasLength(5));
      expect(r.overflow, 1);
    });

    test('nhận diện định dạng bằng magic bytes', () {
      expect(detectImageFormat(Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0])), 'jpeg');
      expect(detectImageFormat(Uint8List.fromList([0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0])), 'png');
      expect(detectImageFormat(Uint8List.fromList('RIFF0000WEBP'.codeUnits)), 'webp');
      expect(detectImageFormat(Uint8List.fromList([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70])), isNull,
          reason: 'HEIC phải được chuyển sang JPEG — Cloudinary không nhận');
    });
  });

  group('Phiên bản (task 0.8)', () {
    test('so từng số, không so chuỗi', () {
      expect(compareVersions('1.2.10', '1.2.9'), 1);
      expect(compareVersions('1.0.0+5', '1.0.0'), 0);
    });

    test('thấp hơn min → buộc cập nhật; thấp hơn latest → chỉ gợi ý', () {
      const cfg = RemoteAppConfig(minSupportedVersion: '1.1.0', latestVersion: '1.3.0');
      expect(decideUpdate('1.0.9', cfg).force, isTrue);
      expect(decideUpdate('1.1.0', cfg).force, isFalse);
      expect(decideUpdate('1.1.0', cfg).available, isTrue);
      expect(decideUpdate('1.3.0', cfg).available, isFalse);
    });
  });

  test('thống kê: dữ liệu rỗng không chia 0 (task 2.8)', () {
    expect(safeShare(0, 0), 0);
    expect(safeShare(3, 0), 0);
    expect(safeShare(1, 4), 0.25);
  });
}
