import '../../core/utils/json.dart';
import 'issue.dart';

/// Gợi ý địa chỉ qua proxy `GET /api/geo/autocomplete` (B3).
class GeoPrediction {
  const GeoPrediction({
    required this.description,
    required this.placeId,
    this.mainText,
    this.secondaryText,
  });

  final String description;
  final String placeId;
  final String? mainText;
  final String? secondaryText;

  factory GeoPrediction.fromJson(Object? value) {
    final m = asMap(value);
    final structured = asMap(m['structured_formatting']);
    return GeoPrediction(
      description: asStringOr(m['description']),
      placeId: asStringOr(m['place_id']),
      mainText: asString(structured['main_text']),
      secondaryText: asString(structured['secondary_text']),
    );
  }
}

class GeoPlace {
  const GeoPlace({required this.lat, required this.lng, required this.address});

  final double lat;
  final double lng;
  final String address;

  factory GeoPlace.fromJson(Object? value) {
    final m = asMap(value);
    return GeoPlace(
      lat: asDouble(m['lat']) ?? 0,
      lng: asDouble(m['lng']) ?? 0,
      address: asStringOr(m['address']),
    );
  }
}

/// Kết quả `POST /api/ai/classify-image`. AI chỉ GỢI Ý — người dân vẫn tự sửa.
class AiSuggestion {
  const AiSuggestion({
    required this.category,
    required this.confidence,
    required this.description,
  });

  final String category;
  final double confidence;
  final String description;

  /// Backend trả `confidence: 0` khi mọi model đều lỗi — coi như không có gợi ý.
  bool get isUseful => confidence > 0;

  factory AiSuggestion.fromJson(Object? value) {
    final m = asMap(value);
    return AiSuggestion(
      category: asStringOr(m['category'], 'other'),
      confidence: (asDouble(m['confidence']) ?? 0).clamp(0, 1).toDouble(),
      description: asStringOr(m['description']),
    );
  }
}

enum DuplicateConfidence {
  low,
  possible,
  high;

  static DuplicateConfidence parse(Object? v) => DuplicateConfidence.values
      .firstWhere((c) => c.name == v, orElse: () => DuplicateConfidence.low);

  String get label => switch (this) {
        DuplicateConfidence.high => 'Rất giống',
        DuplicateConfidence.possible => 'Có thể trùng',
        DuplicateConfidence.low => 'Hơi giống',
      };
}

class DuplicateCandidate {
  const DuplicateCandidate({
    required this.issue,
    required this.distanceMeters,
    required this.duplicateScore,
    required this.confidence,
    required this.reasons,
    this.semanticSimilarity = 0,
    this.method = 'embedding',
  });

  final Issue issue;
  final double distanceMeters;
  final double duplicateScore;
  final DuplicateConfidence confidence;
  final double semanticSimilarity;
  final String method;
  final List<String> reasons;

  factory DuplicateCandidate.fromJson(Object? value) {
    final m = asMap(value);
    return DuplicateCandidate(
      issue: Issue.fromJson(m['issue']),
      distanceMeters: asDouble(m['distanceMeters']) ?? 0,
      duplicateScore: asDouble(m['duplicateScore']) ?? 0,
      confidence: DuplicateConfidence.parse(m['confidence']),
      semanticSimilarity: asDouble(m['semanticSimilarity']) ?? 0,
      method: asStringOr(m['method'], 'embedding'),
      reasons: [
        for (final r in asList(m['reasons']))
          if (r is String) r,
      ],
    );
  }
}

class DuplicateResult {
  const DuplicateResult({required this.candidates, required this.mode, this.providerError});

  final List<DuplicateCandidate> candidates;

  /// `embedding` | `mixed` | `lexical_fallback`.
  final String mode;
  final String? providerError;

  /// Nghiệm thu 3.5: `lexical_fallback` phải hiện nhãn "đang dùng phương án dự phòng".
  bool get isFallback => mode == 'lexical_fallback';

  static const empty = DuplicateResult(candidates: [], mode: 'embedding');

  factory DuplicateResult.fromJson(Object? value) {
    final m = asMap(value);
    final meta = asMap(m['meta']);
    return DuplicateResult(
      candidates: [for (final c in asList(m['candidates'])) DuplicateCandidate.fromJson(c)],
      mode: asStringOr(meta['mode'], 'embedding'),
      providerError: asString(meta['providerError']),
    );
  }
}

/// `GET /api/app/config` (task 0.8).
class RemoteAppConfig {
  const RemoteAppConfig({
    required this.minSupportedVersion,
    required this.latestVersion,
    this.androidStoreUrl,
    this.iosStoreUrl,
    this.googleServerClientId,
    this.webUrl,
  });

  final String minSupportedVersion;
  final String latestVersion;
  final String? androidStoreUrl;
  final String? iosStoreUrl;

  /// Client ID web của Google, dùng làm `serverClientId` (B4). `null` = máy chủ
  /// chưa cấu hình → ẩn nút đăng nhập Google.
  final String? googleServerClientId;

  /// Gốc trang web (https) để tạo link chia sẻ `/issues/:id`; `null` khi máy
  /// chủ không có địa chỉ công khai.
  final String? webUrl;

  factory RemoteAppConfig.fromJson(Object? value) {
    final m = asMap(value);
    final store = asMap(m['storeUrls']);
    return RemoteAppConfig(
      minSupportedVersion: asStringOr(m['minSupportedVersion'], '0.0.0'),
      latestVersion: asStringOr(m['latestVersion'], '0.0.0'),
      androidStoreUrl: asString(store['android']),
      iosStoreUrl: asString(store['ios']),
      googleServerClientId: asString(asMap(m['googleSignIn'])['serverClientId']),
      webUrl: asString(m['webUrl']),
    );
  }
}
