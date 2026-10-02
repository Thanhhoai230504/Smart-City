import 'package:flutter_test/flutter_test.dart';
import 'package:smart_city_app/core/utils/json.dart';
import 'package:smart_city_app/data/models/comment.dart';
import 'package:smart_city_app/data/models/common.dart';
import 'package:smart_city_app/data/models/issue.dart';
import 'package:smart_city_app/data/models/notification.dart';
import 'package:smart_city_app/data/models/public_info.dart';
import 'package:smart_city_app/data/models/report_support.dart';
import 'package:smart_city_app/data/models/user.dart';

import '../helpers/fixtures.dart';

/// Task 0.6 — parse bằng JSON **lấy thật từ API đang chạy** (tool/capture_fixtures.js),
/// không tự bịa. DB demo có phiếu đã phân công, đã `resolved` kèm ảnh minh chứng,
/// `statusHistory[].changedBy` đã populate — nên các field union không `null`
/// và test không "pass giả".
void main() {
  List<Issue> issuesOf(String name) =>
      [for (final i in asList(fixtureData(name)['issues'])) Issue.fromJson(i)];

  group('Issue — union type (chuỗi id hoặc object populate)', () {
    test('chi tiết cho cán bộ: populate đủ người/đơn vị, có phone + email', () {
      final issue = Issue.fromJson(fixtureData('issue_detail_staff')['issue']);

      expect(issue.id, isNotEmpty);
      expect(issue.status, IssueStatus.processing);
      expect(issue.reporter?.isPopulated, isTrue);
      expect(issue.reporter?.email, isNotNull, reason: 'cán bộ thấy email người báo cáo');
      expect(issue.phone, isNotNull, reason: 'cán bộ thấy phone — dùng cho nút GỌI');
      expect(issue.department?.name, isNotNull);
      expect(issue.department?.phone, isNotNull);
      expect(issue.assignee?.name, isNotNull);
      expect(issue.dueAt, isNotNull);
      expect(issue.slaStatus, isNot(SlaStatus.none));
      expect(issue.statusHistory, isNotEmpty);
      expect(issue.statusHistory.every((h) => h.changedBy?.name != null), isTrue,
          reason: 'E2: timeline "ai làm gì" populate changedBy');
      expect(issue.priorityFactors, isNotEmpty);
      expect(issue.priorityLevel, isNotNull);
      expect(issue.intakeDueAt, isNotNull);
    });

    test('chi tiết cho khách: KHÔNG có phone, người dùng chỉ có tên', () {
      final issue = Issue.fromJson(fixtureData('issue_detail_guest')['issue']);

      expect(issue.status, IssueStatus.resolved);
      expect(issue.phone, isNull, reason: 'backend che PII ở tầng truy vấn');
      expect(issue.reporter?.name, isNotNull);
      expect(issue.reporter?.email, isNull);
      expect(issue.resolutionImages, isNotEmpty);
      // `uploadedBy` không populate ở route này → chỉ có id.
      expect(issue.resolutionImages.first.uploadedBy?.id, isNotEmpty);
      expect(issue.resolutionImages.first.uploadedBy?.isPopulated, isFalse);
      expect(issue.resolvedAt, isNotNull);
      expect(issue.slaStatus, anyOf(SlaStatus.met, SlaStatus.breached));
    });

    test('phiếu bị từ chối: không có resolvedAt, mốc đóng lấy từ statusHistory', () {
      final issue = Issue.fromJson(fixtureData('issue_detail_rejected_reporter')['issue']);

      expect(issue.status, IssueStatus.rejected);
      expect(issue.resolvedAt, isNull);
      expect(issue.closedAt, isNotNull);
      expect(issue.closedAt, issue.statusHistory.last.changedAt);
      expect(issue.latestNote, contains('Cấp nước'));
    });

    test('danh sách công khai: payload gọn, mảng lớn vắng mặt nhưng không crash', () {
      final issues = issuesOf('issues_list_guest');
      expect(issues, isNotEmpty);
      for (final i in issues) {
        expect(i.id, isNotEmpty);
        expect(i.statusHistory, isEmpty, reason: 'list không select statusHistory');
        expect(i.reporter?.email, isNull, reason: 'khách không thấy email');
      }
      expect(issues.any((i) => i.reopenCount > 0), isTrue, reason: 'G8: list có reopenCount');
      expect(issues.any((i) => i.department?.name != null), isTrue);
    });

    test('chế độ bản đồ: ~10 field, mọi field khác về mặc định an toàn', () {
      final issues = issuesOf('issues_map');
      expect(issues, isNotEmpty);
      for (final i in issues) {
        expect(i.status.isOpen, isTrue, reason: 'view=map chỉ trả việc đang mở');
        expect(i.latitude, isNonZero);
        expect(i.department, isNull);
        expect(i.slaStatus, SlaStatus.none);
      }
    });

    test('danh sách việc cán bộ chỉ chứa phiếu của đơn vị mình', () {
      final issues = issuesOf('work_list_staff');
      expect(issues, isNotEmpty);
      final departments = {for (final i in issues) i.department?.id};
      expect(departments, hasLength(1), reason: 'service bó phạm vi theo đơn vị');
      expect(issues.every((i) => i.category == 'pothole'), isTrue);
    });

    test('nearby kèm khoảng cách', () {
      final list = [for (final n in asList(fixtureData('nearby')['issues'])) NearbyIssue.fromJson(n)];
      expect(list, isNotEmpty);
      expect(list.first.distanceMeters, greaterThanOrEqualTo(0));
    });

    test('summary của tôi', () {
      final s = IssueSummary.fromJson(fixtureData('my_summary')['summary']);
      expect(s.total, s.reported + s.processing + s.resolved + s.rejected);
    });

    test('enum lạ không crash — rơi về giá trị an toàn', () {
      final issue = Issue.fromJson({
        '_id': 'x',
        'status': 'archived',
        'slaStatus': 'weird',
        'priorityLevel': 'urgent',
        'latitude': '16.05',
        'voteCount': 3.0,
      });
      expect(issue.status, IssueStatus.unknown);
      expect(issue.slaStatus, SlaStatus.none);
      expect(issue.priorityLevel, isNull);
      expect(issue.latitude, 16.05);
      expect(issue.voteCount, 3);
    });
  });

  group('Auth + người dùng', () {
    test('login trả `id` (không phải `_id`) và refresh token trong body cho mobile', () {
      final data = fixtureData('login_mobile');
      final user = AppUser.fromJson(data['user']);
      expect(user.id, isNotEmpty);
      expect(user.role, UserRole.user);
      expect(data['refreshToken'], isNotNull, reason: 'deviceType=android → token trong body');
    });

    test('mã hoá/giải mã hồ sơ cache giữ nguyên dữ liệu', () {
      final user = AppUser.fromJson(fixtureData('login_mobile')['user']);
      final back = AppUser.decode(user.encode());
      expect(back?.id, user.id);
      expect(back?.email, user.email);
      expect(AppUser.decode('{hỏng'), isNull);
    });
  });

  group('Dữ liệu phụ', () {
    test('thông báo + số chưa đọc', () {
      final page = NotificationPage.fromJson(fixtureData('notifications'));
      expect(page.items, isNotEmpty);
      expect(page.unreadCount, page.items.where((n) => !n.isRead).length);
      expect(page.items.first.issueId, isNotNull);
    });

    test('bình luận có role để gắn nhãn cán bộ', () {
      final comments = [for (final c in asList(fixtureData('comments')['comments'])) IssueComment.fromJson(c)];
      expect(comments, isNotEmpty);
      expect(comments.any((c) => c.isFromHandler), isTrue);
      expect(Pagination.fromJson(fixtureData('comments')['pagination']).total, comments.length);
    });

    test('thống kê công khai', () {
      final s = PublicStatistics.fromJson(fixtureData('statistics'));
      expect(s.totalIssues, greaterThan(0));
      expect(s.byStatus.keys, containsAll(['reported', 'processing', 'resolved', 'rejected']));
      expect(s.ratingDistribution.keys, [1, 2, 3, 4, 5]);
      expect(s.byDistrict, isNotEmpty);
    });

    test('bảng xếp hạng: API trả MẢNG trực tiếp trong data', () {
      final raw = fixture('leaderboard')['data'];
      expect(raw, isA<List<dynamic>>());
      final list = [for (final e in raw as List) LeaderboardEntry.fromJson(e)];
      expect(list.first.rank, 1);
    });

    test('huy hiệu của tôi: 5 cấp', () {
      final b = BadgeProgress.fromJson(fixtureData('badges_me'));
      expect(b.allBadges.map((x) => x.threshold), [1, 5, 10, 20, 50]);
    });

    test('camera có URL dựng sẵn từ server', () {
      final cams = [for (final c in asList(fixtureData('cameras')['cameras'])) PublicCamera.fromJson(c)];
      expect(cams, isNotEmpty);
      expect(cams.every((c) => c.embedUrl.startsWith('https://')), isTrue);
    });

    test('dò trùng: lexical fallback có nhãn riêng', () {
      final r = DuplicateResult.fromJson(fixtureData('duplicate_candidates'));
      expect(r.candidates, isNotEmpty);
      expect(r.isFallback, isTrue, reason: 'embedding tắt ở DB demo → lexical_fallback');
      expect(r.candidates.first.reasons, isNotEmpty);
      expect(r.candidates.first.issue.title, isNotEmpty);
    });

    test('cấu hình phiên bản app (0.8)', () {
      final c = RemoteAppConfig.fromJson(fixtureData('app_config'));
      expect(c.minSupportedVersion, '1.0.0');
    });
  });
}
