import 'package:intl/intl.dart';

/// Định dạng ngày giờ/số theo `vi_VN` ở MỘT chỗ — web có ~20 chỗ hardcode
/// `'vi-VN'` rải rác (G25), app không lặp lại.
abstract final class Fmt {
  static final _time = DateFormat('HH:mm', 'vi');
  static final _date = DateFormat('dd/MM/yyyy', 'vi');
  static final _shortDate = DateFormat('dd/MM', 'vi');
  static final _number = NumberFormat.decimalPattern('vi');

  static String date(DateTime? d) => d == null ? '—' : _date.format(d);

  static String dateTime(DateTime? d) =>
      d == null ? '—' : '${_time.format(d)} · ${_date.format(d)}';

  static String shortDate(DateTime? d) => d == null ? '—' : _shortDate.format(d);

  static String number(num n) => _number.format(n);

  /// "vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước", rồi ngày cụ thể.
  static String relative(DateTime? d, {DateTime? now}) {
    if (d == null) return '—';
    final diff = (now ?? DateTime.now()).difference(d);
    if (diff.isNegative || diff.inSeconds < 60) return 'vừa xong';
    if (diff.inMinutes < 60) return '${diff.inMinutes} phút trước';
    if (diff.inHours < 24) return '${diff.inHours} giờ trước';
    if (diff.inDays < 7) return '${diff.inDays} ngày trước';
    return date(d);
  }

  /// "350 m" · "1,2 km".
  static String distance(double meters) {
    if (meters < 1000) return '${meters.round()} m';
    final km = meters / 1000;
    return '${NumberFormat('#,##0.0', 'vi').format(km)} km';
  }

  /// Khoảng thời gian gọn: "3 ngày 4 giờ", "2 giờ 15 phút", "12 phút".
  static String span(Duration d) {
    final total = d.abs();
    final days = total.inDays;
    final hours = total.inHours % 24;
    final minutes = total.inMinutes % 60;
    if (days > 0) return hours > 0 ? '$days ngày $hours giờ' : '$days ngày';
    if (total.inHours > 0) {
      return minutes > 0 ? '${total.inHours} giờ $minutes phút' : '${total.inHours} giờ';
    }
    return '${total.inMinutes < 1 ? 1 : total.inMinutes} phút';
  }

  static String hours(double h) {
    if (h <= 0) return '—';
    if (h < 1) return '${(h * 60).round()} phút';
    if (h < 48) return '${NumberFormat('#,##0.#', 'vi').format(h)} giờ';
    return '${NumberFormat('#,##0.#', 'vi').format(h / 24)} ngày';
  }

  static final _letter = RegExp(r'\p{L}', unicode: true);

  /// Chữ cái đầu cho avatar, bỏ qua ký hiệu ("[TEST] An" → "T"); tên rỗng → "?".
  static String initial(String? name) => _letter.firstMatch(name ?? '')?.group(0)!.toUpperCase() ?? '?';

  /// Tên gọi trong lời chào — từ cuối của họ tên Việt ("Nguyễn Văn An" → "An");
  /// '' nếu tên không có chữ.
  static String givenName(String? name) {
    final words = (name ?? '').trim().split(RegExp(r'\s+')).where(_letter.hasMatch);
    return words.isEmpty ? '' : words.last;
  }
}
