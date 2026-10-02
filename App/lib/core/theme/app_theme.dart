import 'package:flutter/material.dart';

import '../../data/models/issue.dart';
import 'app_colors.dart';
import 'app_spacing.dart';
import 'app_typography.dart';

/// ThemeData sáng/tối dựng từ [AppPalette]. Ngôn ngữ bố cục chức năng: tương
/// phản cao, **viền hơn bóng** (mục 6.3 — dưới nắng shadow gần như biến mất và
/// làm nền trông bẩn), vùng chạm ≥ 48dp.
abstract final class AppTheme {
  static ThemeData light() => _build(AppPalette.light);
  static ThemeData dark() => _build(AppPalette.dark);

  static ThemeData _build(AppPalette p) {
    final scheme = ColorScheme(
      brightness: p.brightness,
      primary: p.primary,
      onPrimary: p.onPrimary,
      secondary: p.secondary,
      onSecondary: p.onSecondary,
      error: p.error,
      onError: p.onError,
      surface: p.surface,
      onSurface: p.textPrimary,
      onSurfaceVariant: p.textSecondary,
      outline: p.border,
      outlineVariant: p.border,
      surfaceContainerLowest: p.surface,
      surfaceContainerLow: p.surfaceAlt,
      surfaceContainer: p.surfaceAlt,
      surfaceContainerHigh: p.surfaceAlt,
      surfaceContainerHighest: p.surfaceAlt,
      primaryContainer: p.brightness == Brightness.light
          ? const Color(0xFFDCEBF5)
          : const Color(0xFF173A52),
      onPrimaryContainer: p.brightness == Brightness.light
          ? const Color(0xFF0A3E5C)
          : const Color(0xFFD4E8F5),
      secondaryContainer: p.statusColors(IssueStatus.resolved).container,
      onSecondaryContainer: p.statusColors(IssueStatus.resolved).text,
      errorContainer: p.slaColors(SlaStatus.overdue).container,
      onErrorContainer: p.slaColors(SlaStatus.overdue).text,
      shadow: Colors.black,
      scrim: Colors.black54,
      inverseSurface: p.textPrimary,
      onInverseSurface: p.surface,
      inversePrimary: p.brightness == Brightness.light
          ? const Color(0xFF7FB6D9)
          : const Color(0xFF0A5680),
    );

    final text = AppTypography.textTheme(p.textPrimary, p.textSecondary);
    final buttonShape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(Radii.button),
    );
    const buttonSize = Size(kMinTouchTarget, kMinTouchTarget);
    final inputBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(Radii.input),
      borderSide: BorderSide(color: p.border),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: p.brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: p.background,
      canvasColor: p.surface,
      textTheme: text,
      dividerColor: p.border,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      visualDensity: VisualDensity.standard,
      extensions: [p],
      appBarTheme: AppBarTheme(
        backgroundColor: p.surface,
        foregroundColor: p.textPrimary,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: text.titleLarge,
        shape: Border(bottom: BorderSide(color: p.border)),
      ),
      cardTheme: CardThemeData(
        color: p.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Radii.card),
          side: BorderSide(color: p.border),
        ),
      ),
      dividerTheme: DividerThemeData(color: p.border, thickness: 1, space: 1),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: buttonSize,
          shape: buttonShape,
          textStyle: text.labelLarge,
          padding: const EdgeInsets.symmetric(horizontal: Gap.xl, vertical: Gap.md),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: buttonSize,
          shape: buttonShape,
          textStyle: text.labelLarge,
          foregroundColor: p.primary,
          side: BorderSide(color: p.border),
          padding: const EdgeInsets.symmetric(horizontal: Gap.xl, vertical: Gap.md),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: buttonSize,
          shape: buttonShape,
          textStyle: text.labelLarge,
          foregroundColor: p.primary,
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(minimumSize: buttonSize),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: p.surface,
        border: inputBorder,
        enabledBorder: inputBorder,
        focusedBorder: inputBorder.copyWith(
          borderSide: BorderSide(color: p.primary, width: 2),
        ),
        errorBorder: inputBorder.copyWith(borderSide: BorderSide(color: p.error)),
        focusedErrorBorder: inputBorder.copyWith(
          borderSide: BorderSide(color: p.error, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: 14),
        labelStyle: text.bodyMedium?.copyWith(color: p.textSecondary),
        hintStyle: text.bodyMedium?.copyWith(color: p.textSecondary),
        helperStyle: text.bodySmall,
        errorStyle: text.bodySmall?.copyWith(color: p.error),
        errorMaxLines: 3,
        helperMaxLines: 3,
      ),
      chipTheme: ChipThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.chip)),
        side: BorderSide(color: p.border),
        labelStyle: text.labelMedium,
        backgroundColor: p.surface,
        selectedColor: scheme.primaryContainer,
        checkmarkColor: scheme.onPrimaryContainer,
        padding: const EdgeInsets.symmetric(horizontal: Gap.sm, vertical: Gap.xs),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: p.surface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: p.textSecondary,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: p.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.card)),
        titleTextStyle: text.titleLarge,
        contentTextStyle: text.bodyMedium,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: p.surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: scheme.primaryContainer,
        height: 72,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => text.labelSmall?.copyWith(
            color: states.contains(WidgetState.selected) ? p.primary : p.textSecondary,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? scheme.onPrimaryContainer
                : p.textSecondary,
          ),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: p.primary,
        foregroundColor: p.onPrimary,
        elevation: 4,
        shape: const CircleBorder(),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.button)),
      ),
      listTileTheme: ListTileThemeData(
        minVerticalPadding: Gap.md,
        iconColor: p.textSecondary,
        titleTextStyle: text.titleMedium,
        subtitleTextStyle: text.bodySmall,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: p.primary,
        linearTrackColor: p.border,
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: SegmentedButton.styleFrom(
          minimumSize: buttonSize,
          selectedBackgroundColor: scheme.primaryContainer,
          selectedForegroundColor: scheme.onPrimaryContainer,
          side: BorderSide(color: p.border),
        ),
      ),
    );
  }

}
