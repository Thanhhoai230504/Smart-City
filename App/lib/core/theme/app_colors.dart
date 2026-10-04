import 'package:flutter/material.dart';

import '../../data/models/issue.dart';
import 'contrast.dart';

/// Cặp màu cho chip: **chữ trên nền đặc** — không dùng alpha tint.
///
/// Web từng tô `bgcolor: ${color}20` (alpha 12%) rồi lấy chính màu đó làm chữ:
/// nền hiệu dụng gần như trắng nên `processing` #F59E0B chỉ còn 2.15:1 (FAIL).
/// Design system mục 2–3: mọi cặp dưới đây đã đo bằng công thức WCAG 2.1 và
/// `test/core/theme/contrast_test.dart` chặn cặp nào dưới 4.5:1.
@immutable
class ChipColors {
  const ChipColors(this.text, this.container);

  final Color text;
  final Color container;
}

/// Bảng token của một theme. Gắn vào [ThemeData.extensions] để widget đọc bằng
/// `context.palette`.
@immutable
class AppPalette extends ThemeExtension<AppPalette> {
  const AppPalette({
    required this.brightness,
    required this.background,
    required this.surface,
    required this.surfaceAlt,
    required this.textPrimary,
    required this.textSecondary,
    required this.border,
    required this.primary,
    required this.onPrimary,
    required this.secondary,
    required this.onSecondary,
    required this.error,
    required this.onError,
    required this.field,
    required this.brandStart,
    required this.brandEnd,
    required this.onBrand,
    required this.onBrandMuted,
    required this.accent,
    required this.onAccent,
    required this.accentSoft,
    required this.accentInk,
    required this.cardShadow,
    required this.status,
    required this.priority,
    required this.sla,
    required this.offline,
  });

  final Brightness brightness;
  final Color background;
  final Color surface;
  final Color surfaceAlt;
  final Color textPrimary;
  final Color textSecondary;
  final Color border;
  final Color primary;
  final Color onPrimary;
  final Color secondary;
  final Color onSecondary;
  final Color error;
  final Color onError;

  /// Nền ô nhập liệu (kiểu "filled" — không viền cho tới khi focus).
  final Color field;

  /// Dải gradient thương hiệu "biển Đà Nẵng" cho header: xanh biển sâu → xanh
  /// đầm phá. Chữ trên đó dùng [onBrand] / [onBrandMuted] (≥ 4.5:1 ở cả hai đầu).
  final Color brandStart;
  final Color brandEnd;
  final Color onBrand;
  final Color onBrandMuted;

  /// Màu nhấn ấm (lửa Cầu Rồng) — chỉ cho nút Báo cáo và điểm nhấn đồ hoạ,
  /// không dùng làm chữ nhỏ. [accentInk] trên [accentSoft] dùng được cho chữ.
  final Color accent;
  final Color onAccent;
  final Color accentSoft;
  final Color accentInk;

  /// Bóng mềm cho card ở theme sáng; theme tối không dùng bóng (viền đủ rõ).
  final List<BoxShadow> cardShadow;

