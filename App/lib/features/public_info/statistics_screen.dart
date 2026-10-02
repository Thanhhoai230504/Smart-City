import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_states.dart';
import '../../data/models/issue.dart';
import '../../data/models/public_info.dart';
import '../../data/repositories/meta_repository.dart';
import '../../data/repositories/support_repositories.dart';

final statisticsProvider =
    FutureProvider.autoDispose<PublicStatistics>((ref) => ref.read(publicRepositoryProvider).statistics());

/// Tỷ lệ phần trăm an toàn — dữ liệu rỗng **không chia 0** (nghiệm thu 2.8).
double safeShare(int part, int total) => total <= 0 ? 0 : part / total;

/// Thống kê công khai (task 2.8) — port `Statistics/index.tsx` sang `fl_chart`.
class StatisticsScreen extends ConsumerWidget {
  const StatisticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(statisticsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Thống kê công khai')),
      body: async.when(
        loading: () => const SkeletonList(count: 4, itemHeight: 140),
        error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(statisticsProvider)),
        data: (s) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(statisticsProvider),
          child: _StatsBody(stats: s),
        ),
      ),
    );
  }
}

class _StatsBody extends ConsumerWidget {
  const _StatsBody({required this.stats});

  final PublicStatistics stats;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = ref.watch(metaProvider);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final statusTotal = stats.byStatus.values.fold<int>(0, (a, b) => a + b);

    Widget card(String title, Widget child) => Card(
          child: Padding(
            padding: const EdgeInsets.all(Gap.card),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [Text(title, style: textTheme.titleMedium), Gap.h12, child],
            ),
          ),
        );

    return ListView(
      padding: const EdgeInsets.all(Gap.screen),
      children: [
        // Không dùng GridView tỉ lệ cố định: chiều cao ô phải theo nội dung để
        // chữ phóng to 1.6× không bị cắt (design system 4.3).
        _OverviewRow(children: [
          _Overview(label: 'Tổng sự cố', value: Fmt.number(stats.totalIssues), icon: Icons.report_outlined),
          _Overview(label: 'Đã xử lý', value: Fmt.number(stats.resolvedCount), icon: Icons.task_alt),
        ]),
        Gap.h12,
        _OverviewRow(children: [
          _Overview(label: 'Tỷ lệ xử lý', value: '${stats.resolutionRate}%', icon: Icons.percent),
          _Overview(label: 'Thời gian TB', value: Fmt.hours(stats.avgResolutionHours), icon: Icons.timer_outlined),
        ]),
        Gap.h12,
        card(
          'Sự cố 30 ngày qua',
          stats.trend.isEmpty
              ? Text('Chưa có sự cố nào trong 30 ngày qua.', style: textTheme.bodySmall)
              : SizedBox(height: 180, child: _TrendChart(trend: stats.trend, color: palette.primary)),
        ),
        Gap.h12,
        card(
          'Theo trạng thái',
          statusTotal == 0
              ? Text('Chưa có dữ liệu.', style: textTheme.bodySmall)
              : Column(
                  children: [
                    SizedBox(
                      height: 180,
                      child: PieChart(PieChartData(
                        sectionsSpace: 2,
                        centerSpaceRadius: 40,
                        sections: [
                          for (final e in stats.byStatus.entries)
                            if (e.value > 0)
                              PieChartSectionData(
                                value: e.value.toDouble(),
                                color: palette.statusColors(IssueStatus.parse(e.key)).text,
                                radius: 46,
                                title: '${(safeShare(e.value, statusTotal) * 100).round()}%',
                                titleStyle: textTheme.labelSmall?.copyWith(color: palette.surface),
                              ),
                        ],
                      )),
                    ),
                    Gap.h8,
                    Wrap(
                      spacing: Gap.lg,
                      runSpacing: Gap.sm,
                      children: [
                        for (final e in stats.byStatus.entries)
                          _Legend(
                            color: palette.statusColors(IssueStatus.parse(e.key)).text,
                            label: '${meta.statusLabel(e.key)}: ${e.value}',
                          ),
                      ],
                    ),
                  ],
                ),
        ),
        Gap.h12,
        card(
          'Theo loại sự cố',
          stats.byCategory.isEmpty
              ? Text('Chưa có dữ liệu.', style: textTheme.bodySmall)
              : Column(
                  children: [
                    for (final c in stats.byCategory)
                      _BarRow(
                        label: '${meta.category(c.key).icon} ${meta.categoryLabel(c.key)}',
                        value: c.count,
                        share: safeShare(c.count, stats.byCategory.map((e) => e.count).reduce(math.max)),
                        color: hexColor(meta.category(c.key).color),
                      ),
                  ],
                ),
        ),
        Gap.h12,
        card(
          'Theo khu vực',
          Column(
            children: [
              for (final d in stats.byDistrict)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: Gap.xs),
                  child: Row(
                    children: [
                      Expanded(child: Text(d.district, style: textTheme.bodyMedium)),
                      Text('${d.total} phiếu', style: textTheme.bodySmall),
                      Gap.w12,
                      SizedBox(
                        width: 64,
                        child: Text('${d.rate}% xong', textAlign: TextAlign.end, style: textTheme.labelMedium),
                      ),
                    ],
                  ),
                ),
              Gap.h8,
              Text(
                'Khu vực theo 8 quận/huyện cũ — mô hình hành chính đã đổi từ 01/07/2025, '
                'hệ thống đang chuẩn bị chuyển sang đơn vị cấp xã.',
                style: textTheme.bodySmall,
              ),
            ],
          ),
        ),
        Gap.h12,
        card(
          'Đánh giá của người dân',
          stats.ratingTotal == 0
              ? Text('Chưa có lượt đánh giá nào.', style: textTheme.bodySmall)
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${stats.ratingAverage.toStringAsFixed(1)} / 5 · ${stats.ratingTotal} lượt',
                        style: textTheme.titleLarge),
                    Gap.h8,
                    for (var star = 5; star >= 1; star--)
                      _BarRow(
                        label: '$star ★',
                        value: stats.ratingDistribution[star] ?? 0,
                        share: safeShare(stats.ratingDistribution[star] ?? 0, stats.ratingTotal),
                        color: palette.priorityColors(PriorityLevel.medium).text,
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _OverviewRow extends StatelessWidget {
  const _OverviewRow({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: children[0]),
            Gap.w12,
            Expanded(child: children[1]),
          ],
        ),
      );
}

