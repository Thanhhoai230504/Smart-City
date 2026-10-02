import '../../core/utils/json.dart';

/// Tham chiếu tới một người dùng: backend trả **hoặc** chuỗi ObjectId **hoặc**
/// object đã populate (`{_id, name, email?}`) tuỳ endpoint và quyền người gọi.
/// Khai thẳng `String` là crash runtime — cạm bẫy ở task 0.6.
class PersonRef {
  const PersonRef({required this.id, this.name, this.email, this.role});

  final String id;
  final String? name;

  /// Chỉ có khi người gọi là admin/cán bộ (backend che PII ở tầng truy vấn).
  final String? email;
  final String? role;

  bool get isPopulated => name != null;

  static PersonRef? fromJson(Object? value) {
    final id = refId(value);
    if (id == null) return null;
    if (value is! Map) return PersonRef(id: id);
    final m = asMap(value);
    return PersonRef(
      id: id,
      name: asString(m['name']),
      email: asString(m['email']),
      role: asString(m['role']),
    );
  }

  JsonMap toJson() => {
        '_id': id,
        'name': ?name,
        'email': ?email,
        'role': ?role,
      };
}

/// Đơn vị xử lý — chuỗi id hoặc object populate (`name code email phone`).
class DepartmentRef {
  const DepartmentRef({
    required this.id,
    this.name,
    this.code,
    this.email,
    this.phone,
  });

  final String id;
  final String? name;
  final String? code;
  final String? email;
  final String? phone;

  static DepartmentRef? fromJson(Object? value) {
    final id = refId(value);
    if (id == null) return null;
    if (value is! Map) return DepartmentRef(id: id);
    final m = asMap(value);
    return DepartmentRef(
      id: id,
      name: asString(m['name']),
      code: asString(m['code']),
      email: asString(m['email']),
      phone: asString(m['phone']),
    );
  }

  JsonMap toJson() => {
        '_id': id,
        'name': ?name,
        'code': ?code,
        'email': ?email,
        'phone': ?phone,
      };
}

class Pagination {
  const Pagination({
    required this.current,
    required this.pages,
    required this.total,
    required this.limit,
  });

  final int current;
  final int pages;
  final int total;
  final int limit;

  bool get hasMore => current < pages;

  static const empty = Pagination(current: 1, pages: 1, total: 0, limit: 10);

  factory Pagination.fromJson(Object? value) {
    final m = asMap(value);
    return Pagination(
      current: asInt(m['current']) ?? 1,
      pages: asInt(m['pages']) ?? 1,
      total: asInt(m['total']) ?? 0,
      limit: asInt(m['limit']) ?? 10,
    );
  }
}

/// Một trang dữ liệu.
class Paged<T> {
  const Paged(this.items, this.pagination);

  final List<T> items;
  final Pagination pagination;
}
