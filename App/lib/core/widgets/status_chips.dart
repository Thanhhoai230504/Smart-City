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
          horizontal: dense ? 8 : 10,
          vertical: dense ? 3 : 5,
        ),
        decoration: BoxDecoration(
          color: colors.container,
          borderRadius: BorderRadius.circular(Radii.chip),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: dense ? 13 : 15, color: colors.text),
            const SizedBox(width: 5),
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
    // Chip đầy đủ ghi rõ thang điểm như web ("58/100") — người dân không biết
    // con số trần là gì; chip gọn trong danh sách của cán bộ giữ số trần.
    final scoreText = score == null ? null : (dense ? '${score!.round()}' : '${score!.round()}/100');
    return InfoChip(
      label: scoreText == null ? label : '$label · $scoreText',
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

/// Danh mục: icon màu của danh mục + nhãn từ meta. Một đoạn chữ (icon là
/// `WidgetSpan`) chứ không phải Row: khi bị ép hẹp — chữ 1.6× cạnh "x ngày
/// trước" trên thẻ — nó cắt bằng "…" thay vì tràn layout.
class CategoryLabel extends ConsumerWidget {
  const CategoryLabel(this.category, {super.key, this.style});

  final String category;
  final TextStyle? style;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = ref.watch(metaProvider).category(category);
    final tone = CategoryTone.of(hexColor(c.color), context.palette);
    final textStyle = style ?? Theme.of(context).textTheme.labelMedium ?? const TextStyle(fontSize: 13);
    final fontSize = textStyle.fontSize ?? 13;
    return Text.rich(
      TextSpan(
        children: [
          WidgetSpan(
            alignment: PlaceholderAlignment.middle,
            child: Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Icon(AppIcons.category(category), size: fontSize + 3, color: tone.ink),
            ),
          ),
          TextSpan(text: c.label),
        ],
      ),
      // WidgetSpan bị phóng theo textScaler của đoạn chữ → tắt scale ở đây và tự
      // phóng cỡ chữ, để icon giữ cỡ cố định như trước còn nhãn vẫn theo cài đặt máy.
      style: textStyle.copyWith(fontSize: MediaQuery.textScalerOf(context).scale(fontSize)),
      textScaler: TextScaler.noScaling,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }
}

/// Chip chọn danh mục (form báo cáo, sửa phiếu chờ gửi): icon màu + nhãn.
class CategoryChoiceChip extends ConsumerWidget {
  const CategoryChoiceChip({super.key, required this.category, required this.selected, required this.onSelected});

  final String category;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = ref.watch(metaProvider).category(category);
    final tone = CategoryTone.of(hexColor(c.color), context.palette);
    return ChoiceChip(
      showCheckmark: false,
      avatar: Icon(AppIcons.category(category), size: 18, color: tone.ink),
      label: Text(c.label),
      selected: selected,
      onSelected: (_) => onSelected(),
    );
  }
}
