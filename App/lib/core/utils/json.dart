/// Đọc JSON phòng thủ.
///
/// Backend trả cùng một field với kiểu khác nhau tuỳ endpoint (ObjectId chuỗi
/// hoặc object đã populate — cạm bẫy ở task 0.6), số có thể là `int` hoặc
/// `double`, và field mới thêm có thể vắng mặt ở bản ghi cũ. Mọi model đi qua
/// các hàm này thay vì ép kiểu thẳng `as String` — ép sai là crash runtime.
library;

typedef JsonMap = Map<String, dynamic>;

JsonMap asMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return value.map((k, v) => MapEntry(k.toString(), v));
  return const {};
}

List<Object?> asList(Object? value) => value is List ? value : const [];

String? asString(Object? value) {
  if (value == null) return null;
  if (value is String) return value;
  if (value is num || value is bool) return value.toString();
  return null;
}

String asStringOr(Object? value, [String fallback = '']) =>
    asString(value) ?? fallback;

int? asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.round();
  if (value is String) return int.tryParse(value) ?? double.tryParse(value)?.round();
  return null;
}

double? asDouble(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

bool asBool(Object? value, [bool fallback = false]) {
  if (value is bool) return value;
  if (value is String) return value == 'true';
  return fallback;
}

DateTime? asDate(Object? value) {
  if (value is String && value.isNotEmpty) return DateTime.tryParse(value)?.toLocal();
  if (value is int) return DateTime.fromMillisecondsSinceEpoch(value).toLocal();
  return null;
}

/// Id của một tham chiếu: chuỗi ObjectId thô hoặc object đã populate.
String? refId(Object? value) {
  if (value is String) return value;
  if (value is Map) return asString(value['_id']) ?? asString(value['id']);
  return null;
}

List<String> asStringList(Object? value) => [
      for (final item in asList(value))
        if (refId(item) != null) refId(item)!,
    ];

/// Lấy `data` trong envelope `{success, message, data}` của backend.
JsonMap dataOf(Object? body) => asMap(asMap(body)['data']);
