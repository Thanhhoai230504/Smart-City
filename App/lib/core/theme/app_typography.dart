import 'package:flutter/material.dart';

/// **Be Vietnam Pro** cho toàn bộ app — một họ chữ, năm độ đậm (400–800).
///
/// Thiết kế riêng cho tiếng Việt: dấu xếp chồng (ễ, ữ, ợ) có chỗ đứng trong
/// vertical metrics nên không bị cắt ở line-height chặt như nhiều font Latin.
/// Font nhúng trong `assets/fonts/` — không tải mạng, mở offline vẫn đúng chữ.
/// Cỡ chữ người dùng đặt trong máy vẫn được tôn trọng (app kẹp 1.0–1.6×).
abstract final class AppTypography {
  static const family = 'BeVietnamPro';

  /// Letter-spacing trong tài liệu tính theo em; Flutter tính theo dp.
  static double _em(double em, double size) => em * size;

  /// Thang chữ: tiêu đề đậm và chặt (−0.02em) để có "giọng" riêng; body 15–16
  /// thoáng (line-height ~1.55) vì Be Vietnam Pro có x-height lớn.
  /// **Không all-caps** cho text có dấu tiếng Việt.
  static TextTheme textTheme(Color primary, Color secondary) {
    TextStyle s(double size, double line, FontWeight w, double em, Color c) => TextStyle(
          fontFamily: family,
          fontSize: size,
          height: line / size,
          fontWeight: w,
          letterSpacing: _em(em, size),
          color: c,
          // Dấu tiếng Việt cao: chia đều khoảng trống trên/dưới để chữ nằm giữa
          // nút và chip thay vì lệch xuống.
          leadingDistribution: TextLeadingDistribution.even,
        );

    return TextTheme(
      displayLarge: s(36, 44, FontWeight.w800, -0.025, primary),
      displayMedium: s(32, 40, FontWeight.w800, -0.02, primary),
      displaySmall: s(28, 36, FontWeight.w800, -0.02, primary),
      headlineLarge: s(26, 34, FontWeight.w700, -0.02, primary),
      headlineMedium: s(24, 32, FontWeight.w700, -0.015, primary),
      headlineSmall: s(20, 28, FontWeight.w700, -0.01, primary),
      titleLarge: s(18, 26, FontWeight.w700, -0.005, primary),
      titleMedium: s(16, 24, FontWeight.w600, 0, primary),
      titleSmall: s(14, 20, FontWeight.w600, 0, primary),
      bodyLarge: s(16, 26, FontWeight.w400, 0, primary),
      bodyMedium: s(15, 23, FontWeight.w400, 0, primary),
      bodySmall: s(13, 19, FontWeight.w400, 0.005, secondary),
      labelLarge: s(15, 20, FontWeight.w600, 0, primary),
      labelMedium: s(13, 18, FontWeight.w600, 0.005, primary),
      labelSmall: s(12, 16, FontWeight.w600, 0.01, primary),
    );
  }
}
