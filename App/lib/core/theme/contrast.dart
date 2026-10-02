import 'dart:math' as math;
import 'dart:ui';

/// Tỷ lệ tương phản WCAG 2.1 (relative luminance) — cùng công thức với
/// `scripts/contrast.js` ở phụ lục design system, để số đo hai nơi khớp nhau.
double contrastRatio(Color a, Color b) {
  final la = _luminance(a);
  final lb = _luminance(b);
  final hi = math.max(la, lb);
  final lo = math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

double _channel(double c) =>
    c <= 0.03928 ? c / 12.92 : math.pow((c + 0.055) / 1.055, 2.4).toDouble();

double _luminance(Color c) =>
    0.2126 * _channel(c.r) + 0.7152 * _channel(c.g) + 0.0722 * _channel(c.b);

String wcagGrade(double ratio) => ratio >= 7
    ? 'AAA'
    : ratio >= 4.5
        ? 'AA'
        : ratio >= 3
            ? 'AA-large'
            : 'FAIL';
