import 'dart:math' as math;

/// Các bề rộng Cloudinary được phép xin — ít bậc để mỗi ảnh chỉ sinh vài bản
/// thu nhỏ (cache CDN trúng nhiều, không tốn lượt biến đổi).
const cloudinaryWidths = [320, 480, 640, 960, 1280, 1600];

/// URL Cloudinary thu nhỏ vừa đủ cho khung [width] × [height] (dp) hiển thị kiểu
/// `BoxFit.cover`: ảnh ngang tới 16:9 cần bề rộng ≥ 1,78 × chiều cao khung.
///
/// Đo trên ảnh mẫu: bản gốc 90–370 KB, bản rộng 480 px chỉ 20–55 KB — ô ảnh
/// 96 dp của danh sách không cần hơn. Giữ nguyên URL khi không phải ảnh
/// Cloudinary, URL đã có tham số biến đổi, khung không giới hạn, hoặc khung
/// lớn hơn bậc cao nhất.
String cloudinarySized(String url, {required double width, required double height, required double dpr}) {
  const marker = '/image/upload/';
  final at = url.indexOf(marker);
  if (at < 0 || !url.contains('res.cloudinary.com')) return url;
  final sides = [if (width.isFinite) width, if (height.isFinite) height * 1.78];
  if (sides.isEmpty) return url;
  final rest = url.substring(at + marker.length);
  // Đoạn đầu là tham số (w_480, c_fill, t_thumb…) chứ không phải phiên bản v123.
  if (RegExp(r'^[a-z]{1,3}_').hasMatch(rest)) return url;
  final need = sides.reduce(math.max) * dpr;
  for (final w in cloudinaryWidths) {
    if (w >= need) return '${url.substring(0, at + marker.length)}c_limit,w_$w,q_auto/$rest';
  }
  return url;
}
