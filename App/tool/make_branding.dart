// Dựng ảnh icon / màn chờ của app (assets/branding/*.png) từ logo web
// (Frontend/public/pwa-icon-512.png — thực chất là JPEG 1024×1024: ô vuông navy bo
// góc trên nền trắng xám, nên không dùng thẳng làm icon được).
//
// Gói `image` cố ý KHÔNG nằm trong pubspec (xem flutter_launcher_icons.yaml), nên
// file này bị loại khỏi `flutter analyze`. Chạy lại (từ Project/App):
//   flutter pub add --dev image
//   dart run tool/make_branding.dart              # sinh tất cả
//   dart run tool/make_branding.dart logo_tile    # chỉ sinh các ảnh được nêu tên
//   flutter pub remove image   # rồi `git checkout -- pubspec.lock` nếu lock bị đổi
// Sau đó chạy lại hai công cụ trong flutter_launcher_icons.yaml / flutter_native_splash.yaml
// (không cần nếu chỉ sinh logo_tile — ảnh đó dùng trong app, không phải icon).
import 'dart:io';

import 'package:image/image.dart' as img;

void main(List<String> only) {
  final source = img.decodeImage(File('../Frontend/public/pwa-icon-512.png').readAsBytesSync())!;
  // Navy of the rounded square, sampled inside it (away from the skyline).
  final navyPx = source.getPixel(300, 220);
  final navy = img.ColorRgb8(navyPx.r.toInt(), navyPx.g.toInt(), navyPx.b.toInt());
  stdout.writeln('navy #${_hex(navy.r)}${_hex(navy.g)}${_hex(navy.b)}');

  // Bounding box of the skyline: teal pixels (green well above red). The
  // off-white page around the rounded square has g ≈ r, so it never matches.
  var minX = 1024, minY = 1024, maxX = 0, maxY = 0;
  for (var y = 150; y < 874; y++) {
    for (var x = 150; x < 874; x++) {
      final p = source.getPixel(x, y);
      if (p.g - p.r > 50 && p.g > 100) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  stdout.writeln('skyline bbox x $minX..$maxX, y $minY..$maxY');
  const pad = 6;
  final crop = img.copyCrop(source,
      x: minX - pad, y: minY - pad, width: maxX - minX + 2 * pad, height: maxY - minY + 2 * pad);
  // The navy square in the JPEG is slightly shaded, so pasting the crop as-is
  // leaves a visible rectangle. Keep only the teal strokes: alpha from how much
  // greener than red a pixel is (soft edges keep the anti-aliasing).
  final skyline = img.Image(width: crop.width, height: crop.height, numChannels: 4);
  for (var y = 0; y < crop.height; y++) {
    for (var x = 0; x < crop.width; x++) {
      final p = crop.getPixel(x, y);
      // Navy itself has g − r ≈ 38: start above it so the shaded square leaves no trace.
      final alpha = (((p.g - p.r) - 48) / 70).clamp(0.0, 1.0);
      skyline.setPixelRgba(x, y, p.r, p.g, p.b, (alpha * 255).round());
    }
  }

  // Adaptive icons show only the inner ~66% of the 108dp canvas, launchers may
  // mask to a circle — keep the artwork within ~58% of the width, centred.
  img.Image onNavy(int size, double widthRatio) {
    final canvas = img.Image(width: size, height: size);
    img.fill(canvas, color: navy);
    final targetW = (size * widthRatio).round();
    final scaled = img.copyResize(skyline, width: targetW, interpolation: img.Interpolation.cubic);
    img.compositeImage(canvas, scaled,
        dstX: (size - scaled.width) ~/ 2, dstY: (size - scaled.height) ~/ 2);
    return canvas;
  }

  final outputs = <String, img.Image Function()>{
    // Icon thường (Android < 8, iOS): hình chiếm 58% bề ngang.
    'app_icon': () => onNavy(1024, 0.58),
    // Lớp trước của icon thích ứng: flutter_launcher_icons còn thụt thêm 16% mỗi
    // cạnh, nên hình phải to hơn (76% × 68% ≈ 52% khung 108dp — vẫn trong vòng an toàn).
    'app_icon_foreground': () => onNavy(1024, 0.76),
    // Android 12+ splash masks the icon to a circle (2/3 of its 288dp box).
    'splash_icon': () => onNavy(1152, 0.50),
    // Pre-Android-12 splash: centred artwork on the navy window background.
    'splash_logo': () => onNavy(768, 0.80),
    // Ô logo trong app (header trang chủ, màn đăng nhập): 40–44 dp, bo góc bằng
    // ClipRRect — 192 px đủ nét tới mật độ 4×, hình to hơn icon vì không bị mask.
    'logo_tile': () => onNavy(192, 0.74),
  };

  Directory('assets/branding').createSync(recursive: true);
  for (final name in only.isEmpty ? outputs.keys : only) {
    final build = outputs[name];
    if (build == null) {
      stderr.writeln('không có ảnh "$name" — chọn trong: ${outputs.keys.join(', ')}');
      exitCode = 64;
      return;
    }
    File('assets/branding/$name.png').writeAsBytesSync(img.encodePng(build()));
    stdout.writeln('wrote assets/branding/$name.png');
  }
}

String _hex(num v) => v.toInt().toRadixString(16).padLeft(2, '0').toUpperCase();
