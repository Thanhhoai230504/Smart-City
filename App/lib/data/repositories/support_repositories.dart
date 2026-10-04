import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/network/app_exception.dart';
import '../../core/utils/json.dart';
import '../models/comment.dart';
import '../models/common.dart';
import '../models/notification.dart';
import '../models/public_info.dart';
import '../models/report_support.dart';

Future<T> _call<T>(Future<T> Function() body) async {
  try {
    return await body();
  } catch (e) {
    throw AppException.from(e);
  }
}

/// Proxy bản đồ (B3) — API key Goong/TomTom **không bao giờ** nằm trong APK.
class GeoRepository {
  GeoRepository(this._dio);

  final Dio _dio;

  Future<List<GeoPrediction>> autocomplete(String input,
          {double? lat, double? lng, CancelToken? cancel}) =>
      _call(() async {
        final res = await _dio.get<Object?>(
          '/geo/autocomplete',
          queryParameters: {
            'input': input,
            'lat': ?lat,
            'lng': ?lng,
            'limit': 6,
          },
          cancelToken: cancel,
        );
        return [
          for (final p in asList(dataOf(res.data)['predictions'])) GeoPrediction.fromJson(p),
        ];
      });

  Future<GeoPlace> placeDetail(String placeId) => _call(() async {
        final res =
            await _dio.get<Object?>('/geo/place-detail', queryParameters: {'place_id': placeId});
        return GeoPlace.fromJson(dataOf(res.data));
      });

  Future<String?> reverse(double lat, double lng, {CancelToken? cancel}) => _call(() async {
        final res = await _dio.get<Object?>(
          '/geo/reverse',
          queryParameters: {'lat': lat, 'lng': lng},
          cancelToken: cancel,
        );
        final address = asString(dataOf(res.data)['address']);
        return address == null || address.isEmpty ? null : address;
      });

  /// Chỉ đường bằng ô tô, có tính kẹt xe (TomTom). Không tìm được tuyến → 404.
  Future<RouteResult> route(double fromLat, double fromLng, double toLat, double toLng) => _call(() async {
        final res = await _dio.get<Object?>('/geo/route', queryParameters: {
          'fromLat': fromLat,
          'fromLng': fromLng,
          'toLat': toLat,
          'toLng': toLng,
        });
        return RouteResult.fromJson(dataOf(res.data));
      });
}

class AiRepository {
  AiRepository(this._dio);

  final Dio _dio;

  /// Multipart field **`image`** (số ít!) — khác `images` của route tạo phiếu.
  /// Server kiểm tra magic bytes, nên chỉ gửi JPEG/PNG/WebP thật.
  Future<AiSuggestion> classify(Uint8List jpeg, {CancelToken? cancel}) => _call(() async {
        final form = FormData()
          ..files.add(MapEntry(
            'image',
            MultipartFile.fromBytes(jpeg,
                filename: 'photo.jpg', contentType: DioMediaType('image', 'jpeg')),
          ));
        final res = await _dio.post<Object?>(
          '/ai/classify-image',
          data: form,
          cancelToken: cancel,
          options: Options(
            sendTimeout: const Duration(seconds: 30),
            receiveTimeout: const Duration(seconds: 30),
          ),
        );
        return AiSuggestion.fromJson(dataOf(res.data));
      });
}

class CommentRepository {
  CommentRepository(this._dio);

  final Dio _dio;

  /// Backend đã lọc bình luận bị gỡ (`isDeleted: false`) ở tầng truy vấn.
  Future<Paged<IssueComment>> list(String issueId, {int page = 1}) => _call(() async {
        final res = await _dio.get<Object?>(
          '/issues/$issueId/comments',
          queryParameters: {'page': page, 'limit': 20},
        );
        final data = dataOf(res.data);
        return Paged(
          [for (final c in asList(data['comments'])) IssueComment.fromJson(c)],
          Pagination.fromJson(data['pagination']),
        );
      });

  Future<IssueComment> add(String issueId, String content) => _call(() async {
        final res = await _dio.post<Object?>(
          '/issues/$issueId/comments',
          data: {'content': content.trim()},
        );
        return IssueComment.fromJson(dataOf(res.data)['comment']);
      });
}

class NotificationRepository {
  NotificationRepository(this._dio);

  final Dio _dio;

