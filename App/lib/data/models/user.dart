import 'dart:convert';

import '../../core/utils/json.dart';
import 'common.dart';

enum UserRole {
  user,
  staff,
  admin;

  static UserRole parse(Object? value) => UserRole.values.firstWhere(
        (r) => r.name == value,
        orElse: () => UserRole.user,
      );

  String get label => switch (this) {
        UserRole.user => 'Người dân',
        UserRole.staff => 'Cán bộ',
        UserRole.admin => 'Quản trị viên',
      };
}

class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.department,
    this.isActive = true,
    this.isVerified = true,
    this.provider = 'local',
    this.avatar,
    this.watchedDistricts = const [],
    this.createdAt,
  });

  final String id;
  final String name;
  final String email;
  final UserRole role;

  /// Chỉ có với cán bộ. Login trả chuỗi id, profile có thể trả object.
  final DepartmentRef? department;
  final bool isActive;
  final bool isVerified;

  /// `local` hoặc `google` — tài khoản Google không có mật khẩu để xác nhận
  /// khi xoá tài khoản (6.4) hay đổi mật khẩu (6.1).
  final String provider;
  final String? avatar;
  final List<String> watchedDistricts;
  final DateTime? createdAt;

  bool get isStaff => role == UserRole.staff;
  bool get isLocalAccount => provider == 'local';

  /// `POST /auth/login` trả `id`; `GET /auth/profile` trả `_id` — nhận cả hai.
  factory AppUser.fromJson(Object? value) {
    final m = asMap(value);
    return AppUser(
      id: asString(m['_id']) ?? asString(m['id']) ?? '',
      name: asStringOr(m['name'], 'Người dùng'),
      email: asStringOr(m['email']),
      role: UserRole.parse(m['role']),
      department: DepartmentRef.fromJson(m['departmentId']),
      isActive: asBool(m['isActive'], true),
      isVerified: asBool(m['isVerified'], true),
      provider: asStringOr(m['provider'], 'local'),
      avatar: asString(m['avatar']),
      watchedDistricts: [
        for (final d in asList(m['watchedDistricts']))
          if (d is String) d,
      ],
      createdAt: asDate(m['createdAt']),
    );
  }

  JsonMap toJson() => {
        '_id': id,
        'name': name,
        'email': email,
        'role': role.name,
        if (department != null) 'departmentId': department!.toJson(),
        'isActive': isActive,
        'isVerified': isVerified,
        'provider': provider,
        'avatar': ?avatar,
        'watchedDistricts': watchedDistricts,
        if (createdAt != null) 'createdAt': createdAt!.toUtc().toIso8601String(),
      };

  String encode() => jsonEncode(toJson());

  static AppUser? decode(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      final user = AppUser.fromJson(jsonDecode(raw));
      return user.id.isEmpty ? null : user;
    } catch (_) {
      return null;
    }
  }

  AppUser copyWith({String? name, List<String>? watchedDistricts}) => AppUser(
        id: id,
        name: name ?? this.name,
        email: email,
        role: role,
        department: department,
        isActive: isActive,
        isVerified: isVerified,
        provider: provider,
        avatar: avatar,
        watchedDistricts: watchedDistricts ?? this.watchedDistricts,
        createdAt: createdAt,
      );
}
