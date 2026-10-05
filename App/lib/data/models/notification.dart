import '../../core/utils/json.dart';
import 'common.dart';

/// Emoji / ký hiệu đầu tiêu đề (📋 📍 ⚠️ 🔄 📥 …) kèm khoảng trắng sau nó.
final _leadingSymbols = RegExp(
  r'^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\s]+',
  unicode: true,
);

/// Tiêu đề trạng thái kiểu cũ — backend từng ghép thẳng nhãn ("Sự cố Đã xử lý").
const _legacyStatusTitles = {
  'Sự cố Đang xử lý': 'Sự cố đang được xử lý',
  'Sự cố Đã xử lý': 'Sự cố đã được xử lý',
  'Sự cố Từ chối': 'Sự cố bị từ chối',
};

/// Tiêu đề để hiển thị: app đã có icon riêng cho từng loại nên bỏ emoji đầu
/// dòng, và sửa tiêu đề trạng thái kiểu cũ. Thông báo lưu trong DB trước bản sửa
/// backend vẫn mang hai dạng đó.
String notificationDisplayTitle(String raw) {
  final title = raw.replaceFirst(_leadingSymbols, '');
  return _legacyStatusTitles[title] ?? title;
}

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

  String get displayTitle => notificationDisplayTitle(title);

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
