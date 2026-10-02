import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/network/api_client.dart';
import '../../core/network/app_exception.dart';
import '../../core/storage/prefs.dart';
import '../../core/utils/json.dart';
import '../models/meta.dart';
import '../models/meta_fallback.dart';

/// Nạp taxonomy theo ba tầng (task 0.7): **cache trên máy → bản dự phòng đóng
/// gói → mạng**. Cold start không có mạng vẫn render được nhãn.
class MetaRepository {
  MetaRepository(this._dio, this._prefs);

  final Dio _dio;
  final SharedPreferences _prefs;

  static final MetaEnums bundled = MetaEnums.fromJson(kMetaFallbackJson);

  MetaEnums? readCached() {
    final raw = _prefs.getString(PrefKeys.metaCache);
    if (raw == null) return null;
    try {
      final meta = MetaEnums.fromJson(jsonDecode(raw));
      return meta.isUsable ? meta : null;
    } catch (_) {
      return null;
    }
  }

  Future<String?> fetchVersion() async {
    try {
      final res = await _dio.get<Object?>('/meta/version');
      return asString(dataOf(res.data)['version']);
    } catch (e) {
      throw AppException.from(e);
    }
  }

  /// Tải payload đầy đủ. Payload thiếu danh mục/trạng thái thì **không** ghi
  /// đè cache — dữ liệu hỏng không được thay thế dữ liệu tốt.
  Future<MetaEnums> fetch() async {
    try {
      final res = await _dio.get<Object?>('/meta/enums');
      final data = dataOf(res.data);
      final meta = MetaEnums.fromJson(data);
      if (meta.isUsable) {
        await _prefs.setString(PrefKeys.metaCache, jsonEncode(data));
      }
      return meta;
    } catch (e) {
      throw AppException.from(e);
    }
  }
}

final metaRepositoryProvider = Provider<MetaRepository>(
  (ref) => MetaRepository(ref.watch(apiDioProvider), ref.watch(sharedPrefsProvider)),
);

/// Luôn có giá trị dùng được — màn hình không phải xử lý trạng thái "meta chưa về".
class MetaController extends Notifier<MetaEnums> {
  @override
  MetaEnums build() =>
      ref.read(metaRepositoryProvider).readCached() ?? MetaRepository.bundled;

  /// Gọi lúc khởi động và khi app trở lại foreground. Lỗi mạng bỏ qua im lặng:
  /// đã có bản cache/dự phòng.
  Future<void> refresh() async {
    final repo = ref.read(metaRepositoryProvider);
    try {
      final remoteVersion = await repo.fetchVersion();
      if (remoteVersion != null && remoteVersion == state.version) return;
      final fresh = await repo.fetch();
      if (fresh.isUsable) state = fresh;
    } on AppException {
      // Giữ nguyên bản đang có.
    }
  }
}

final metaProvider = NotifierProvider<MetaController, MetaEnums>(MetaController.new);
