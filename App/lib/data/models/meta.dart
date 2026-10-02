import '../../core/utils/json.dart';

class MetaCategory {
  const MetaCategory({
    required this.value,
    required this.label,
    required this.icon,
    required this.color,
    this.slaHours,
    this.intakeHours,
  });

  final String value;
  final String label;

  /// Emoji do server gửi (🕳️, 🗑️…).
  final String icon;

  /// Màu **đồ hoạ** (marker, chấm) — không dùng làm màu chữ.
  final String color;
  final int? slaHours;
  final int? intakeHours;

  factory MetaCategory.fromJson(Object? value) {
    final m = asMap(value);
    return MetaCategory(
      value: asStringOr(m['value']),
      label: asStringOr(m['label'], asStringOr(m['value'])),
      icon: asStringOr(m['icon'], '📌'),
      color: asStringOr(m['color'], '#6B7280'),
      slaHours: asInt(m['slaHours']),
      intakeHours: asInt(m['intakeHours']),
    );
  }
}

class MetaOption {
  const MetaOption(this.value, this.label);

  final String value;
  final String label;

  factory MetaOption.fromJson(Object? value) {
    final m = asMap(value);
    return MetaOption(asStringOr(m['value']), asStringOr(m['label'], asStringOr(m['value'])));
  }
}

class MetaLimits {
  const MetaLimits({
    this.maxImages = 5,
    this.maxImageMb = 5,
    this.maxTitleLength = 200,
    this.maxDescriptionLength = 2000,
    this.maxNoteLength = 500,
    this.maxCommentLength = 1000,
  });

  final int maxImages;
  final int maxImageMb;
  final int maxTitleLength;
  final int maxDescriptionLength;
  final int maxNoteLength;
  final int maxCommentLength;

  int get maxImageBytes => maxImageMb * 1024 * 1024;

  factory MetaLimits.fromJson(Object? value) {
    final m = asMap(value);
    const d = MetaLimits();
    return MetaLimits(
      maxImages: asInt(m['maxImages']) ?? d.maxImages,
      maxImageMb: asInt(m['maxImageMb']) ?? d.maxImageMb,
      maxTitleLength: asInt(m['maxTitleLength']) ?? d.maxTitleLength,
      maxDescriptionLength: asInt(m['maxDescriptionLength']) ?? d.maxDescriptionLength,
      maxNoteLength: asInt(m['maxNoteLength']) ?? d.maxNoteLength,
      maxCommentLength: asInt(m['maxCommentLength']) ?? d.maxCommentLength,
    );
  }
}

/// Rào chắn mở lại sự cố (G8). Đọc từ server — đổi chính sách thì app cũ vẫn đúng.
class ReopenPolicy {
  const ReopenPolicy({
    this.maxCount = 2,
    this.windowDays = 30,
    this.minReasonLength = 10,
    this.maxReasonLength = 500,
  });

  final int maxCount;
  final int windowDays;
  final int minReasonLength;
  final int maxReasonLength;

  factory ReopenPolicy.fromJson(Object? value) {
    final m = asMap(value);
    const d = ReopenPolicy();
    return ReopenPolicy(
      maxCount: asInt(m['maxCount']) ?? d.maxCount,
      windowDays: asInt(m['windowDays']) ?? d.windowDays,
      minReasonLength: asInt(m['minReasonLength']) ?? d.minReasonLength,
      maxReasonLength: asInt(m['maxReasonLength']) ?? d.maxReasonLength,
    );
  }
}

/// Payload `GET /api/meta/enums` (Phụ lục E.6) — nguồn duy nhất cho nhãn.
///
/// App **không hardcode taxonomy** (nguyên tắc 1.2.1 của kế hoạch): web sửa
/// constant là deploy xong, còn app đã cài phải chờ duyệt store.
class MetaEnums {
  const MetaEnums({
    required this.version,
    required this.categories,
    required this.statuses,
    required this.statusTransitions,
    required this.priorities,
    required this.slaStatuses,
    required this.notificationTypes,
    required this.areas,
    required this.limits,
    required this.reopen,
  });

  final String version;
  final List<MetaCategory> categories;
  final List<MetaOption> statuses;
  final Map<String, List<String>> statusTransitions;
  final List<MetaOption> priorities;
  final List<MetaOption> slaStatuses;
  final List<MetaOption> notificationTypes;
  final List<MetaOption> areas;
  final MetaLimits limits;
  final ReopenPolicy reopen;

  factory MetaEnums.fromJson(Object? value) {
    final m = asMap(value);
    List<MetaOption> options(String key) =>
        [for (final o in asList(m[key])) MetaOption.fromJson(o)];

    final transitions = <String, List<String>>{};
    asMap(m['statusTransitions']).forEach((from, targets) {
      transitions[from] = [
        for (final t in asList(targets))
          if (t is String) t,
      ];
    });

    return MetaEnums(
      version: asStringOr(m['version'], 'unknown'),
      categories: [for (final c in asList(m['categories'])) MetaCategory.fromJson(c)],
      statuses: options('statuses'),
      statusTransitions: transitions,
      priorities: options('priorities'),
      slaStatuses: options('slaStatuses'),
      notificationTypes: options('notificationTypes'),
      areas: options('areas'),
      limits: MetaLimits.fromJson(m['limits']),
      reopen: ReopenPolicy.fromJson(m['reopen']),
    );
  }

  /// Payload hợp lệ tối thiểu — thiếu danh mục hay trạng thái thì không dùng
  /// được để dựng form, nên không được ghi đè bản dự phòng.
  bool get isUsable => categories.isNotEmpty && statuses.isNotEmpty;

  MetaCategory category(String value) => categories.firstWhere(
        (c) => c.value == value,
        orElse: () => MetaCategory(value: value, label: value, icon: '📌', color: '#6B7280'),
      );

  String categoryLabel(String value) => category(value).label;

  String _label(List<MetaOption> list, String value) {
    for (final o in list) {
      if (o.value == value) return o.label;
    }
    return value;
  }

  String statusLabel(String value) => _label(statuses, value);
  String priorityLabel(String value) => _label(priorities, value);
  String slaLabel(String value) => _label(slaStatuses, value);
  String notificationTypeLabel(String value) => _label(notificationTypes, value);

  /// Đích chuyển trạng thái hợp lệ. Backend vẫn là nơi phán quyết cuối; bảng
  /// này chỉ để dựng bộ chọn.
  List<String> targetsFrom(String status) => statusTransitions[status] ?? const [];

  /// Khu vực người dân có thể theo dõi — bỏ "Khác".
  List<MetaOption> get watchableAreas =>
      [for (final a in areas) if (a.value != 'Khác') a];
}
