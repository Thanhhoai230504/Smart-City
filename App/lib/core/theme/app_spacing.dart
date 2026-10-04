import 'package:flutter/widgets.dart';

/// Thang khoảng cách (design system mục 7): `4 · 8 · 12 · 16 · 20 · 24 · 32`.
abstract final class Gap {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;

  /// Lề màn hình 16 — không 24, màn nhỏ cần chiều ngang.
  static const double screen = lg;

  /// Giữa các card.
  static const double betweenCards = md;

  /// Padding trong card.
  static const double card = lg;

  static const EdgeInsets screenPadding = EdgeInsets.symmetric(horizontal: screen);

  static const SizedBox h4 = SizedBox(height: xs);
  static const SizedBox h8 = SizedBox(height: sm);
  static const SizedBox h12 = SizedBox(height: md);
  static const SizedBox h16 = SizedBox(height: lg);
  static const SizedBox h24 = SizedBox(height: xxl);
  static const SizedBox w4 = SizedBox(width: xs);
  static const SizedBox w8 = SizedBox(width: sm);
  static const SizedBox w12 = SizedBox(width: md);
  static const SizedBox w16 = SizedBox(width: lg);
}

/// Bo góc mềm, lớn hơn bản đầu để app có dáng riêng: card 20 · nút 16 ·
/// input 14 · ảnh 14 · chip dạng viên thuốc · bottom sheet 28 · header 28.
abstract final class Radii {
  static const double card = 20;
  static const double button = 16;
  static const double input = 14;
  static const double chip = 999;
  static const double sheet = 28;
  static const double image = 14;
  static const double hero = 28;
  static const double tile = 16;
}

/// Chuyển động 150–250 ms, `easeOutCubic`, không quá 300 ms.
abstract final class Motion {
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 220);
  static const Curve curve = Curves.easeOutCubic;

  /// Tôn trọng cài đặt tắt hiệu ứng của hệ thống.
  static Duration of(BuildContext context, [Duration d = normal]) =>
      MediaQuery.maybeDisableAnimationsOf(context) == true ? Duration.zero : d;
}

/// Vùng chạm tối thiểu 48×48 dp (mục 6.4).
const double kMinTouchTarget = 48;
