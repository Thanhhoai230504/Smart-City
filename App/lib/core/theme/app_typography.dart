import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Hai họ font, có chủ đích (design system mục 4.1):
/// - **Display** (tiêu đề màn hình, h1–h3, số lớn): **Inter** 600/700 — giống
///   hệt web (`theme.ts`), có đủ subset `vietnamese`.
/// - **Body/UI**: **font hệ thống** (SF Pro / Roboto) — hinting tốt nhất ở
///   15–16px và tự co giãn theo cỡ chữ người dùng đặt trong Settings.
///
/// Đổi sang Be Vietnam Pro: sửa đúng [_display].
abstract final class AppTypography {
  /// Test tắt font tải ngoài để không phụ thuộc mạng.
  static bool displayFontEnabled = true;

  static TextStyle _display(TextStyle base) =>
      displayFontEnabled ? GoogleFonts.inter(textStyle: base) : base;

  /// Letter-spacing trong tài liệu tính theo em; Flutter tính theo dp.
  static double _em(double em, double size) => em * size;

  /// Type scale mục 4.2 — app lớn hơn web một bậc: body chính 16, sàn 13.
  /// **Không all-caps** cho text có dấu tiếng Việt.
  static TextTheme textTheme(Color primary, Color secondary) {
    TextStyle s(double size, double line, FontWeight w, double em, Color c) =>
        TextStyle(
          fontSize: size,
          height: line / size,
          fontWeight: w,
          letterSpacing: _em(em, size),
          color: c,
        );

    return TextTheme(
      displayLarge: _display(s(34, 40, FontWeight.w700, -0.02, primary)),
      displayMedium: _display(s(30, 36, FontWeight.w700, -0.02, primary)),
      displaySmall: _display(s(28, 34, FontWeight.w700, -0.015, primary)),
      headlineLarge: _display(s(28, 34, FontWeight.w700, -0.015, primary)),
      headlineMedium: _display(s(26, 32, FontWeight.w700, -0.015, primary)),
      headlineSmall: _display(s(22, 28, FontWeight.w700, -0.01, primary)),
      titleLarge: _display(s(19, 26, FontWeight.w600, -0.01, primary)),
      titleMedium: s(16, 22, FontWeight.w600, 0, primary),
      titleSmall: s(15, 20, FontWeight.w600, 0, primary),
      bodyLarge: s(16, 26, FontWeight.w400, 0, primary),
      bodyMedium: s(15, 23, FontWeight.w400, 0, primary),
      bodySmall: s(13, 18, FontWeight.w400, 0.01, secondary),
      labelLarge: s(15, 20, FontWeight.w600, 0.01, primary),
      labelMedium: s(13, 18, FontWeight.w600, 0.02, primary),
      labelSmall: s(12, 16, FontWeight.w600, 0.03, primary),
    );
  }
}
