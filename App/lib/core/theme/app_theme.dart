import 'package:flutter/material.dart';

import '../../data/models/issue.dart';
import 'app_colors.dart';
import 'app_spacing.dart';
import 'app_typography.dart';

/// ThemeData sáng/tối dựng từ [AppPalette].
///
/// Ngôn ngữ hình khối: bo góc lớn, ô nhập kiểu "filled", nút cao 52dp, chip
/// dạng viên thuốc. Card giữ **viền mảnh + bóng mềm** (theme tối chỉ viền) —
/// dưới nắng bóng gần như biến mất nên viền mới là thứ tách card khỏi nền
/// (design system 6.3); bóng chỉ để có chiều sâu khi xem trong nhà.
abstract final class AppTheme {
  static ThemeData light() => _build(AppPalette.light);
  static ThemeData dark() => _build(AppPalette.dark);

  static ThemeData _build(AppPalette p) {
    final isLight = p.brightness == Brightness.light;
    final primaryContainer = isLight ? const Color(0xFFDCEBF5) : const Color(0xFF173A52);
    final onPrimaryContainer = isLight ? const Color(0xFF0A3E5C) : const Color(0xFFD4E8F5);

    final scheme = ColorScheme(
      brightness: p.brightness,
      primary: p.primary,
      onPrimary: p.onPrimary,
      secondary: p.secondary,
      onSecondary: p.onSecondary,
      tertiary: p.accent,
      onTertiary: p.onAccent,
      tertiaryContainer: p.accentSoft,
      onTertiaryContainer: p.accentInk,
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
      surfaceContainerHigh: p.field,
      surfaceContainerHighest: p.field,
      primaryContainer: primaryContainer,
      onPrimaryContainer: onPrimaryContainer,
      secondaryContainer: p.statusColors(IssueStatus.resolved).container,
      onSecondaryContainer: p.statusColors(IssueStatus.resolved).text,
      errorContainer: p.slaColors(SlaStatus.overdue).container,
      onErrorContainer: p.slaColors(SlaStatus.overdue).text,
      shadow: const Color(0xFF0B2540),
      scrim: Colors.black54,
      inverseSurface: isLight ? const Color(0xFF13283A) : const Color(0xFFE8EEF3),
      onInverseSurface: isLight ? const Color(0xFFF2F5F9) : const Color(0xFF0F2233),
      inversePrimary: isLight ? const Color(0xFF7FB6D9) : const Color(0xFF0A5680),
    );

    final text = AppTypography.textTheme(p.textPrimary, p.textSecondary);
    final buttonShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.button));
    const buttonSize = Size(kMinTouchTarget, 52);
    final fieldBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(Radii.input),
      borderSide: BorderSide.none,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: p.brightness,
      colorScheme: scheme,
      fontFamily: AppTypography.family,
      scaffoldBackgroundColor: p.background,
      canvasColor: p.surface,
      textTheme: text,
      dividerColor: p.border,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      visualDensity: VisualDensity.standard,
      splashFactory: InkSparkle.splashFactory,
      extensions: [p],
      appBarTheme: AppBarTheme(
        // Cùng màu nền trang: header liền mạch với nội dung, không còn vạch kẻ.
        backgroundColor: p.background,
        foregroundColor: p.textPrimary,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleSpacing: Gap.screen,
        titleTextStyle: text.titleLarge?.copyWith(fontSize: 19),
        iconTheme: IconThemeData(color: p.textPrimary),
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
          elevation: 0,
          textStyle: text.labelLarge?.copyWith(fontSize: 16),
          padding: const EdgeInsets.symmetric(horizontal: Gap.xl, vertical: Gap.md),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: buttonSize,
          shape: buttonShape,
          elevation: 0,
          backgroundColor: p.surface,
          foregroundColor: p.primary,
          textStyle: text.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: buttonSize,
          shape: buttonShape,
          textStyle: text.labelLarge?.copyWith(fontSize: 16),
          foregroundColor: p.primary,
          backgroundColor: p.surface,
          side: BorderSide(color: p.border, width: 1.5),
          padding: const EdgeInsets.symmetric(horizontal: Gap.xl, vertical: Gap.md),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(kMinTouchTarget, kMinTouchTarget),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: text.labelLarge,
          foregroundColor: p.primary,
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(minimumSize: const Size(kMinTouchTarget, kMinTouchTarget)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: p.field,
        border: fieldBorder,
        enabledBorder: fieldBorder,
        disabledBorder: fieldBorder,
        focusedBorder: fieldBorder.copyWith(borderSide: BorderSide(color: p.primary, width: 2)),
        errorBorder: fieldBorder.copyWith(borderSide: BorderSide(color: p.error, width: 1.5)),
        focusedErrorBorder: fieldBorder.copyWith(borderSide: BorderSide(color: p.error, width: 2)),
        contentPadding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: 16),
        labelStyle: text.bodyMedium?.copyWith(color: p.textSecondary),
        floatingLabelStyle: text.labelMedium?.copyWith(color: p.primary),
        hintStyle: text.bodyMedium?.copyWith(color: p.textSecondary),
        helperStyle: text.bodySmall,
        errorStyle: text.bodySmall?.copyWith(color: p.error),
        prefixIconColor: p.textSecondary,
        suffixIconColor: p.textSecondary,
        errorMaxLines: 3,
        helperMaxLines: 3,
      ),
      chipTheme: ChipThemeData(
        shape: const StadiumBorder(),
        side: BorderSide(color: p.border),
        labelStyle: text.labelMedium,
        backgroundColor: p.surface,
        selectedColor: primaryContainer,
        checkmarkColor: onPrimaryContainer,
        padding: const EdgeInsets.symmetric(horizontal: Gap.sm, vertical: 6),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: p.surface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: p.border,
        dragHandleSize: const Size(40, 5),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: p.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        titleTextStyle: text.titleLarge,
        contentTextStyle: text.bodyMedium?.copyWith(color: p.textSecondary),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: p.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.tile)),
        textStyle: text.bodyMedium,
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: p.accent,
        foregroundColor: p.onAccent,
        elevation: 2,
        shape: const CircleBorder(),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        elevation: 0,
        backgroundColor: scheme.inverseSurface,
        contentTextStyle: text.bodyMedium?.copyWith(color: scheme.onInverseSurface),
        actionTextColor: scheme.inversePrimary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.input)),
      ),
      listTileTheme: ListTileThemeData(
        minVerticalPadding: Gap.md,
        iconColor: p.textSecondary,
        titleTextStyle: text.titleMedium,
        subtitleTextStyle: text.bodySmall,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.tile)),
      ),
      switchTheme: SwitchThemeData(
        trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: p.primary,
        linearTrackColor: p.field,
        circularTrackColor: Colors.transparent,
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: p.primary,
        unselectedLabelColor: p.textSecondary,
        labelStyle: text.labelLarge,
        unselectedLabelStyle: text.labelLarge,
        indicatorColor: p.primary,
        dividerColor: p.border,
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: SegmentedButton.styleFrom(
          minimumSize: const Size(kMinTouchTarget, kMinTouchTarget),
          selectedBackgroundColor: primaryContainer,
          selectedForegroundColor: onPrimaryContainer,
          side: BorderSide(color: p.border),
          shape: const StadiumBorder(),
          textStyle: text.labelMedium,
        ),
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: scheme.inverseSurface,
          borderRadius: BorderRadius.circular(10),
        ),
        textStyle: text.bodySmall?.copyWith(color: scheme.onInverseSurface),
      ),
    );
  }
}
