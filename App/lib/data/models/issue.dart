import '../../core/utils/json.dart';
import 'common.dart';

/// Trạng thái phiếu. [unknown] để backend thêm trạng thái mới mà app đã phát
/// hành không crash.
enum IssueStatus {
  reported,
  processing,
  resolved,
  rejected,
  unknown;

  static IssueStatus parse(Object? value) => IssueStatus.values.firstWhere(
        (s) => s.name == value,
        orElse: () => IssueStatus.unknown,
      );

  bool get isClosed => this == resolved || this == rejected;
  bool get isOpen => this == reported || this == processing;
}

/// Trạng thái SLA — virtual `slaStatus` do backend tính lúc đọc. App **không
/// tự tính lại hạn** (design system mục 8, `SlaCountdown`).
enum SlaStatus {
  none('none'),
  onTime('on_time'),
  dueSoon('due_soon'),
  overdue('overdue'),
  met('met'),
  breached('breached');

  const SlaStatus(this.wire);
  final String wire;

  static SlaStatus parse(Object? value) => SlaStatus.values.firstWhere(
        (s) => s.wire == value,
        orElse: () => SlaStatus.none,
      );
}

enum PriorityLevel {
  low,
  medium,
  high,
  critical;

  static PriorityLevel? parse(Object? value) {
    for (final p in PriorityLevel.values) {
      if (p.name == value) return p;
    }
    return null;
  }
}

class IssueImage {
  const IssueImage({required this.url, this.uploadedBy, this.uploadedAt});

  final String url;

  /// Chỉ có ở ảnh minh chứng.
  final PersonRef? uploadedBy;
  final DateTime? uploadedAt;

  static IssueImage? fromJson(Object? value) {
    final m = asMap(value);
    final url = asString(m['url']);
    if (url == null || url.isEmpty) return null;
    return IssueImage(
      url: url,
      uploadedBy: PersonRef.fromJson(m['uploadedBy']),
      uploadedAt: asDate(m['uploadedAt']),
    );
  }
}

class StatusHistoryEntry {
  const StatusHistoryEntry({
    required this.status,
    required this.changedAt,
    this.changedBy,
    this.note = '',
  });

  final IssueStatus status;

  /// Chuỗi id ở bản ghi cũ, object `{_id, name}` sau task E2.
  final PersonRef? changedBy;
  final DateTime? changedAt;
  final String note;

  factory StatusHistoryEntry.fromJson(Object? value) {
    final m = asMap(value);
    return StatusHistoryEntry(
      status: IssueStatus.parse(m['status']),
      changedBy: PersonRef.fromJson(m['changedBy']),
      changedAt: asDate(m['changedAt']),
      note: asStringOr(m['note']),
    );
  }
}

class IssueRating {
  const IssueRating({this.score, this.comment, this.ratedAt});

  final int? score;
  final String? comment;
  final DateTime? ratedAt;

  bool get isRated => score != null;

  factory IssueRating.fromJson(Object? value) {
    final m = asMap(value);
    return IssueRating(
      score: asInt(m['score']),
      comment: asString(m['comment']),
      ratedAt: asDate(m['ratedAt']),
    );
  }
}

class PriorityFactor {
  const PriorityFactor({
    required this.code,
    required this.points,
    required this.weight,
    required this.normalizedScore,
    required this.message,
    this.rawValue,
  });

  final String code;
  final Object? rawValue;
  final double normalizedScore;
  final double weight;
  final double points;
  final String message;

  factory PriorityFactor.fromJson(Object? value) {
    final m = asMap(value);
    return PriorityFactor(
      code: asStringOr(m['code']),
      rawValue: m['rawValue'],
      normalizedScore: asDouble(m['normalizedScore']) ?? 0,
      weight: asDouble(m['weight']) ?? 0,
      points: asDouble(m['points']) ?? 0,
      message: asStringOr(m['message']),
    );
  }
}

/// Phiếu gốc khi phiếu này đã bị gộp — populate `title status`.
class MergedRef {
  const MergedRef({required this.id, this.title, this.status});

  final String id;
  final String? title;
  final IssueStatus? status;

  static MergedRef? fromJson(Object? value) {
    final id = refId(value);
    if (id == null) return null;
    final m = asMap(value);
    return MergedRef(
      id: id,
      title: asString(m['title']),
      status: m['status'] == null ? null : IssueStatus.parse(m['status']),
    );
  }
}

