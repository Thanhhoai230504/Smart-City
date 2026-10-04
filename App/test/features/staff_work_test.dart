import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smart_city_app/data/models/user.dart';
import 'package:smart_city_app/data/repositories/issue_repository.dart';
import 'package:smart_city_app/features/issues/widgets/filter_bar.dart';
import 'package:smart_city_app/features/staff/staff_issue_screen.dart';
import 'package:smart_city_app/features/staff/work_list_screen.dart';

import '../helpers/app_harness.dart';
import '../helpers/fake_http.dart';
import '../helpers/fixtures.dart';

Map<String, dynamic> _copy(Object? json) => Map<String, dynamic>.from(json as Map);

/// `fixtureBackend` trả nguyên danh sách `/issues/work` cho mọi truy vấn; ở đây
/// lọc thật theo `assigneeId` / `status` / `slaStatus` (để tab "Việc của tôi" và
/// các ô đếm có số đúng), nhận `PATCH /:id/status`, và cho đổi phiếu chi tiết.
FakeAdapter _workBackend({Map<String, dynamic>? detail}) {
  final fallback = fixtureBackend();
  final issues = [for (final i in fixtureData('work_list_staff')['issues'] as List) _copy(i)];
  return FakeAdapter((o) {
    final q = o.queryParameters;
    if (o.path == '/issues/work') {
      final rows = issues.where((i) {
        final ref = i['assigneeId'];
        final assignee = ref is Map ? ref['_id'] : ref;
        if (q['assigneeId'] != null && assignee != q['assigneeId']) return false;
        if (q['status'] != null && i['status'] != q['status']) return false;
        if (q['slaStatus'] != null && i['slaStatus'] != q['slaStatus']) return false;
        return true;
      }).toList();
      final limit = q['limit'] as int? ?? 15;
      return FakeResponse(200, {
        'success': true,
        'data': {
          'issues': rows.take(limit).toList(),
          'pagination': {'current': 1, 'pages': 1, 'total': rows.length, 'limit': limit},
        },
      });
    }
    final status = RegExp(r'^/issues/([0-9a-f]{24})/status$').firstMatch(o.path);
    if (status != null && o.method == 'PATCH') {
      final issue = issues.firstWhere((i) => i['_id'] == status.group(1));
      return FakeResponse(200, {
        'success': true,
        'data': {
          'issue': {...issue, 'status': (o.data as Map)['status']},
        },
      });
    }
    if (detail != null && o.path == '/issues/${detail['_id']}') {
      return FakeResponse(200, {
        'success': true,
        'data': {'issue': detail},
      });
    }
    return fallback.handler(o);
  });
}

/// Các lượt tải danh sách (bỏ qua truy vấn đếm `limit=1` của ô số liệu).
List<RequestOptions> _listRequests(FakeAdapter backend) =>
    backend.requests.where((r) => r.path == '/issues/work' && r.queryParameters['limit'] != 1).toList();

