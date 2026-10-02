import '../../core/utils/json.dart';
import 'common.dart';

class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.isRead,
    this.issueId,
    this.createdAt,
  });

  final String id;

  /// Giữ chuỗi: backend có 14 loại (Phụ lục E.5) và có thể thêm loại mới sau
  /// khi app đã phát hành — icon phải có nhánh mặc định.
  final String type;
  final String title;
  final String message;
  final bool isRead;
  final String? issueId;
  final DateTime? createdAt;

  factory AppNotification.fromJson(Object? value) {
    final m = asMap(value);
    return AppNotification(
      id: refId(m) ?? '',
      type: asStringOr(m['type'], 'issue_updated'),
      title: asStringOr(m['title']),
      message: asStringOr(m['message']),
      isRead: asBool(m['isRead']),
      issueId: refId(m['issueId']),
      createdAt: asDate(m['createdAt']),
    );
  }

  AppNotification markRead() => AppNotification(
        id: id,
        type: type,
        title: title,
        message: message,
        isRead: true,
        issueId: issueId,
        createdAt: createdAt,
      );
}

class NotificationPage {
  const NotificationPage(this.items, this.unreadCount, this.pagination);

  final List<AppNotification> items;
  final int unreadCount;
  final Pagination pagination;

  factory NotificationPage.fromJson(Object? data) {
    final m = asMap(data);
    return NotificationPage(
      [for (final n in asList(m['notifications'])) AppNotification.fromJson(n)],
      asInt(m['unreadCount']) ?? 0,
      Pagination.fromJson(m['pagination']),
    );
  }
}