  Future<NotificationPage> list({int page = 1}) => _call(() async {
        final res = await _dio.get<Object?>(
          '/notifications',
          queryParameters: {'page': page, 'limit': 20},
        );
        return NotificationPage.fromJson(dataOf(res.data));
      });

  Future<int> unreadCount() => _call(() async {
        final res = await _dio.get<Object?>('/notifications/unread-count');
        return asInt(dataOf(res.data)['count']) ?? 0;
      });

  Future<void> markRead(String id) => _call(() async {
        await _dio.patch<Object?>('/notifications/$id/read');
      });

  Future<void> markAllRead() => _call(() async {
        await _dio.patch<Object?>('/notifications/read-all');
      });
}

/// Dữ liệu công khai: thống kê, camera, địa điểm, huy hiệu, chatbot.
class PublicRepository {
  PublicRepository(this._dio);

  final Dio _dio;

  Future<PublicStatistics> statistics() => _call(() async {
        final res = await _dio.get<Object?>('/statistics');
        return PublicStatistics.fromJson(dataOf(res.data));
      });

  Future<List<PublicCamera>> cameras() => _call(() async {
        final res = await _dio.get<Object?>('/cameras');
        return [for (final c in asList(dataOf(res.data)['cameras'])) PublicCamera.fromJson(c)];
      });

  Future<List<PublicCamera>> nearbyCameras(double lat, double lng, {int radius = 2000}) =>
      _call(() async {
        final res = await _dio.get<Object?>(
          '/cameras/nearby',
          queryParameters: {'lat': lat, 'lng': lng, 'radius': radius},
        );
        return [for (final c in asList(dataOf(res.data)['cameras'])) PublicCamera.fromJson(c)];
      });

  /// Địa điểm là dữ liệu tĩnh và ít — tải một lần với trần **tường minh** thay vì
  /// tải theo khung nhìn (cùng quyết định với web, G-B6).
  Future<List<EnvironmentReading>> environment() => _call(() async {
        final res = await _dio.get<Object?>('/environment');
        return [
          for (final e in asList(dataOf(res.data)['environment'])) EnvironmentReading.fromJson(e),
        ].where((e) => e.hasPosition).toList();
      });

  Future<List<Place>> places() => _call(() async {
        final res = await _dio.get<Object?>('/places', queryParameters: {'limit': 500});
        return [for (final p in asList(dataOf(res.data)['places'])) Place.fromJson(p)];
      });

  Future<BadgeProgress> myBadges() => _call(() async {
        final res = await _dio.get<Object?>('/badges/me');
        return BadgeProgress.fromJson(dataOf(res.data));
      });

  /// API trả **mảng trực tiếp** trong `data`.
  Future<List<LeaderboardEntry>> leaderboard({int limit = 10}) => _call(() async {
        final res = await _dio.get<Object?>('/badges/leaderboard', queryParameters: {'limit': limit});
        return [for (final e in asList(asMap(res.data)['data'])) LeaderboardEntry.fromJson(e)];
      });

  /// `chatbotLimiter` 25 tin/15 phút — chạm trần trả 429, màn hình báo lịch sự.
  Future<String> chat(String message, List<Map<String, String>> history) => _call(() async {
        final res = await _dio.post<Object?>(
          '/chatbot/message',
          data: {'message': message, 'history': history},
          options: Options(receiveTimeout: const Duration(seconds: 45)),
        );
        return asStringOr(dataOf(res.data)['reply'], 'Xin lỗi, tôi chưa trả lời được câu này.');
      });

  /// Task 0.8 — server quyết định bản cài nào còn được hỗ trợ.
  Future<RemoteAppConfig> appConfig() => _call(() async {
        final res = await _dio.get<Object?>(
          '/app/config',
          options: Options(receiveTimeout: const Duration(seconds: 8)),
        );
        return RemoteAppConfig.fromJson(dataOf(res.data));
      });
}

final geoRepositoryProvider = Provider((ref) => GeoRepository(ref.watch(apiDioProvider)));
final aiRepositoryProvider = Provider((ref) => AiRepository(ref.watch(apiDioProvider)));
final commentRepositoryProvider = Provider((ref) => CommentRepository(ref.watch(apiDioProvider)));
final notificationRepositoryProvider =
    Provider((ref) => NotificationRepository(ref.watch(apiDioProvider)));
final publicRepositoryProvider = Provider((ref) => PublicRepository(ref.watch(apiDioProvider)));
