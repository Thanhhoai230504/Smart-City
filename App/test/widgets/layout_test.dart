import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smart_city_app/core/widgets/offline_banner.dart';
import 'package:smart_city_app/core/widgets/status_chips.dart';
import 'package:smart_city_app/data/models/issue.dart';
import 'package:smart_city_app/data/models/user.dart';
import 'package:smart_city_app/features/auth/login_screen.dart';
import 'package:smart_city_app/features/auth/register_screen.dart';
import 'package:smart_city_app/features/home/home_screen.dart';
import 'package:smart_city_app/features/issues/issue_detail_screen.dart';
import 'package:smart_city_app/features/issues/issue_list_screen.dart';
import 'package:smart_city_app/features/issues/widgets/issue_card.dart';
import 'package:smart_city_app/features/notifications/notifications_screen.dart';
import 'package:smart_city_app/features/profile/profile_screen.dart';
import 'package:smart_city_app/features/public_info/statistics_screen.dart';
import 'package:smart_city_app/features/report/report_screen.dart';
import 'package:smart_city_app/features/staff/staff_issue_screen.dart';
import 'package:smart_city_app/features/staff/work_list_screen.dart';

import '../helpers/app_harness.dart';
import '../helpers/fixtures.dart';

/// Nghiệm thu 0.5 (thay golden test): mỗi màn chính dựng ở **cả hai theme** và
/// **textScale 1.6** trên màn 360dp — RenderFlex tràn sẽ ném lỗi và làm test đỏ.
/// Dùng layout test thay ảnh golden vì golden render khác nhau giữa Windows và
/// Linux CI; thứ cần bảo đảm là "không vỡ layout, không tràn chữ".
void main() {
  final guestIssueId = (fixtureData('issue_detail_guest')['issue'] as Map)['_id'] as String;
  final staffIssueId = (fixtureData('issue_detail_staff')['issue'] as Map)['_id'] as String;

  final screens = <String, (Widget Function(), UserRole?)>{
    'Đăng nhập': (() => const LoginScreen(), null),
    'Đăng ký': (() => const RegisterScreen(), null),
    'Trang chủ': (() => const HomeScreen(), UserRole.user),
    'Danh sách sự cố': (() => const IssueListScreen(), null),
    'Chi tiết sự cố (đã xử lý)': (() => IssueDetailScreen(issueId: guestIssueId), UserRole.user),
    'Công việc cán bộ': (() => const WorkListScreen(), UserRole.staff),
    'Xử lý sự cố (cán bộ)': (() => StaffIssueScreen(issueId: staffIssueId), UserRole.staff),
    'Thông báo': (() => const NotificationsScreen(), UserRole.user),
    'Cá nhân': (() => const ProfileScreen(), UserRole.user),
    'Thống kê': (() => const StatisticsScreen(), null),
    'Báo cáo — bước 1': (() => const ReportScreen(), UserRole.user),
  };

  for (final MapEntry(key: name, value: (build, role)) in screens.entries) {
    for (final brightness in Brightness.values) {
      for (final scale in [1.0, 1.6]) {
        testWidgets('$name · ${brightness.name} · chữ ×$scale — không tràn layout', (tester) async {
          await pumpScreen(
            tester,
            build(),
            brightness: brightness,
            textScale: scale,
            user: role == null ? null : demoUser(role),
          );
          await settleReal(tester);
          expect(tester.takeException(), isNull);
        });
      }
    }
  }

  testWidgets('chip trạng thái có đủ 3 kênh: màu + icon + nhãn chữ (design system 6.1)', (tester) async {
    await pumpScreen(tester, const Scaffold(body: Center(child: StatusChip(IssueStatus.processing))));
    expect(find.text('Đang xử lý'), findsOneWidget);
    expect(find.byIcon(Icons.engineering), findsOneWidget);
    expect(find.bySemanticsLabel('Trạng thái: Đang xử lý'), findsOneWidget);
  });

  testWidgets('OfflineBanner: ẩn khi có mạng và không có phiếu chờ, hiện thường trực khi offline', (tester) async {
    await pumpScreen(tester, const Scaffold(body: OfflineBanner(online: true, pendingCount: 0)));
    expect(find.byType(Icon), findsNothing);

    await pumpScreen(tester, const Scaffold(body: OfflineBanner(online: false, pendingCount: 3)));
    expect(find.textContaining('3 báo cáo đang chờ gửi'), findsOneWidget);
  });

  testWidgets('người dân thường KHÔNG thấy nút GỌI — `phone` không có trong response', (tester) async {
    await pumpScreen(tester, IssueDetailScreen(issueId: guestIssueId), user: demoUser(UserRole.user));
    await settleReal(tester);
    expect(find.textContaining('GỌI'), findsNothing);
    expect(find.textContaining('Số liên hệ của người báo cáo'), findsNothing);
  });

  testWidgets('cán bộ thấy nút GỌI người báo cáo (task 4.4)', (tester) async {
    await pumpScreen(tester, StaffIssueScreen(issueId: staffIssueId), user: demoUser(UserRole.staff));
    await settleReal(tester);
    expect(find.textContaining('GỌI 09'), findsOneWidget);
  });

  testWidgets('cán bộ: tab đầu là "Công việc" từ /issues/work', (tester) async {
    await pumpScreen(tester, const WorkListScreen(), user: demoUser(UserRole.staff));
    await settleReal(tester);
    expect(find.text('Công việc'), findsOneWidget);
    // Sắp theo điểm ưu tiên: phiếu quá hạn của đơn vị đứng đầu.
    expect(find.byType(IssueCard), findsWidgets);
    expect(find.textContaining('Quá hạn'), findsWidgets);
  });
}
