import '../../data/models/issue.dart';
import '../../data/models/meta.dart';

/// Lý do không được mở lại — trùng mã lỗi backend (Phụ lục E.1).
enum ReopenBlock {
  mergedIssue('MERGED_ISSUE'),
  notReporter('NOT_REPORTER'),
  notClosed('ISSUE_NOT_CLOSED'),
  limitReached('REOPEN_LIMIT_REACHED'),
  windowExpired('REOPEN_WINDOW_EXPIRED');

  const ReopenBlock(this.code);
  final String code;

  static ReopenBlock? fromCode(String? code) {
    for (final b in ReopenBlock.values) {
      if (b.code == code) return b;
    }
    return null;
  }

  /// Mỗi mã một câu giải thích khác nhau (nghiệm thu 3.8).
  String explain(ReopenPolicy policy) => switch (this) {
        ReopenBlock.mergedIssue => 'Báo cáo này đã được gộp — hãy mở lại sự cố gốc.',
        ReopenBlock.notReporter => 'Chỉ người báo cáo mới mở lại được sự cố này.',
        ReopenBlock.notClosed => 'Sự cố chưa đóng nên chưa thể mở lại.',
        ReopenBlock.limitReached =>
          'Bạn đã dùng hết ${policy.maxCount} lượt mở lại. Vui lòng liên hệ trực tiếp đơn vị phụ trách.',
        ReopenBlock.windowExpired =>
          'Đã quá ${policy.windowDays} ngày kể từ khi đóng phiếu nên không thể mở lại.',
      };

  /// Có nên hiện thẻ "Chưa hài lòng?" kèm lý do không. Với người không phải
  /// người báo cáo hay phiếu chưa đóng thì ẩn hẳn.
  bool get showReason => this == limitReached || this == windowExpired || this == mergedIssue;
}

class ReopenEligibility {
  const ReopenEligibility.allowed(this.daysLeft) : block = null;
  const ReopenEligibility.blocked(ReopenBlock this.block) : daysLeft = null;

  final ReopenBlock? block;

  /// Số ngày còn được mở lại; `null` khi phiếu cũ thiếu mốc đóng (không chặn).
  final int? daysLeft;

  bool get allowed => block == null;
}

/// Kiểm **cùng thứ tự với `checkCanReopen` ở backend** để client không hứa
/// một điều server sẽ từ chối. Đúng ngày thứ `windowDays` vẫn được (backend
/// dùng `days > windowDays`). Backend vẫn là nơi phán quyết cuối.
ReopenEligibility reopenEligibility(
  Issue issue,
  String? userId,
  ReopenPolicy policy, {
  DateTime? now,
}) {
  if (issue.isMerged) return const ReopenEligibility.blocked(ReopenBlock.mergedIssue);
  final reporter = issue.reporter?.id;
  if (userId == null || reporter == null || reporter != userId) {
    return const ReopenEligibility.blocked(ReopenBlock.notReporter);
  }
  if (!issue.status.isClosed) return const ReopenEligibility.blocked(ReopenBlock.notClosed);
  if (issue.reopenCount >= policy.maxCount) {
    return const ReopenEligibility.blocked(ReopenBlock.limitReached);
  }

  final closedAt = issue.closedAt;
  if (closedAt == null) return const ReopenEligibility.allowed(null);
  final days = (now ?? DateTime.now()).difference(closedAt).inMilliseconds / Duration.millisecondsPerDay;
  if (days > policy.windowDays) return const ReopenEligibility.blocked(ReopenBlock.windowExpired);
  final left = (policy.windowDays - days).floor();
  return ReopenEligibility.allowed(left < 0 ? 0 : left);
}

/// Cùng điều kiện với `ratingService.rateIssue`: chưa gộp, đúng người báo cáo,
/// đã ĐÓNG (`resolved` **hoặc `rejected`** — task I1), chưa đánh giá.
bool canRateIssue(Issue issue, String? userId) {
  if (issue.isMerged) return false;
  if (userId == null || issue.reporter?.id != userId) return false;
  if (!issue.status.isClosed) return false;
  return !issue.rating.isRated;
}

/// Cán bộ có xử lý được phiếu này không — mirror `assertCanHandleIssue`.
bool staffCanHandle(Issue issue, {required String? departmentId}) =>
    departmentId != null && issue.department?.id == departmentId && !issue.isMerged;
