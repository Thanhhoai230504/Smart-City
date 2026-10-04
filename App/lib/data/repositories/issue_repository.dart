import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/network/app_exception.dart';
import '../../core/utils/json.dart';
import '../models/common.dart';
import '../models/issue.dart';
import '../models/report_support.dart';

/// Nội dung một phiếu báo cáo — dùng chung cho gửi trực tiếp và hàng đợi offline.
class ReportPayload {
  const ReportPayload({
    required this.title,
    required this.description,
    required this.category,
    required this.location,
    required this.latitude,
    required this.longitude,
    this.phone,
  });

  final String title;
  final String description;
  final String category;
  final String location;
  final double latitude;
  final double longitude;
  final String? phone;

  JsonMap toJson() => {
        'title': title,
        'description': description,
        'category': category,
        'location': location,
        'latitude': latitude,
        'longitude': longitude,
        if (phone != null && phone!.isNotEmpty) 'phone': phone,
      };

  factory ReportPayload.fromJson(Object? value) {
    final m = asMap(value);
    return ReportPayload(
      title: asStringOr(m['title']),
      description: asStringOr(m['description']),
      category: asStringOr(m['category'], 'other'),
      location: asStringOr(m['location']),
      latitude: asDouble(m['latitude']) ?? 0,
      longitude: asDouble(m['longitude']) ?? 0,
      phone: asString(m['phone']),
    );
  }
}

/// Ảnh đã nén, sẵn sàng tải lên.
class UploadImage {
  const UploadImage(this.bytes, {this.filename = 'photo.jpg', this.mimeSubtype = 'jpeg'});

  final Uint8List bytes;
  final String filename;
  final String mimeSubtype;

  MultipartFile toMultipart() => MultipartFile.fromBytes(
        bytes,
        filename: filename,
        contentType: DioMediaType('image', mimeSubtype),
      );
}

/// Bộ lọc danh sách — whitelist của backend (`ALLOWED_SORTS`, enum status…).
class IssueQuery {
  const IssueQuery({
    this.status,
    this.category,
    this.search,
    this.district,
    this.priorityLevel,
    this.slaStatus,
    this.assigneeId,
    this.reopened = false,
    this.sort = '-createdAt',
    this.dateFrom,
    this.dateTo,
  });

  final String? status;
  final String? category;
  final String? search;
  final String? district;
  final String? priorityLevel;
  final String? slaStatus;
  final String? assigneeId;
  final bool reopened;
  final String sort;

  /// Khoảng ngày báo cáo (lọc theo `createdAt`, tính cả ngày cuối).
  final DateTime? dateFrom;
  final DateTime? dateTo;

  bool get hasDateRange => dateFrom != null || dateTo != null;

  bool get hasFilters =>
      status != null ||
      category != null ||
      (search?.isNotEmpty ?? false) ||
      district != null ||
      priorityLevel != null ||
      slaStatus != null ||
      assigneeId != null ||
      reopened ||
      hasDateRange;

  int get activeFilterCount => [
        status,
        category,
        district,
        priorityLevel,
        slaStatus,
        assigneeId,
        if (reopened) 'r',
        if (hasDateRange) 'd',
      ].where((v) => v != null).length;

  static String _day(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Map<String, Object> toParams() => {
        'status': ?status,
        'category': ?category,
        if (search != null && search!.trim().isNotEmpty) 'search': search!.trim(),
        'district': ?district,
        'priorityLevel': ?priorityLevel,
        'slaStatus': ?slaStatus,
        'assigneeId': ?assigneeId,
        if (reopened) 'reopened': 'true',
        if (dateFrom != null) 'dateFrom': _day(dateFrom!),
        if (dateTo != null) 'dateTo': _day(dateTo!),
        'sort': sort,
      };

  IssueQuery copyWith({
    Object? status = _keep,
    Object? category = _keep,
    Object? search = _keep,
    Object? district = _keep,
    Object? priorityLevel = _keep,
    Object? slaStatus = _keep,
    Object? assigneeId = _keep,
    bool? reopened,
    String? sort,
    Object? dateFrom = _keep,
    Object? dateTo = _keep,
  }) =>
      IssueQuery(
        status: status == _keep ? this.status : status as String?,
        category: category == _keep ? this.category : category as String?,
        search: search == _keep ? this.search : search as String?,
        district: district == _keep ? this.district : district as String?,
        priorityLevel: priorityLevel == _keep ? this.priorityLevel : priorityLevel as String?,
        slaStatus: slaStatus == _keep ? this.slaStatus : slaStatus as String?,
        assigneeId: assigneeId == _keep ? this.assigneeId : assigneeId as String?,
        reopened: reopened ?? this.reopened,
        sort: sort ?? this.sort,
        dateFrom: dateFrom == _keep ? this.dateFrom : dateFrom as DateTime?,
        dateTo: dateTo == _keep ? this.dateTo : dateTo as DateTime?,
      );

  static const _keep = Object();

  @override
  bool operator ==(Object other) =>
      other is IssueQuery &&
      other.status == status &&
      other.category == category &&
      other.search == search &&
      other.district == district &&
      other.priorityLevel == priorityLevel &&
      other.slaStatus == slaStatus &&
      other.assigneeId == assigneeId &&
      other.reopened == reopened &&
      other.sort == sort &&
      other.dateFrom == dateFrom &&
      other.dateTo == dateTo;

  @override
  int get hashCode => Object.hash(
      status, category, search, district, priorityLevel, slaStatus, assigneeId, reopened, sort, dateFrom, dateTo);
}

class VoteResult {
  const VoteResult(this.voted, this.voteCount);