  LinearGradient get brandGradient => LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [brandStart, brandEnd],
      );

  final Map<IssueStatus, ChipColors> status;
  final Map<PriorityLevel, ChipColors> priority;
  final Map<SlaStatus, ChipColors> sla;

  /// Dải `OfflineBanner` (mục 6.6) — trạng thái thường trực nên cần cặp màu riêng.
  final ChipColors offline;

  ChipColors statusColors(IssueStatus s) =>
      status[s] ?? status[IssueStatus.rejected]!;

  ChipColors priorityColors(PriorityLevel p) => priority[p]!;

  ChipColors slaColors(SlaStatus s) => sla[s]!;

  /// Lỗi / cảnh báo nghiêm trọng trên nền đặc.
  ChipColors get danger => ChipColors(error, sla[SlaStatus.overdue]!.container);

  /// Thành công trên nền đặc.
  ChipColors get success => status[IssueStatus.resolved]!;

  // ── Light — mặc định (design system 3.1) ──
  static const light = AppPalette(
    brightness: Brightness.light,
    background: Color(0xFFF2F5F9),
    surface: Color(0xFFFFFFFF),
    surfaceAlt: Color(0xFFF5F8FB),
    textPrimary: Color(0xFF0F2233), // 14.81:1 trên background
    textSecondary: Color(0xFF4E6270), // 5.81:1 trên background
    border: Color(0xFFDFE6ED),
    primary: Color(0xFF0A5680), // 7.91:1
    onPrimary: Color(0xFFFFFFFF),
    secondary: Color(0xFF2A6F59),
    onSecondary: Color(0xFFFFFFFF), // 5.97:1
    error: Color(0xFFB3261E), // 6.54:1
    onError: Color(0xFFFFFFFF),
    field: Color(0xFFEEF2F6),
    brandStart: Color(0xFF0A5680), // chữ trắng 7.91:1
    brandEnd: Color(0xFF0C6E74), // chữ trắng 6.00:1
    onBrand: Color(0xFFFFFFFF),
    onBrandMuted: Color(0xFFD7EAF4), // 4.85:1 ở đầu nhạt nhất
    accent: Color(0xFFE8572A), // icon trắng 3.60:1 (đồ hoạ ≥ 3:1)
    onAccent: Color(0xFFFFFFFF),
    accentSoft: Color(0xFFFDECE4),
    accentInk: Color(0xFF9A3412), // 6.37:1
    cardShadow: [
      BoxShadow(color: Color(0x0F0B2540), blurRadius: 2, offset: Offset(0, 1)),
      BoxShadow(color: Color(0x140B2540), blurRadius: 20, offset: Offset(0, 8)),
    ],
    status: {
      IssueStatus.reported: ChipColors(Color(0xFFA82C22), Color(0xFFFBE9E7)), // 5.88
      IssueStatus.processing: ChipColors(Color(0xFF7D4F05), Color(0xFFFDF2E0)), // 6.33
      IssueStatus.resolved: ChipColors(Color(0xFF17543E), Color(0xFFE6F2EC)), // 7.70
      IssueStatus.rejected: ChipColors(Color(0xFF485862), Color(0xFFEDF1F4)), // 6.49
      IssueStatus.unknown: ChipColors(Color(0xFF485862), Color(0xFFEDF1F4)),
    },
    priority: {
      PriorityLevel.low: ChipColors(Color(0xFF485862), Color(0xFFEDF1F4)), // 6.49
      PriorityLevel.medium: ChipColors(Color(0xFF6B4E00), Color(0xFFFCF3DA)), // 6.99
      PriorityLevel.high: ChipColors(Color(0xFF8A3D10), Color(0xFFFCEDE2)), // 6.66
      PriorityLevel.critical: ChipColors(Color(0xFF8C1D16), Color(0xFFFBE7E5)), // 7.67
    },
    sla: {
      SlaStatus.none: ChipColors(Color(0xFF485862), Color(0xFFEDF1F4)),
      SlaStatus.onTime: ChipColors(Color(0xFF17543E), Color(0xFFE6F2EC)),
      SlaStatus.dueSoon: ChipColors(Color(0xFF7D4F05), Color(0xFFFDF2E0)),
      SlaStatus.overdue: ChipColors(Color(0xFFB3261E), Color(0xFFFBE7E5)),
      SlaStatus.met: ChipColors(Color(0xFF17543E), Color(0xFFE6F2EC)),
      SlaStatus.breached: ChipColors(Color(0xFF8C1D16), Color(0xFFFBE7E5)),
    },
    offline: ChipColors(Color(0xFF7D4F05), Color(0xFFFDF2E0)),
  );

  // ── Dark (design system 3.2) — không phải bản đảo của light: bão hoà thấp
  // hơn, nền không đen tuyệt đối (đen tuyệt đối gây smearing khi cuộn OLED).
  // Container của chip là nền tối pha màu; tương phản do contrast_test kiểm.
  static const dark = AppPalette(
    brightness: Brightness.dark,
    background: Color(0xFF0B141D),
    surface: Color(0xFF13202B),
    surfaceAlt: Color(0xFF1A2936),
    textPrimary: Color(0xFFE8EEF3),
    textSecondary: Color(0xFFA9BAC6), // 9.30:1 trên background
    border: Color(0xFF263646),
    primary: Color(0xFF7FB6D9), // 7.56:1
    onPrimary: Color(0xFF0B2536),
    secondary: Color(0xFF8FD3B4),
    onSecondary: Color(0xFF0D2A20),
    error: Color(0xFFFFB4AB),
    onError: Color(0xFF3B0A06),
    field: Color(0xFF1A2936),
    brandStart: Color(0xFF0E3D5C),
    brandEnd: Color(0xFF0B5257),
    onBrand: Color(0xFFFFFFFF),
    onBrandMuted: Color(0xFFCFE3EE),
    accent: Color(0xFFFF7A4D),
    onAccent: Color(0xFF3A1206), // 6.42:1 — chữ trắng trên cam sáng chỉ 2.6:1
    accentSoft: Color(0xFF3A2017),
    accentInk: Color(0xFFFFB59A),
    cardShadow: [],
    status: {
      IssueStatus.reported: ChipColors(Color(0xFFFFB4AB), Color(0xFF3A1F1D)),
      IssueStatus.processing: ChipColors(Color(0xFFFFD08A), Color(0xFF3A2E14)),
      IssueStatus.resolved: ChipColors(Color(0xFF8FD3B4), Color(0xFF16332A)),
      IssueStatus.rejected: ChipColors(Color(0xFFC9D3DA), Color(0xFF26313A)),
      IssueStatus.unknown: ChipColors(Color(0xFFC9D3DA), Color(0xFF26313A)),
    },
    priority: {
      PriorityLevel.low: ChipColors(Color(0xFFC9D3DA), Color(0xFF26313A)),
      PriorityLevel.medium: ChipColors(Color(0xFFFFD08A), Color(0xFF3A2E14)),
      PriorityLevel.high: ChipColors(Color(0xFFFFC59E), Color(0xFF3D2414)),
      PriorityLevel.critical: ChipColors(Color(0xFFFFB4AB), Color(0xFF3F1A17)),
    },
    sla: {
      SlaStatus.none: ChipColors(Color(0xFFC9D3DA), Color(0xFF26313A)),
      SlaStatus.onTime: ChipColors(Color(0xFF8FD3B4), Color(0xFF16332A)),
      SlaStatus.dueSoon: ChipColors(Color(0xFFFFD08A), Color(0xFF3A2E14)),
      SlaStatus.overdue: ChipColors(Color(0xFFFFB4AB), Color(0xFF3F1A17)),
      SlaStatus.met: ChipColors(Color(0xFF8FD3B4), Color(0xFF16332A)),
      SlaStatus.breached: ChipColors(Color(0xFFFFB4AB), Color(0xFF3F1A17)),
    },
    offline: ChipColors(Color(0xFFFFD08A), Color(0xFF3A2E14)),
  );

  @override
  AppPalette copyWith() => this;

  /// Bảng màu đổi rời rạc giữa sáng/tối, không nội suy từng token.
  @override
  AppPalette lerp(ThemeExtension<AppPalette>? other, double t) {
    if (other is! AppPalette) return this;
    return t < 0.5 ? this : other;
  }
}

