import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smart_city_app/data/models/notification.dart';
import 'package:smart_city_app/data/models/user.dart';
import 'package:smart_city_app/data/socket/socket_service.dart';
import 'package:smart_city_app/features/issues/issue_detail_screen.dart';

import '../helpers/app_harness.dart';
import '../helpers/fake_http.dart';
import '../helpers/fixtures.dart';

AppNotification _notification(String type, {String? issueId = 'issue-1'}) => AppNotification.fromJson({
      '_id': 'n-$type',
      'type': type,
      'title': 'Tiêu đề',
      'message': 'Nội dung',
      'issueId': issueId,
      'isRead': false,
      'createdAt': '2026-10-04T10:00:00.000Z',
    });

/// Socket giả: chỉ thay luồng thông báo đến để test đẩy sự kiện vào tay.
class _FakeSocket extends SocketService {
  _FakeSocket(super.ref);

  final controller = StreamController<AppNotification>.broadcast();

  @override
  Stream<AppNotification> get incoming => controller.stream;

  @override
  Future<void> dispose() async {
    await controller.close();
    await super.dispose();
  }
}

void main() {
  group('Thông báo realtime làm mới đúng màn', () {
    Set<RealtimeTarget> targets(String type, {String? issueId = 'issue-1'}) =>
        SocketService.targetsFor(_notification(type, issueId: issueId));

    test('cán bộ được giao việc → danh sách "Công việc" (+ ô số liệu) và chi tiết phiếu', () {
      expect(targets('issue_assigned'), {RealtimeTarget.workList, RealtimeTarget.issueDetail});
    });

    test('nhắc hạn / thu hồi / bị mở lại cũng làm mới danh sách việc', () {
      for (final type in ['sla_reminder', 'sla_escalated', 'issue_unassigned', 'issue_reopened']) {
        expect(targets(type), contains(RealtimeTarget.workList), reason: type);
      }
    });

    test('người dân: đổi trạng thái / gộp phiếu → "Sự cố của tôi" + chi tiết, không đụng danh sách việc', () {
      for (final type in ['issue_updated', 'issue_resolved', 'issue_rejected', 'issue_merged']) {
        expect(targets(type), {RealtimeTarget.myIssues, RealtimeTarget.issueDetail}, reason: type);
      }
    });

    test('thông báo không gắn sự cố (quyết định khen thưởng đơn vị) không làm mới gì', () {
      expect(targets('department_evaluated', issueId: null), isEmpty);
    });
  });

  testWidgets('bình luận mới của phía bên kia hiện ngay trong màn chi tiết', (tester) async {
    final issue = fixtureData('issue_detail_guest')['issue'] as Map<String, dynamic>;
    final issueId = issue['_id'] as String;
    final comments = fixture('comments');
    var withReply = false;
    final base = fixtureBackend();
    final backend = FakeAdapter((o) {
      if (o.path == '/issues/$issueId/comments' && withReply) {
        final data = comments['data'] as Map<String, dynamic>;
        final first = Map<String, dynamic>.from((data['comments'] as List).first as Map);
        return FakeResponse(200, {
          'success': true,
          'data': {
            'comments': [
              ...data['comments'] as List,
              {...first, '_id': 'reply-1', 'content': 'Đơn vị đã ra hiện trường, chiều nay xong.'},
            ],
            'pagination': {...data['pagination'] as Map, 'total': 3},
          },
        });
      }
      return base.handler(o);
    });
    late _FakeSocket socket;
    await pumpScreen(
      tester,
      IssueDetailScreen(issueId: issueId),
      user: demoUser(UserRole.user),
      size: const Size(400, 4000),
      backend: backend,
      overrides: [socketServiceProvider.overrideWith((ref) => socket = _FakeSocket(ref))],
    );
    await settleReal(tester);
    expect(find.text('Đơn vị đã ra hiện trường, chiều nay xong.'), findsNothing);

    withReply = true;
    socket.controller.add(_notification('comment', issueId: issueId));
    await settleReal(tester);
    await settleReal(tester);

    expect(find.text('Đơn vị đã ra hiện trường, chiều nay xong.'), findsOneWidget);
  });
}