/// Sự cố — đủ các field của Phụ lục E.4 mà client cần.
///
/// Không có `embedding` (khai `select: false`, không bao giờ về client) và
/// `geo` (trùng latitude/longitude). Một số field chỉ có ở một số endpoint:
/// danh sách không có `statusHistory`/`images`; bản đồ chỉ có ~10 field; `phone`
/// chỉ có khi người gọi là cán bộ/admin. Vì vậy mọi field đều có giá trị mặc
/// định an toàn.
class Issue {
  const Issue({
    required this.id,
    required this.title,
    required this.description,
    required this.category,
    required this.location,
    required this.latitude,
    required this.longitude,
    required this.status,
    this.district,
    this.phone,
    this.imageUrl,
    this.images = const [],
    this.resolutionImages = const [],
    this.reporter,
    this.handledBy,
    this.resolvedAt,
    this.votes = const [],
    this.followers = const [],
    this.voteCount = 0,
    this.statusHistory = const [],
    this.rating = const IssueRating(),
    this.department,
    this.assignee,
    this.assignedBy,
    this.assignedAt,
    this.dueAt,
    this.escalationLevel = 0,
    this.lastReminderAt,
    this.reopenCount = 0,
    this.lastReopenedAt,
    this.intakeDueAt,
    this.intakeReminderAt,
    this.mergedInto,
    this.mergedAt,
    this.mergedBy,
    this.duplicateCount = 0,
    this.priorityScore,
    this.priorityLevel,
    this.priorityFactors = const [],
    this.priorityVersion,
    this.priorityCalculatedAt,
    this.slaStatus = SlaStatus.none,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String title;
  final String description;

  /// Giữ dạng chuỗi: danh mục là taxonomy của server (`/api/meta/enums`),
  /// thêm danh mục mới không cần phát hành lại app.
  final String category;
  final String location;
  final double latitude;
  final double longitude;
  final IssueStatus status;
  final String? district;

  /// Chỉ cán bộ/admin nhận được — dùng cho nút GỌI (task 4.4).
  final String? phone;
  final String? imageUrl;
  final List<IssueImage> images;
  final List<IssueImage> resolutionImages;

  /// `userId` — người báo cáo.
  final PersonRef? reporter;

  /// `adminId` — người cập nhật trạng thái gần nhất.
  final PersonRef? handledBy;
  final DateTime? resolvedAt;
  final List<String> votes;
  final List<String> followers;
  final int voteCount;
  final List<StatusHistoryEntry> statusHistory;
  final IssueRating rating;
  final DepartmentRef? department;
  final PersonRef? assignee;
  final PersonRef? assignedBy;
  final DateTime? assignedAt;
  final DateTime? dueAt;
  final int escalationLevel;
  final DateTime? lastReminderAt;
  final int reopenCount;
  final DateTime? lastReopenedAt;
  final DateTime? intakeDueAt;
  final DateTime? intakeReminderAt;
  final MergedRef? mergedInto;
  final DateTime? mergedAt;
  final PersonRef? mergedBy;
  final int duplicateCount;
  final double? priorityScore;
  final PriorityLevel? priorityLevel;
  final List<PriorityFactor> priorityFactors;
  final String? priorityVersion;
  final DateTime? priorityCalculatedAt;
  final SlaStatus slaStatus;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory Issue.fromJson(Object? value) {
    final m = asMap(value);
    return Issue(
      id: refId(m) ?? '',
      title: asStringOr(m['title']),
      description: asStringOr(m['description']),
      category: asStringOr(m['category'], 'other'),
      location: asStringOr(m['location']),
      latitude: asDouble(m['latitude']) ?? 0,
      longitude: asDouble(m['longitude']) ?? 0,
      status: IssueStatus.parse(m['status']),
      district: asString(m['district']),
      phone: asString(m['phone']),
      imageUrl: asString(m['imageUrl']),
      images: [
        for (final i in asList(m['images']))
          if (IssueImage.fromJson(i) != null) IssueImage.fromJson(i)!,
      ],
      resolutionImages: [
        for (final i in asList(m['resolutionImages']))
          if (IssueImage.fromJson(i) != null) IssueImage.fromJson(i)!,
      ],
      reporter: PersonRef.fromJson(m['userId']),
      handledBy: PersonRef.fromJson(m['adminId']),
      resolvedAt: asDate(m['resolvedAt']),
      votes: asStringList(m['votes']),
      followers: asStringList(m['followers']),
      voteCount: asInt(m['voteCount']) ?? 0,
      statusHistory: [
        for (final h in asList(m['statusHistory'])) StatusHistoryEntry.fromJson(h),
      ],
      rating: IssueRating.fromJson(m['rating']),
      department: DepartmentRef.fromJson(m['departmentId']),
      assignee: PersonRef.fromJson(m['assigneeId']),
      assignedBy: PersonRef.fromJson(m['assignedBy']),
      assignedAt: asDate(m['assignedAt']),
      dueAt: asDate(m['dueAt']),
      escalationLevel: asInt(m['escalationLevel']) ?? 0,
      lastReminderAt: asDate(m['lastReminderAt']),
      reopenCount: asInt(m['reopenCount']) ?? 0,
      lastReopenedAt: asDate(m['lastReopenedAt']),
      intakeDueAt: asDate(m['intakeDueAt']),
      intakeReminderAt: asDate(m['intakeReminderAt']),
      mergedInto: MergedRef.fromJson(m['mergedInto']),
      mergedAt: asDate(m['mergedAt']),
      mergedBy: PersonRef.fromJson(m['mergedBy']),
      duplicateCount: asInt(m['duplicateCount']) ?? 0,
      priorityScore: asDouble(m['priorityScore']),
      priorityLevel: PriorityLevel.parse(m['priorityLevel']),
      priorityFactors: [
        for (final f in asList(m['priorityFactors'])) PriorityFactor.fromJson(f),
      ],
      priorityVersion: asString(m['priorityVersion']),
      priorityCalculatedAt: asDate(m['priorityCalculatedAt']),
      slaStatus: SlaStatus.parse(m['slaStatus']),
      createdAt: asDate(m['createdAt']),
      updatedAt: asDate(m['updatedAt']),
    );
  }

  /// Ảnh người dân chụp. Bản ghi cũ chỉ có `imageUrl`.
  List<String> get photoUrls {
    if (images.isNotEmpty) return [for (final i in images) i.url];
    if (imageUrl != null && imageUrl!.isNotEmpty) return [imageUrl!];
    return const [];
  }

  String? get coverUrl => photoUrls.isEmpty ? null : photoUrls.first;

  bool get isMerged => mergedInto != null;

  /// Người dân chỉ sửa/xoá phiếu của mình khi còn `reported` (ràng buộc của
  /// `updateMyIssue`/`deleteMyIssue` ở backend).
  bool get isEditableByReporter => status == IssueStatus.reported;

  /// Mốc đóng phiếu — cùng thứ tự với `getClosedAt()` ở backend
  /// (`reopenConfig.js`): lần đóng gần nhất trong `statusHistory`, rồi
  /// `resolvedAt`, rồi `updatedAt`. Phiếu `rejected` KHÔNG có `resolvedAt` nên
  /// phải tra lịch sử trước.
  DateTime? get closedAt {
    for (final entry in statusHistory.reversed) {
      if (entry.status.isClosed && entry.changedAt != null) return entry.changedAt;
    }
    return resolvedAt ?? updatedAt;
  }

  /// Ghi chú của lần chuyển trạng thái gần nhất (lý do từ chối, ghi chú xử lý).
  String? get latestNote {
    for (final entry in statusHistory.reversed) {
      if (entry.note.trim().isNotEmpty) return entry.note.trim();
    }
    return null;
  }

  bool hasVoted(String? userId) => userId != null && votes.contains(userId);

  Issue copyWith({
    IssueStatus? status,
    int? voteCount,
    List<String>? votes,
    PersonRef? assignee,
    List<IssueImage>? resolutionImages,
    IssueRating? rating,
  }) =>
      Issue(
        id: id,
        title: title,
        description: description,
        category: category,
        location: location,
        latitude: latitude,
        longitude: longitude,
        status: status ?? this.status,
        district: district,
        phone: phone,
        imageUrl: imageUrl,
        images: images,
        resolutionImages: resolutionImages ?? this.resolutionImages,
        reporter: reporter,
        handledBy: handledBy,
        resolvedAt: resolvedAt,
        votes: votes ?? this.votes,
        followers: followers,
        voteCount: voteCount ?? this.voteCount,
        statusHistory: statusHistory,
        rating: rating ?? this.rating,
        department: department,
        assignee: assignee ?? this.assignee,
        assignedBy: assignedBy,
        assignedAt: assignedAt,
        dueAt: dueAt,
        escalationLevel: escalationLevel,
        lastReminderAt: lastReminderAt,
        reopenCount: reopenCount,
        lastReopenedAt: lastReopenedAt,
        intakeDueAt: intakeDueAt,
        intakeReminderAt: intakeReminderAt,
        mergedInto: mergedInto,
        mergedAt: mergedAt,
        mergedBy: mergedBy,
        duplicateCount: duplicateCount,
        priorityScore: priorityScore,
        priorityLevel: priorityLevel,
        priorityFactors: priorityFactors,
        priorityVersion: priorityVersion,
        priorityCalculatedAt: priorityCalculatedAt,
        slaStatus: slaStatus,
        createdAt: createdAt,
        updatedAt: updatedAt,
      );
}

/// Sự cố gần một toạ độ (`GET /issues/nearby`) — kèm khoảng cách (mét).
class NearbyIssue {
  const NearbyIssue(this.issue, this.distanceMeters);

  final Issue issue;
  final double distanceMeters;

  factory NearbyIssue.fromJson(Object? value) =>
      NearbyIssue(Issue.fromJson(value), asDouble(asMap(value)['distance']) ?? 0);
}

/// `GET /issues/my/summary`.
class IssueSummary {
  const IssueSummary({
    this.total = 0,
    this.reported = 0,
    this.processing = 0,
    this.resolved = 0,
    this.rejected = 0,
  });

  final int total;
  final int reported;
  final int processing;
  final int resolved;
  final int rejected;

  factory IssueSummary.fromJson(Object? value) {
    final m = asMap(value);
    return IssueSummary(
      total: asInt(m['total']) ?? 0,
      reported: asInt(m['reported']) ?? 0,
      processing: asInt(m['processing']) ?? 0,
      resolved: asInt(m['resolved']) ?? 0,
      rejected: asInt(m['rejected']) ?? 0,
    );
  }
}