extension PaletteContext on BuildContext {
  AppPalette get palette =>
      Theme.of(this).extension<AppPalette>() ?? AppPalette.light;
}

/// Đọc màu hex từ meta (`#FF6B35`). Màu category chỉ dùng cho **đồ hoạ**.
Color hexColor(String hex, [Color fallback = const Color(0xFF6B7280)]) {
  final cleaned = hex.replaceFirst('#', '');
  final value = int.tryParse(cleaned.length == 6 ? 'FF$cleaned' : cleaned, radix: 16);
  return value == null ? fallback : Color(value);
}

/// Màu của một danh mục (lấy từ meta, ví dụ `#F59E0B`) chỉnh lại cho đọc được:
/// nền là màu đó pha nhạt trên mặt card, icon/chữ được làm đậm (sáng) dần tới
/// khi đạt ≥ 4.5:1 với nền. Màu meta gốc (vàng, xanh lá) trên nền nhạt của chính
/// nó chỉ khoảng 2:1 — dùng thẳng thì icon gần như biến mất dưới nắng.
@immutable
class CategoryTone {
  const CategoryTone(this.ink, this.container);

  factory CategoryTone.of(Color base, AppPalette p) {
    final dark = p.brightness == Brightness.dark;
    final container = Color.alphaBlend(base.withValues(alpha: dark ? 0.24 : 0.13), p.surface);
    var ink = base;
    final hsl = HSLColor.fromColor(base);
    for (var i = 0; i < 12 && contrastRatio(ink, container) < 4.5; i++) {
      final l = (hsl.lightness + (dark ? 0.06 : -0.06) * (i + 1)).clamp(0.0, 1.0);
      ink = hsl.withLightness(l).toColor();
    }
    return CategoryTone(ink, container);
  }

  final Color ink;
  final Color container;
}
