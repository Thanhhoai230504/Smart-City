import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/issue.dart';
import '../../data/repositories/meta_repository.dart';
import '../theme/app_colors.dart';
import '../theme/app_icons.dart';
import '../theme/app_spacing.dart';

/// Chip ba kênh: **màu + icon + nhãn chữ** (design system mục 6.1). Nền đặc,
/// không alpha tint.
class InfoChip extends StatelessWidget {
  const InfoChip({
    super.key,
    required this.label,
    required this.icon,
    required this.colors,
    this.semanticsPrefix,
    this.dense = false,
  });

  final String label;
  final IconData icon;
  final ChipColors colors;

  /// Đọc trước nhãn cho trình đọc màn hình: "Trạng thái: Đang xử lý".
  final String? semanticsPrefix;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.labelSmall?.copyWith(color: colors.text);
    return Semantics(
      label: semanticsPrefix == null ? label : '$semanticsPrefix: $label',
      excludeSemantics: true,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: dense ? 6 : Gap.sm,
          vertical: dense ? 2 : Gap.xs,
        ),
        decoration: BoxDecoration(
          color: colors.container,
          borderRadius: BorderRadius.circular(Radii.chip),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: dense ? 14 : 16, color: colors.text),
            const SizedBox(width: 4),
            Flexible(
              child: Text(label, style: style, maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
      ),
    );
  }
}

/// Nhận **enum**, không nhận chuỗi nhãn hardcode — nhãn lấy từ
/// `GET /api/meta/enums` (B9).
class StatusChip extends ConsumerWidget {
  const StatusChip(this.status, {super.key, this.dense = false});

  final IssueStatus status;
  final bool dense;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = ref.watch(metaProvider);
    return InfoChip(
      label: meta.statusLabel(status.name),
      icon: AppIcons.status(status),
      colors: context.palette.statusColors(status),
      semanticsPrefix: 'Trạng thái',
      dense: dense,
    );
  }
}

class PriorityChip extends ConsumerWidget {
  const PriorityChip(this.level, {super.key, this.score, this.dense = false});

  final PriorityLevel level;
  final double? score;
  final bool dense;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = ref.watch(metaProvider);
    final label = meta.priorityLabel(level.name);
    return InfoChip(
      label: score == null ? label : '$label · ${score!.round()}',
      icon: AppIcons.priority(level),
      colors: context.palette.priorityColors(level),
      semanticsPrefix: 'Mức ưu tiên',
      dense: dense,
    );
  }
}

class SlaChip extends ConsumerWidget {
  const SlaChip(this.sla, {super.key, this.dense = false, this.labelOverride});

  final SlaStatus sla;
  final bool dense;

  /// Dùng bởi `SlaCountdown` để hiện "còn 2 giờ" thay cho nhãn tĩnh.
  final String? labelOverride;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = ref.watch(metaProvider);
    return InfoChip(
      label: labelOverride ?? meta.slaLabel(sla.wire),
      icon: AppIcons.sla(sla),
      colors: context.palette.slaColors(sla),
      semanticsPrefix: 'Hạn xử lý',
      dense: dense,
    );
  }
}

/// "Bị mở lại · N lần" — cán bộ cần biết phiếu nào người dân phản đối kết quả
/// (Giai đoạn 6c, `ReopenedBadge` của web).
class ReopenedChip extends StatelessWidget {
  const ReopenedChip(this.count, {super.key, this.dense = false});

  final int count;
  final bool dense;

  @override
  Widget build(BuildContext context) => InfoChip(
        label: 'Bị mở lại · $count lần',
        icon: Icons.replay,
        colors: context.palette.priorityColors(PriorityLevel.high),
        dense: dense,
      );
}

/// Danh mục: emoji + nhãn từ meta, nền trung tính (màu category chỉ cho đồ hoạ).
class CategoryLabel extends ConsumerWidget {
  const CategoryLabel(this.category, {super.key, this.style});

  final String category;
  final TextStyle? style;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = ref.watch(metaProvider).category(category);
    return Text(
      '${c.icon} ${c.label}',
      style: style ?? Theme.of(context).textTheme.labelMedium,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }
}
