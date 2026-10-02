import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:smart_city_app/core/theme/app_colors.dart';
import 'package:smart_city_app/core/theme/contrast.dart';

/// Nghiệm thu 0.5: "chạy script contrast trên bảng màu trong app_colors.dart —
/// **0 cặp dưới 4.5:1** cho text". Đọc thẳng hằng số của app, không chép lại.
void main() {
  group('công thức đúng (tự kiểm chứng trước khi tin kết quả)', () {
    test('đen/trắng = 21:1', () {
      expect(contrastRatio(const Color(0xFF000000), const Color(0xFFFFFFFF)), closeTo(21, 0.01));
    });

    test('khớp số đo trong design system: web processing #F59E0B = 2.15:1 (FAIL)', () {
      final r = contrastRatio(const Color(0xFFF59E0B), const Color(0xFFFFFFFF));
      expect(r, closeTo(2.15, 0.01));
      expect(wcagGrade(r), 'FAIL');
    });

    test('khớp số đo: app primary #0A5680 trên trắng = 7.91:1', () {
      expect(contrastRatio(const Color(0xFF0A5680), const Color(0xFFFFFFFF)), closeTo(7.91, 0.01));
    });
  });

  for (final (name, p) in [('light', AppPalette.light), ('dark', AppPalette.dark)]) {
    group('bảng $name — không cặp chữ nào dưới 4.5:1', () {
      final pairs = <String, (Color, Color)>{
        'textPrimary/surface': (p.textPrimary, p.surface),
        'textPrimary/background': (p.textPrimary, p.background),
        'textSecondary/surface': (p.textSecondary, p.surface),
        'textSecondary/background': (p.textSecondary, p.background),
        'textSecondary/surfaceAlt': (p.textSecondary, p.surfaceAlt),
        'primary/surface (link, nút viền)': (p.primary, p.surface),
        'onPrimary/primary (nút chính)': (p.onPrimary, p.primary),
        'onSecondary/secondary': (p.onSecondary, p.secondary),
        'error/surface': (p.error, p.surface),
        'onError/error': (p.onError, p.error),
        'offline banner': (p.offline.text, p.offline.container),
        'danger': (p.danger.text, p.danger.container),
        for (final e in p.status.entries) 'status ${e.key.name}': (e.value.text, e.value.container),
        for (final e in p.priority.entries) 'priority ${e.key.name}': (e.value.text, e.value.container),
        for (final e in p.sla.entries) 'sla ${e.key.wire}': (e.value.text, e.value.container),
      };

      for (final entry in pairs.entries) {
        test(entry.key, () {
          final (fg, bg) = entry.value;
          final ratio = contrastRatio(fg, bg);
          expect(ratio, greaterThanOrEqualTo(4.5),
              reason: '${entry.key}: ${ratio.toStringAsFixed(2)}:1 (${wcagGrade(ratio)})');
        });
      }
    });
  }
}