void main() {
  final staffIssue = fixtureData('issue_detail_staff')['issue'] as Map<String, dynamic>;

  group('Cán bộ — tab "Việc của tôi"', () {
    testWidgets('chỉ phiếu mình giữ (assigneeId = mình), số trên tab = phiếu còn mở', (tester) async {
      final backend = _workBackend();
      await pumpScreen(tester, const WorkListScreen(),
          user: demoUser(UserRole.staff), size: const Size(400, 2600), backend: backend);
      await settleReal(tester);
      await settleReal(tester);

      // Tab đơn vị: phiếu chưa ai nhận có "Nhận việc"; phiếu mình đang xử lý có
      // sẵn "Cập nhật" + "Hoàn tất" — không phải mở chi tiết mới thấy.
      expect(find.text('Nhận việc'), findsOneWidget);
      expect(find.text('Hoàn tất'), findsNWidgets(2));
      // Fixture: Lê Minh Cường giữ 4 phiếu, 2 còn mở (đang xử lý).
      expect(find.bySemanticsLabel('Việc của tôi: 2 việc đang mở'), findsOneWidget);

      await tester.tap(find.text('Việc của tôi'));
      await settleReal(tester);
      await settleReal(tester);

      expect(_listRequests(backend).last.queryParameters['assigneeId'], staffDemoId);
      expect(find.text('Phiếu bạn đã nhận'), findsOneWidget);
      expect(find.text('4 sự cố'), findsOneWidget);
      expect(find.text('Nhận việc'), findsNothing);
      // Phiếu đã xử lý / từ chối không còn nút; 2 phiếu đang xử lý thì có.
      expect(find.text('Hoàn tất'), findsNWidgets(2));
      expect(find.text('Cập nhật'), findsNWidgets(2));
      // Người phụ trách bị khoá theo tab — không hiện thành chip "đang lọc".
      expect(find.byType(InputChip), findsNothing);
    });

    testWidgets('ô "Tôi đang làm" mở thẳng tab của mình; quay lại tab đơn vị giữ nguyên bộ lọc', (tester) async {
      final backend = _workBackend();
      final container = await pumpScreen(tester, const WorkListScreen(),
          user: demoUser(UserRole.staff), size: const Size(400, 2600), backend: backend);
      await settleReal(tester);
      await settleReal(tester);

      await tester.tap(find.text('Quá hạn').first);
      await settleReal(tester);
      expect(container.read(workQueryProvider(WorkScope.department)).slaStatus, 'overdue');

      await tester.tap(find.text('Tôi đang làm'));
      await settleReal(tester);
      expect(container.read(workScopeProvider), WorkScope.mine);
      expect(_listRequests(backend).last.queryParameters['assigneeId'], staffDemoId);

      await tester.tap(find.text('Việc đơn vị'));
      await settleReal(tester);
      expect(container.read(workQueryProvider(WorkScope.department)).slaStatus, 'overdue');
      expect(_listRequests(backend).last.queryParameters['slaStatus'], 'overdue');
      expect(_listRequests(backend).last.queryParameters.containsKey('assigneeId'), isFalse);
    });

    testWidgets('"Cập nhật" → Từ chối bắt buộc lý do → PATCH trạng thái kèm ghi chú', (tester) async {
      final backend = _workBackend();
      await pumpScreen(tester, const WorkListScreen(),
          user: demoUser(UserRole.staff), size: const Size(400, 2600), backend: backend);
      await settleReal(tester);
      await settleReal(tester);
      await tester.tap(find.text('Việc của tôi'));
      await settleReal(tester);
      await settleReal(tester);

      await tester.tap(find.text('Cập nhật').first);
      await settleReal(tester);
      expect(find.text('Hoàn tất (chụp ảnh minh chứng)'), findsOneWidget);
      await tester.tap(find.text('Từ chối (cần nêu lý do)'));
      await settleReal(tester);

      final confirm = find.widgetWithText(FilledButton, 'Xác nhận');
      expect(tester.widget<FilledButton>(confirm).onPressed, isNull);
      await tester.enterText(find.byType(TextField), 'Không thuộc phạm vi đơn vị');
      await tester.pump();
      expect(tester.widget<FilledButton>(confirm).onPressed, isNotNull);
      await tester.tap(confirm);
      await settleReal(tester);
      await settleReal(tester);

      final patch = backend.requests.lastWhere((r) => r.method == 'PATCH');
      expect(patch.path, endsWith('/status'));
      expect((patch.data as Map)['status'], 'rejected');
      expect((patch.data as Map)['note'], 'Không thuộc phạm vi đơn vị');
      expect(find.textContaining('sang “Từ chối”'), findsOneWidget);
    });

    testWidgets('"Hoàn tất" trên thẻ: tải bản đầy đủ rồi mới mở màn chụp ảnh minh chứng', (tester) async {
      // Danh sách không có `resolutionImages` → nếu dùng thẳng thẻ, ảnh đã tải
      // lên lần trước bị coi như chưa có và cán bộ phải chụp lại.
      const mineId = '6abf1d2f954088cb98914249';
      final row = (fixtureData('work_list_staff')['issues'] as List)
          .cast<Map<String, dynamic>>()
          .firstWhere((i) => i['_id'] == mineId);
      final backend = _workBackend(detail: {
        ..._copy(row),
        'resolutionImages': [
          {'url': 'https://res.cloudinary.com/demo/image/upload/after.jpg', 'publicId': 'after'},
        ],
      });
      await pumpScreen(tester, const WorkListScreen(),
          user: demoUser(UserRole.staff), size: const Size(400, 2600), backend: backend);
      await settleReal(tester);
      await settleReal(tester);
      await tester.tap(find.text('Việc của tôi'));
      await settleReal(tester);
      await settleReal(tester);

      await tester.tap(find.text('Hoàn tất').first);
      await settleReal(tester);
      await settleReal(tester);

      expect(backend.requests.any((r) => r.path == '/issues/$mineId'), isTrue);
      expect(find.text('Hoàn tất xử lý'), findsOneWidget);
      expect(find.text('1/5 ảnh'), findsOneWidget);
    });

    testWidgets('bộ lọc gốc: người phụ trách bị khoá không thành chip, "Xoá lọc" giữ lại', (tester) async {
      const base = IssueQuery(sort: '-priorityScore', assigneeId: 'me');
      final provider = StateProvider.autoDispose<IssueQuery>((ref) => base.copyWith(category: 'pothole'));
      final container = await pumpScreen(
        tester,
        Scaffold(
          body: IssueFilterBar(provider: provider, total: 3, loading: false, staffMode: true, baseQuery: base),
        ),
      );
      await settleReal(tester);

      expect(find.byType(InputChip), findsOneWidget);
      expect(find.text('Việc tôi đang nhận'), findsNothing);
      await tester.tap(find.text('Xoá lọc'));
      await settle(tester);
      final q = container.read(provider);
      expect(q.category, isNull);
      expect(q.assigneeId, 'me');
      expect(q.sort, '-priorityScore');
    });
  });

  group('Cán bộ — màn xử lý có thanh thao tác cố định', () {
    testWidgets('phiếu của mình: "Cập nhật" + "Hoàn tất" luôn thấy ở đáy, không phải cuộn', (tester) async {
      await pumpScreen(tester, StaffIssueScreen(issueId: staffIssue['_id'] as String),
          user: demoUser(UserRole.staff), backend: _workBackend());
      await settleReal(tester);

      expect(find.text('Hoàn tất').hitTestable(), findsOneWidget);
      expect(find.text('Cập nhật').hitTestable(), findsOneWidget);

      await tester.tap(find.text('Cập nhật'));
      await settleReal(tester);
      expect(find.text('Từ chối (cần nêu lý do)'), findsOneWidget);
    });

    testWidgets('phiếu chưa ai nhận: thanh dưới là "Nhận việc để xử lý"', (tester) async {
      await pumpScreen(tester, StaffIssueScreen(issueId: staffIssue['_id'] as String),
          user: demoUser(UserRole.staff), backend: _workBackend(detail: {...staffIssue, 'assigneeId': null}));
      await settleReal(tester);
      expect(find.text('Nhận việc để xử lý').hitTestable(), findsOneWidget);
      expect(find.text('Hoàn tất'), findsNothing);
    });

    testWidgets('phiếu người khác giữ: không có nút đổi trạng thái (như web)', (tester) async {
      final other = {
        ...staffIssue,
        'assigneeId': {'_id': '6abf1d2e954088cb98914222', 'name': 'Phạm Thu Dung'},
      };
      await pumpScreen(tester, StaffIssueScreen(issueId: staffIssue['_id'] as String),
          user: demoUser(UserRole.staff), backend: _workBackend(detail: other));
      await settleReal(tester);
      expect(find.text('Nhận việc để xử lý'), findsNothing);
      expect(find.text('Hoàn tất'), findsNothing);
      expect(find.text('Chỉ cán bộ đang phụ trách mới cập nhật được trạng thái.'), findsOneWidget);
    });
  });
}
