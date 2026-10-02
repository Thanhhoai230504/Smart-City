import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smart_city_app/core/storage/prefs.dart';
import 'package:smart_city_app/data/models/meta.dart';
import 'package:smart_city_app/data/repositories/meta_repository.dart';

import '../helpers/fake_http.dart';
import '../helpers/fixtures.dart';

void main() {
  final live = MetaEnums.fromJson(fixtureData('meta_enums'));
  final bundled = MetaRepository.bundled;

  group('bản dự phòng đóng gói khớp API thật (phát hiện lệch)', () {
    test('cùng version', () => expect(bundled.version, live.version));

    test('cùng danh mục, nhãn, giờ SLA', () {
      expect(
        [for (final c in bundled.categories) '${c.value}|${c.label}|${c.slaHours}|${c.intakeHours}'],
        [for (final c in live.categories) '${c.value}|${c.label}|${c.slaHours}|${c.intakeHours}'],
      );
    });

    test('cùng bảng chuyển trạng thái', () {
      expect(bundled.statusTransitions, live.statusTransitions);
      expect(bundled.targetsFrom('reported'), isNot(contains('reported')),
          reason: 'reported không bao giờ là đích (E5)');
    });

    test('limits và reopen là object lồng (Phụ lục E.6), đọc đúng giá trị', () {
      expect(live.limits.maxImages, 5);
      expect(live.limits.maxNoteLength, 500);
      expect(live.reopen.maxCount, bundled.reopen.maxCount);
      expect(live.reopen.windowDays, bundled.reopen.windowDays);
    });

    test('đủ 14 loại thông báo', () => expect(live.notificationTypes, hasLength(14)));
  });

  group('MetaRepository — cache trên máy', () {
    late SharedPreferences prefs;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      prefs = await SharedPreferences.getInstance();
    });

    Dio dioReturning(Object body) =>
        Dio(BaseOptions(baseUrl: 'http://t/api'))..httpClientAdapter = FakeAdapter((_) => FakeResponse(200, body));

    test('cold start không mạng: chưa có cache → dùng bản đóng gói, vẫn có nhãn', () {
      final repo = MetaRepository(Dio()..httpClientAdapter = OfflineAdapter(), prefs);
      expect(repo.readCached(), isNull);
      expect(MetaRepository.bundled.isUsable, isTrue);
      expect(MetaRepository.bundled.categoryLabel('pothole'), 'Ổ gà');
    });

    test('tải thành công → lưu cache, lần mở sau đọc được khi offline', () async {
      final repo = MetaRepository(dioReturning(fixture('meta_enums')), prefs);
      await repo.fetch();
      expect(repo.readCached()?.version, live.version);
    });

    test('payload hỏng (thiếu danh mục) KHÔNG ghi đè cache tốt', () async {
      await prefs.setString(PrefKeys.metaCache, jsonEncode(fixtureData('meta_enums')));
      final repo = MetaRepository(dioReturning({'success': true, 'data': {'version': 'x', 'categories': <Object>[]}}), prefs);
      final fetched = await repo.fetch();
      expect(fetched.isUsable, isFalse);
      expect(repo.readCached()?.version, live.version);
    });

    test('cache hỏng JSON → bỏ qua, không crash', () async {
      await prefs.setString(PrefKeys.metaCache, '{hỏng');
      expect(MetaRepository(Dio(), prefs).readCached(), isNull);
    });
  });

  test('nhãn lạ trả về chính giá trị — loại backend thêm sau khi app phát hành', () {
    expect(live.notificationTypeLabel('loai_moi_2027'), 'loai_moi_2027');
    expect(live.category('loai_moi').icon, '📌');
  });
}
