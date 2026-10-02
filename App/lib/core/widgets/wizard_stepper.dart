import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

/// Khung wizard nhiều bước (design system mục 8):
/// - thanh tiến trình mỏng trên cùng;
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
    this.onBack,
    this.nextLabel = 'Tiếp theo',
    this.nextIcon = Icons.arrow_forward,
    this.nextEnabled = true,
    this.busy = false,
    this.hint,
  });

  final List<String> stepTitles;
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
    final progress = (currentStep + 1) / total;

    return Column(
      children: [
        Semantics(
          label: 'Bước ${currentStep + 1} trên $total: ${stepTitles[currentStep]}',
          child: TweenAnimationBuilder<double>(
            tween: Tween(end: progress),
            duration: Motion.of(context),
            curve: Motion.curve,
            builder: (_, value, _) => LinearProgressIndicator(value: value, minHeight: 4),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(Gap.lg, Gap.md, Gap.lg, 0),
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
                  style: textTheme.titleMedium,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
        Expanded(child: body),
        Material(
          color: palette.surface,
          child: SafeArea(
            top: false,
            child: Container(
              decoration: BoxDecoration(border: Border(top: BorderSide(color: palette.border))),
              padding: const EdgeInsets.fromLTRB(Gap.lg, Gap.sm, Gap.lg, Gap.md),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (hint != null && !nextEnabled) ...[
                    Text(
                      hint!,
                      style: textTheme.bodySmall,
                      textAlign: TextAlign.center,
                    ),
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
