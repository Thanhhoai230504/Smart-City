import '../../core/utils/json.dart';
import 'common.dart';

class IssueComment {
  const IssueComment({
    required this.id,
    required this.content,
    this.author,
    this.createdAt,
  });

  final String id;
  final String content;

  /// Populate `name email role` — role để gắn nhãn "Cán bộ" cạnh tên.
  final PersonRef? author;
  final DateTime? createdAt;

  bool get isFromHandler => author?.role == 'staff' || author?.role == 'admin';

  factory IssueComment.fromJson(Object? value) {
    final m = asMap(value);
    return IssueComment(
      id: refId(m) ?? '',
      content: asStringOr(m['content']),
      author: PersonRef.fromJson(m['userId']),
      createdAt: asDate(m['createdAt']),
    );
  }
}