class _Overview extends StatelessWidget {
  const _Overview({required this.label, required this.value, required this.icon});

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(Gap.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: context.palette.primary),
            Gap.h4,
            FittedBox(fit: BoxFit.scaleDown, child: Text(value, style: textTheme.headlineSmall)),
            Text(label, style: textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 12, height: 12, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
          Gap.w4,
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      );
}

class _BarRow extends StatelessWidget {
  const _BarRow({required this.label, required this.value, required this.share, required this.color});

  final String label;
  final int value;
  final double share;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: Gap.xs),
      child: Row(
        children: [
          SizedBox(width: 120, child: Text(label, style: textTheme.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis)),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: share.isNaN ? 0 : share,
                minHeight: 10,
                color: color,
                backgroundColor: context.palette.surfaceAlt,
              ),
            ),
          ),
          Gap.w8,
          SizedBox(width: 36, child: Text('$value', textAlign: TextAlign.end, style: textTheme.labelMedium)),
        ],
      ),
    );
  }
}

class _TrendChart extends StatelessWidget {
  const _TrendChart({required this.trend, required this.color});

  final List<CountByKey> trend;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final maxY = trend.map((t) => t.count).fold<int>(0, math.max).toDouble();
    final textTheme = Theme.of(context).textTheme;
    return LineChart(LineChartData(
      minY: 0,
      maxY: maxY < 4 ? 4 : maxY * 1.2,
      gridData: const FlGridData(show: true, drawVerticalLine: false),
      borderData: FlBorderData(show: false),
      titlesData: FlTitlesData(
        topTitles: const AxisTitles(),
        rightTitles: const AxisTitles(),
        leftTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 28,
            getTitlesWidget: (v, _) => Text(v.toInt().toString(), style: textTheme.labelSmall),
          ),
        ),
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            interval: math.max(1, (trend.length / 4).floorToDouble()),
            getTitlesWidget: (v, _) {
              final i = v.toInt();
              if (i < 0 || i >= trend.length) return const SizedBox.shrink();
              final parts = trend[i].key.split('-');
              return Text(parts.length == 3 ? '${parts[2]}/${parts[1]}' : trend[i].key,
                  style: textTheme.labelSmall);
            },
          ),
        ),
      ),
      lineBarsData: [
        LineChartBarData(
          spots: [for (var i = 0; i < trend.length; i++) FlSpot(i.toDouble(), trend[i].count.toDouble())],
          color: color,
          barWidth: 3,
          isCurved: true,
          preventCurveOverShooting: true,
          dotData: const FlDotData(show: false),
          belowBarData: BarAreaData(show: true, color: color.withValues(alpha: 0.12)),
        ),
      ],
    ));
  }
}