  final bool voted;
  final int voteCount;
}

class IssueRepository {
  IssueRepository(this._dio);

  final Dio _dio;

  Future<T> _call<T>(Future<T> Function() body) async {
    try {
      return await body();
    } catch (e) {
      throw AppException.from(e);
    }
  }

  Paged<Issue> _paged(Object? body) {
    final data = dataOf(body);
    return Paged(
      [for (final i in asList(data['issues'])) Issue.fromJson(i)],
      Pagination.fromJson(data['pagination']),
    );
  }

  /// Danh sách công khai. Có token thì backend tự bó phạm vi cán bộ.
  Future<Paged<Issue>> list(IssueQuery query, {int page = 1, int limit = 15, CancelToken? cancel}) =>
      _call(() async {
        final res = await _dio.get<Object?>(
          '/issues',
          queryParameters: {...query.toParams(), 'page': page, 'limit': limit},
          cancelToken: cancel,
        );
        return _paged(res.data);
      });

  /// Chế độ bản đồ hiệu năng cao — **contract quan trọng nhất app phải dùng
  /// lại** (kế hoạch 0.3): payload rút gọn, không populate, không count, tối đa
  /// 500 marker, chỉ tải vùng nhìn thấy.
  Future<List<Issue>> mapIssues({
    required double west,
    required double south,
    required double east,
    required double north,
    String? category,
    String? status,
    CancelToken? cancel,
  }) =>
      _call(() async {
        final res = await _dio.get<Object?>(
          '/issues',
          queryParameters: {
            'view': 'map',
            'bounds': '$west,$south,$east,$north',
            'limit': 500,
            'category': ?category,
            'status': ?status,
          },
          cancelToken: cancel,
        );
        return [for (final i in asList(dataOf(res.data)['issues'])) Issue.fromJson(i)];
      });

  /// Danh sách việc của cán bộ. **Không** dùng `/issues` công khai: token hết
  /// hạn ở đó rơi về phạm vi khách và hiện dữ liệu toàn hệ thống; `/work` luôn
  /// trả 401 để client refresh (task 4.1).
  Future<Paged<Issue>> work(IssueQuery query, {int page = 1, int limit = 15, CancelToken? cancel}) =>
      _call(() async {
        final res = await _dio.get<Object?>(
          '/issues/work',
          queryParameters: {...query.toParams(), 'page': page, 'limit': limit},
          cancelToken: cancel,
        );
        return _paged(res.data);
      });

  Future<Issue> detail(String id, {CancelToken? cancel}) => _call(() async {
        final res = await _dio.get<Object?>('/issues/$id', cancelToken: cancel);
        return Issue.fromJson(dataOf(res.data)['issue']);
      });

  /// Backend chỉ nhận `status`, `page`, `limit` (whitelist).
  Future<Paged<Issue>> mine({String? status, int page = 1, int limit = 15}) => _call(() async {
        final res = await _dio.get<Object?>('/issues/my', queryParameters: {
          'status': ?status,
          'page': page,
          'limit': limit,
        });
        return _paged(res.data);
      });

  Future<IssueSummary> mySummary() => _call(() async {
        final res = await _dio.get<Object?>('/issues/my/summary');
        return IssueSummary.fromJson(dataOf(res.data)['summary']);
      });

  Future<List<NearbyIssue>> nearby(double lat, double lng, {int radius = 500}) => _call(() async {
        final res = await _dio.get<Object?>(
          '/issues/nearby',
          queryParameters: {'lat': lat, 'lng': lng, 'radius': radius},
        );
        return [for (final i in asList(dataOf(res.data)['issues'])) NearbyIssue.fromJson(i)];
      });

