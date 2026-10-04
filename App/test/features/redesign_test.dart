import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:smart_city_app/data/models/issue.dart';
import 'package:smart_city_app/data/models/public_info.dart';
import 'package:smart_city_app/data/models/user.dart';
import 'package:smart_city_app/data/repositories/issue_repository.dart';
import 'package:smart_city_app/features/home/home_screen.dart';
import 'package:smart_city_app/features/issues/share_issue.dart';
import 'package:smart_city_app/features/issues/widgets/filter_bar.dart';
import 'package:smart_city_app/features/map/map_filters.dart';
import 'package:smart_city_app/features/notifications/notifications_screen.dart';
import 'package:smart_city_app/features/profile/badges_screen.dart';
import 'package:smart_city_app/features/staff/work_list_screen.dart';

import '../helpers/app_harness.dart';
import '../helpers/fixtures.dart';

List<Issue> _mapIssues() => [
      for (final i in (fixtureData('issues_map')['issues'] as List)) Issue.fromJson(i),
    ];

void main() {
  group('Bản đồ — lọc phía client như web', () {
    final issues = _mapIssues();
    final now = DateTime.utc(2026, 10, 2, 12);

    test('chỉ hiện việc đang mở', () {
      final closed = Issue.fromJson({
        ...(fixtureData('issues_map')['issues'] as List).first as Map<String, dynamic>,
        '_id': 'closed-1',
        'status': 'resolved',
      });
      final result = filterMapIssues([...issues, closed]);
      expect(result.every((i) => i.status.isOpen), isTrue);
      expect(result.any((i) => i.id == 'closed-1'), isFalse);
    });

    test('tìm theo tiêu đề hoặc địa chỉ, không phân biệt hoa thường', () {
      final first = issues.first;
      final word = first.title.split(' ').first.toUpperCase();
      final result = filterMapIssues(issues, search: word);
      expect(result, contains(first));
      expect(result.every((i) => '${i.title} ${i.location}'.toLowerCase().contains(word.toLowerCase())), isTrue);
    });

    test('bán kính quanh tâm: 0 = tất cả; bán kính rất nhỏ chỉ giữ điểm sát tâm', () {
      final first = issues.first;
      final center = LatLng(first.latitude, first.longitude);
      expect(filterMapIssues(issues, center: center, radiusKm: 0).length, issues.where((i) => i.status.isOpen).length);
      final near = filterMapIssues(issues, center: center, radiusKm: 1);
      expect(near, contains(first));
      final far = filterMapIssues(issues, center: const LatLng(21.0278, 105.8342), radiusKm: 20); // Hà Nội
      expect(far, isEmpty);
    });

    test('thời gian: 24 giờ giữ phiếu mới, 30 ngày giữ nhiều hơn hoặc bằng', () {
      final day = filterMapIssues(issues, time: '24h', now: now);
      final month = filterMapIssues(issues, time: '30d', now: now);
      expect(day.every((i) => now.difference(i.createdAt!).inHours <= 24), isTrue);
      expect(month.length, greaterThanOrEqualTo(day.length));
    });

    test('địa điểm theo loại đang bật', () {
      const hospital = Place(id: 'h', name: 'Bệnh viện C', type: 'hospital', latitude: 16.07, longitude: 108.22);
      const school = Place(id: 's', name: 'Trường A', type: 'school', latitude: 16.06, longitude: 108.21);
      expect(filterMapPlaces([hospital, school], types: {'hospital'}), [hospital]);
      expect(filterMapPlaces([hospital, school], types: {'hospital', 'school'}, search: 'trường'), [school]);
    });

    test('chỉ đường chỉ trong khu vực Đà Nẵng (GPS máy ảo mặc định ở Mỹ)', () {
      expect(isNearDaNang(const LatLng(16.061, 108.228), 150), isTrue); // Cầu Rồng
      expect(isNearDaNang(const LatLng(15.88, 108.33), 150), isTrue); // Hội An
      expect(isNearDaNang(const LatLng(37.422, -122.084), 150), isFalse); // Mountain View
    });

    test('mô tả tuyến: km có dấu phẩy, phút, kẹt xe chỉ hiện khi ≥ 1 phút', () {
      final d = describeRoute(const RouteResult(points: [], distanceMeters: 5230, durationSeconds: 840, trafficDelaySeconds: 180));
      expect(d.distance, '5,2 km');
      expect(d.duration, '14 phút');
      expect(d.delay, 'Kẹt xe thêm 3 phút');
      final short = describeRoute(const RouteResult(points: [], distanceMeters: 640, durationSeconds: 4500));
      expect(short.distance, '640 m');
      expect(short.duration, '1 giờ 15 phút');
      expect(short.delay, isNull);
    });
  });

  group('Dữ liệu mới từ API', () {
    test('EnvironmentReading — đúng hình dạng GET /environment', () {
      final e = EnvironmentReading.fromJson({
        'location': 'Quận Hải Châu, Đà Nẵng',
        'temperature': 32.1,
        'humidity': 66,
        'weatherCondition': 'Clouds',
        'weatherDescription': 'mây đen u ám',
        'latitude': 16.06,
        'longitude': 108.2208,
        'source': 'OpenWeatherMap',
      });
      expect(e.temperature, 32.1);
      expect(e.humidity, 66);
      expect(e.condition, 'Clouds');
      expect(e.hasPosition, isTrue);
      expect(EnvironmentReading.fromJson({'location': 'Không toạ độ'}).hasPosition, isFalse);
    });

    test('RouteResult — bỏ điểm hỏng, đọc tóm tắt', () {
      final r = RouteResult.fromJson({
        'distanceMeters': 1200,
        'durationSeconds': 300,
        'trafficDelaySeconds': 0,
        'points': [
          [16.05, 108.2],
          [16.06, 108.21],
          ['x', 1],
          [16.07],
        ],
      });
      expect(r.points, [(16.05, 108.2), (16.06, 108.21)]);
      expect(r.distanceMeters, 1200);
      expect(r.durationSeconds, 300);
    });

    test('IssueQuery — khoảng ngày gửi dạng YYYY-MM-DD và tính là một bộ lọc', () {
      final q = IssueQuery(dateFrom: DateTime(2026, 9, 3), dateTo: DateTime(2026, 10, 2));
      expect(q.toParams()['dateFrom'], '2026-09-03');
      expect(q.toParams()['dateTo'], '2026-10-02');
      expect(q.activeFilterCount, 1);
      expect(q.hasFilters, isTrue);
      expect(q.copyWith(dateFrom: null, dateTo: null).hasFilters, isFalse);
    });
  });

  group('Chia sẻ, lời chào, nhóm thông báo', () {
    test('link chia sẻ theo đường dẫn web /issues/:id; không có web https → không link', () {
      expect(issueShareLink('https://smartcity.example.vn', 'abc'), 'https://smartcity.example.vn/issues/abc');
      expect(issueShareLink(null, 'abc'), isNull);
      final issue = Issue.fromJson({'_id': 'abc', 'title': 'Ổ gà', 'location': 'Lê Duẩn'});
      expect(issueShareText(issue, 'https://x/issues/abc'), 'Ổ gà\nLê Duẩn\nhttps://x/issues/abc');
      expect(issueShareText(issue, null), 'Ổ gà\nLê Duẩn');
    });

    test('lời chào theo giờ, dùng tên gọi', () {
      expect(homeGreeting('Nguyễn Văn An', now: DateTime(2026, 10, 2, 8)), 'Chào buổi sáng, An');
      expect(homeGreeting('Hoai Nguyễn', now: DateTime(2026, 10, 2, 12)), 'Chào buổi trưa, Hoai');
      expect(homeGreeting(null, now: DateTime(2026, 10, 2, 15)), 'Chào buổi chiều!');
      expect(homeGreeting('An', now: DateTime(2026, 10, 2, 21)), 'Chào buổi tối, An');
    });

    test('thông báo nhóm theo ngày', () {
      final now = DateTime(2026, 10, 2, 9);
      expect(notificationBucket(DateTime(2026, 10, 2, 7), now: now), 'Hôm nay');
      expect(notificationBucket(DateTime(2026, 10, 1, 23), now: now), 'Hôm qua');
      expect(notificationBucket(DateTime(2026, 9, 20), now: now), 'Trước đó');
      expect(notificationBucket(null, now: now), 'Trước đó');
    });
  });

  group('Màn hình', () {
    testWidgets('chip "đang lọc" hiện từng bộ lọc, bấm ✕ bỏ đúng bộ lọc đó', (tester) async {
      final provider = StateProvider.autoDispose<IssueQuery>(
        (ref) => IssueQuery(category: 'pothole', dateFrom: DateTime(2026, 9, 1), dateTo: DateTime(2026, 9, 30)),
      );
      final container = await pumpScreen(
        tester,
        Scaffold(body: IssueFilterBar(provider: provider, total: 12, loading: false)),
      );
      await settleReal(tester);

      expect(find.text('12 sự cố'), findsOneWidget);
      expect(find.byType(InputChip), findsNWidgets(2));
      expect(find.text('01/09 – 30/09'), findsOneWidget);

      await tester.tap(find.byTooltip('Bỏ lọc 01/09 – 30/09'));
      await settleReal(tester);
      expect(container.read(provider).hasDateRange, isFalse);
      expect(container.read(provider).category, 'pothole');
    });

    testWidgets('cán bộ: 4 ô số liệu + "Nhận việc" chỉ ở phiếu đang mở chưa ai nhận', (tester) async {
      await pumpScreen(tester, const WorkListScreen(), user: demoUser(UserRole.staff), size: const Size(400, 1600));
      await settleReal(tester);
      await settleReal(tester);

      for (final label in ['Trong bộ lọc', 'Tôi đang làm', 'Quá hạn', 'Sắp đến hạn']) {
        expect(find.text(label), findsOneWidget, reason: label);
      }
      expect(find.text('Nhận việc'), findsOneWidget);
      // Lối tắt tới trang công khai mà trước đây cán bộ không vào được.
      expect(find.text('Thống kê'), findsOneWidget);
      expect(find.text('Trợ lý AI'), findsOneWidget);
    });

    testWidgets('khách xem được bảng xếp hạng, phần huy hiệu riêng mời đăng nhập', (tester) async {
      await pumpScreen(tester, const BadgesScreen());
      await settleReal(tester);

      expect(find.text('Đăng nhập để xem huy hiệu của bạn'), findsOneWidget);
      expect(find.text('Bảng xếp hạng người dân'), findsOneWidget);
      final first = (fixture('leaderboard')['data'] as List).first as Map;
      expect(find.text(first['name'] as String), findsOneWidget);
    });
  });
}
