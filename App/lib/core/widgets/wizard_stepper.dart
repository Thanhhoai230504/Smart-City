import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

/// Khung wizard nhiều bước (design system mục 8):
/// - dải bước có icon ở trên — biết mình đang ở đâu và còn mấy bước;
/// - nút điều hướng **neo đáy** — vùng ngón cái với tới khi cầm một tay (6.4);
/// - quay lại **không mất dữ liệu**: widget này không giữ state form; mỗi bước
///   đọc/ghi vào controller của màn cha.
class WizardStepper extends StatelessWidget {
  const WizardStepper({
    super.key,
    required this.stepTitles,
    required this.currentStep,
    required this.body,
    required this.onNext,
    this.stepIcons,
    this.onBack,
    this.nextLabel = 'Tiếp theo',
    this.nextIcon = Icons.arrow_forward,
    this.nextEnabled = true,
    this.busy = false,
    this.hint,
  });

  final List<String> stepTitles;

  /// Icon cho từng bước trên dải tiến trình; thiếu thì hiện số thứ tự.
  final List<IconData>? stepIcons;
  final int currentStep;
  final Widget body;
  final VoidCallback? onNext;
  final VoidCallback? onBack;
  final String nextLabel;
  final IconData nextIcon;
  final bool nextEnabled;
  final bool busy;

  /// Lý do nút "Tiếp theo" đang tắt — hiện ngay trên nút thay vì để người dùng
  /// đoán.
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final total = stepTitles.length;
    final light = palette.brightness == Brightness.light;

    return Column(
      children: [
        Semantics(
          label: 'Bước ${currentStep + 1} trên $total: ${stepTitles[currentStep]}',
          excludeSemantics: true,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.sm, Gap.xl, 0),
            child: _StepTrack(total: total, current: currentStep, icons: stepIcons),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(Gap.lg, Gap.md, Gap.lg, Gap.xs),
          child: Row(
            children: [
              Text(
                'Bước ${currentStep + 1}/$total',
                style: textTheme.labelMedium?.copyWith(color: palette.primary),
              ),
              Gap.w8,
              Expanded(
                child: Text(
                  stepTitles[currentStep],
                  style: textTheme.titleLarge,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
        Expanded(child: body),
        DecoratedBox(
          decoration: BoxDecoration(
            color: palette.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: light ? null : Border(top: BorderSide(color: palette.border)),
            boxShadow: light
                ? const [BoxShadow(color: Color(0x140B2540), blurRadius: 20, offset: Offset(0, -4))]
                : null,
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Gap.lg, Gap.md, Gap.lg, Gap.md),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (hint != null && !nextEnabled) ...[
                    Text(hint!, style: textTheme.bodySmall, textAlign: TextAlign.center),
                    Gap.h8,
                  ],
                  Row(
                    children: [
                      if (onBack != null) ...[
                        OutlinedButton.icon(
                          onPressed: busy ? null : onBack,
                          icon: const Icon(Icons.arrow_back),
                          label: const Text('Quay lại'),
                        ),
                        Gap.w12,
                      ],
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: nextEnabled && !busy ? onNext : null,
                          icon: busy
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : Icon(nextIcon),
                          label: Text(nextLabel),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Dải bước: vòng tròn nối bằng đường kẻ. Bước xong có dấu ✓, bước hiện tại có
/// viền, bước sau còn mờ.
class _StepTrack extends StatelessWidget {
  const _StepTrack({required this.total, required this.current, this.icons});

  final int total;
  final int current;
  final List<IconData>? icons;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    Widget node(int i) {
      final done = i < current;
      final active = i == current;
      final fill = done || active ? palette.primary : palette.field;
      final ink = done || active ? palette.onPrimary : palette.textSecondary;
      return AnimatedContainer(
        duration: Motion.of(context),
        curve: Motion.curve,
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: fill,
          shape: BoxShape.circle,
          border: active ? Border.all(color: scheme.primaryContainer, width: 4) : null,
        ),
        alignment: Alignment.center,
        child: done
            ? Icon(Icons.check, size: 18, color: ink)
            : icons != null && i < icons!.length
                ? Icon(icons![i], size: 18, color: ink)
                : Text('${i + 1}', style: textTheme.labelMedium?.copyWith(color: ink)),
      );
    }

    return Row(
      children: [
        for (var i = 0; i < total; i++) ...[
          node(i),
          if (i < total - 1)
            Expanded(
              child: AnimatedContainer(
                duration: Motion.of(context),
                height: 3,
                margin: const EdgeInsets.symmetric(horizontal: 6),
                decoration: BoxDecoration(
                  color: i < current ? palette.primary : palette.field,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
        ],
      ],
    );
  }
}