  /// Multipart field **`images`** (đúng tên multer chờ: `uploadImages('images', 5)`),
  /// timeout 120s như web (task 3.4). Server rollback ảnh Cloudinary nếu ghi
  /// MongoDB lỗi nên đứt mạng giữa chừng không tạo phiếu mồ côi.
  Future<Issue> create(
    ReportPayload payload,
    List<UploadImage> images, {
    ProgressCallback? onProgress,
    CancelToken? cancel,
  }) =>
      _call(() async {
        final form = FormData();
        payload.toJson().forEach((k, v) => form.fields.add(MapEntry(k, '$v')));
        for (final img in images) {
          form.files.add(MapEntry('images', img.toMultipart()));
        }
        final res = await _dio.post<Object?>(
          '/issues',
          data: form,
          onSendProgress: onProgress,
          cancelToken: cancel,
          options: Options(
            sendTimeout: const Duration(seconds: 120),
            receiveTimeout: const Duration(seconds: 120),
          ),
        );
        return Issue.fromJson(dataOf(res.data)['issue']);
      });

  Future<Issue> updateMine(String id, {required String title, required String description}) =>
      _call(() async {
        final res = await _dio.put<Object?>(
          '/issues/$id/my',
          data: {'title': title.trim(), 'description': description.trim()},
        );
        return Issue.fromJson(dataOf(res.data)['issue']);
      });

  Future<void> deleteMine(String id) => _call(() async {
        await _dio.delete<Object?>('/issues/$id/my');
      });

  Future<VoteResult> toggleVote(String id) => _call(() async {
        final res = await _dio.post<Object?>('/issues/$id/vote');
        final data = dataOf(res.data);
        return VoteResult(asBool(data['voted']), asInt(data['voteCount']) ?? 0);
      });

  /// `score` số nguyên 1–5 bắt buộc, `comment` ≤ 500 (validator task 6c-8).
  Future<Issue> rate(String id, {required int score, String? comment}) => _call(() async {
        final res = await _dio.post<Object?>('/issues/$id/rate', data: {
          'score': score,
          if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
        });
        return Issue.fromJson(dataOf(res.data)['issue']);
      });

  /// G8 — bốn mã từ chối riêng: `NOT_REPORTER`, `ISSUE_NOT_CLOSED`,
  /// `REOPEN_LIMIT_REACHED`, `REOPEN_WINDOW_EXPIRED` (+ `MERGED_ISSUE`).
  Future<Issue> reopen(String id, String reason) => _call(() async {
        final res = await _dio.post<Object?>('/issues/$id/reopen', data: {'reason': reason.trim()});
        return Issue.fromJson(dataOf(res.data)['issue']);
      });

  /// `duplicateCandidateLimiter` 40 req/15 phút → gọi sau debounce, kèm
  /// CancelToken để huỷ lượt cũ (task 3.5).
  Future<DuplicateResult> duplicateCandidates(ReportPayload payload, {CancelToken? cancel}) =>
      _call(() async {
        final res = await _dio.post<Object?>(
          '/issues/duplicate-candidates',
          data: {
            'title': payload.title,
            'description': payload.description,
            'category': payload.category,
            'latitude': payload.latitude,
            'longitude': payload.longitude,
          },
          cancelToken: cancel,
          options: Options(receiveTimeout: const Duration(seconds: 12)),
        );
        return DuplicateResult.fromJson(dataOf(res.data));
      });

  Future<bool> confirmDuplicate(String id) => _call(() async {
        final res = await _dio.post<Object?>('/issues/$id/confirm-duplicate');
        return asBool(dataOf(res.data)['alreadyConfirmed']);
      });

  /// Atomic ở server — hai cán bộ cùng bấm thì một người nhận 400 (task 4.3).
  Future<Issue> claim(String id) => _call(() async {
        final res = await _dio.post<Object?>('/issues/$id/claim');
        return Issue.fromJson(dataOf(res.data)['issue']);
      });

  /// Gọi **TRƯỚC** khi chuyển `resolved` (backend chặn `NO_RESOLUTION_IMAGE`).
  Future<List<IssueImage>> uploadResolutionImages(String id, List<UploadImage> images,
          {ProgressCallback? onProgress}) =>
      _call(() async {
        final form = FormData();
        for (final img in images) {
          form.files.add(MapEntry('images', img.toMultipart()));
        }
        final res = await _dio.post<Object?>(
          '/issues/$id/resolution-images',
          data: form,
          onSendProgress: onProgress,
          options: Options(
            sendTimeout: const Duration(seconds: 120),
            receiveTimeout: const Duration(seconds: 120),
          ),
        );
        return [
          for (final i in asList(dataOf(res.data)['resolutionImages']))
            if (IssueImage.fromJson(i) != null) IssueImage.fromJson(i)!,
        ];
      });

  /// Từ chối **bắt buộc** có lý do (`REJECT_REASON_REQUIRED`); ghi chú ≤ 500.
  Future<Issue> updateStatus(String id, IssueStatus status, {String? note}) => _call(() async {
        final res = await _dio.patch<Object?>('/issues/$id/status', data: {
          'status': status.name,
          if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        });
        return Issue.fromJson(dataOf(res.data)['issue']);
      });
}

final issueRepositoryProvider =
    Provider<IssueRepository>((ref) => IssueRepository(ref.watch(apiDioProvider)));
