import '../../core/utils/json.dart';

class Place {
  const Place({
    required this.id,
    required this.name,
    required this.type,
    required this.latitude,
    required this.longitude,
    this.address = '',
    this.description = '',
    this.phone = '',
  });

  final String id;
  final String name;

  /// hospital | school | bus_stop | park | police
  final String type;
  final double latitude;
  final double longitude;
  final String address;
  final String description;
  final String phone;

  factory Place.fromJson(Object? value) {
    final m = asMap(value);
    return Place(
      id: refId(m) ?? '',
      name: asStringOr(m['name']),
      type: asStringOr(m['type'], 'park'),
      latitude: asDouble(m['latitude']) ?? 0,
      longitude: asDouble(m['longitude']) ?? 0,
      address: asStringOr(m['address']),
      description: asStringOr(m['description']),
      phone: asStringOr(m['phone']),
    );
  }
}

class PublicCamera {
  const PublicCamera({
    required this.id,
    required this.name,
    required this.type,
    required this.embedUrl,
    required this.thumbnailUrl,
    required this.watchUrl,
    this.lat,
    this.lng,
    this.distanceMeters,
  });

  final String id;
  final String name;
  final String type;

  /// URL do server dựng sẵn — client không tự ghép chuỗi từ youtubeId để tránh
  /// iframe injection (task 2.9).
  final String embedUrl;
  final String thumbnailUrl;
  final String watchUrl;
  final double? lat;
  final double? lng;
  final double? distanceMeters;

  factory PublicCamera.fromJson(Object? value) {
    final m = asMap(value);
    final coords = asMap(m['coords']);
    return PublicCamera(
      id: asStringOr(m['id']),
      name: asStringOr(m['name']),
      type: asStringOr(m['type'], 'public'),
      embedUrl: asStringOr(m['embedUrl']),
      thumbnailUrl: asStringOr(m['thumbnailUrl']),
      watchUrl: asStringOr(m['watchUrl']),
      lat: asDouble(coords['lat']),
      lng: asDouble(coords['lng']),
      distanceMeters: asDouble(m['distance']),
    );
  }
}

class CountByKey {
  const CountByKey(this.key, this.label, this.count);

  final String key;
  final String label;
  final int count;
}

class DistrictStat {
  const DistrictStat(this.district, this.total, this.resolved, this.rate);

  final String district;
  final int total;
  final int resolved;
  final int rate;
}

/// `GET /api/statistics` — chỉ số liệu tổng hợp, không PII.
class PublicStatistics {
  const PublicStatistics({
    required this.totalIssues,
    required this.resolvedCount,
    required this.resolutionRate,
    required this.avgResolutionHours,
    required this.byStatus,
    required this.byCategory,
    required this.trend,
    required this.byDistrict,
    required this.ratingAverage,
    required this.ratingTotal,
    required this.ratingDistribution,
  });

  final int totalIssues;
  final int resolvedCount;
  final int resolutionRate;
  final double avgResolutionHours;
  final Map<String, int> byStatus;
  final List<CountByKey> byCategory;
  final List<CountByKey> trend;
  final List<DistrictStat> byDistrict;
  final double ratingAverage;
  final int ratingTotal;
  final Map<int, int> ratingDistribution;

  factory PublicStatistics.fromJson(Object? value) {
    final m = asMap(value);
    final overview = asMap(m['overview']);
    final rating = asMap(m['rating']);
    final dist = <int, int>{for (var s = 1; s <= 5; s++) s: 0};
    asMap(rating['distribution']).forEach((k, v) {
      final star = int.tryParse(k);
      if (star != null) dist[star] = asInt(v) ?? 0;
    });

    return PublicStatistics(
      totalIssues: asInt(overview['totalIssues']) ?? 0,
      resolvedCount: asInt(overview['resolvedCount']) ?? 0,
      resolutionRate: asInt(overview['resolutionRate']) ?? 0,
      avgResolutionHours: asDouble(overview['avgResolutionHours']) ?? 0,
      byStatus: {
        for (final e in asMap(m['issuesByStatus']).entries) e.key: asInt(e.value) ?? 0,
      },
      byCategory: [
        for (final c in asList(m['issuesByCategory']))
          CountByKey(
            asStringOr(asMap(c)['category']),
            asStringOr(asMap(c)['label'], asStringOr(asMap(c)['category'])),
            asInt(asMap(c)['count']) ?? 0,
          ),
      ],
      trend: [
        for (final t in asList(m['issuesTrend']))
          CountByKey(asStringOr(asMap(t)['date']), asStringOr(asMap(t)['date']),
              asInt(asMap(t)['count']) ?? 0),
      ],
      byDistrict: [
        for (final d in asList(m['issuesByDistrict']))
          DistrictStat(
            asStringOr(asMap(d)['district']),
            asInt(asMap(d)['total']) ?? 0,
            asInt(asMap(d)['resolved']) ?? 0,
            asInt(asMap(d)['rate']) ?? 0,
          ),
      ],
      ratingAverage: asDouble(rating['average']) ?? 0,
      ratingTotal: asInt(rating['total']) ?? 0,
      ratingDistribution: dist,
    );
  }
}

class Badge {
  const Badge({
    required this.id,
    required this.label,
    required this.icon,
    required this.threshold,
    this.description = '',
    this.earned = false,
    this.remaining,
  });

  final String id;
  final String label;
  final String icon;
  final int threshold;
  final String description;
  final bool earned;
  final int? remaining;

  static Badge? fromJson(Object? value) {
    if (value is! Map) return null;
    final m = asMap(value);
    return Badge(
      id: asStringOr(m['id']),
      label: asStringOr(m['label']),
      icon: asStringOr(m['icon'], '🏅'),
      threshold: asInt(m['threshold']) ?? 0,
      description: asStringOr(m['description']),
      earned: asBool(m['earned']),
      remaining: asInt(m['remaining']),
    );
  }
}

/// `GET /api/badges/me`.
class BadgeProgress {
  const BadgeProgress({
    required this.issueCount,
    required this.allBadges,
    this.nextBadge,
  });

  final int issueCount;
  final List<Badge> allBadges;
  final Badge? nextBadge;

  List<Badge> get earned => [for (final b in allBadges) if (b.earned) b];

  factory BadgeProgress.fromJson(Object? value) {
    final m = asMap(value);
    return BadgeProgress(
      issueCount: asInt(m['issueCount']) ?? 0,
      allBadges: [
        for (final b in asList(m['allBadges']))
          if (Badge.fromJson(b) != null) Badge.fromJson(b)!,
      ],
      nextBadge: Badge.fromJson(m['nextBadge']),
    );
  }
}

/// Một dòng của `GET /api/badges/leaderboard` — API trả MẢNG trực tiếp trong
/// `data` (lỗi web đã từng mắc ở Giai đoạn 6b).
class LeaderboardEntry {
  const LeaderboardEntry({
    required this.userId,
    required this.name,
    required this.issueCount,
    required this.rank,
    this.topBadge,
  });

  final String userId;
  final String name;
  final int issueCount;
  final int rank;
  final Badge? topBadge;

  factory LeaderboardEntry.fromJson(Object? value) {
    final m = asMap(value);
    return LeaderboardEntry(
      userId: refId(m['userId']) ?? '',
      name: asStringOr(m['name'], 'Người dân'),
      issueCount: asInt(m['issueCount']) ?? 0,
      rank: asInt(m['rank']) ?? 0,
      topBadge: Badge.fromJson(m['topBadge']),
    );
  }
}
