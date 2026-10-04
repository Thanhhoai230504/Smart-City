import 'package:flutter_test/flutter_test.dart';
import 'package:smart_city_app/core/utils/formatters.dart';

void main() {
  // Lần thử trên server thật: tài khoản "[TEST] Người dân" hiện avatar "[" — chữ
  // cái đầu phải bỏ qua ký hiệu; tên rỗng thì `characters.first` còn ném lỗi.
  group('Fmt.initial', () {
    test('lấy chữ cái đầu tiên, bỏ qua ký hiệu', () {
      expect(Fmt.initial('[TEST] Người dân'), 'T');
      expect(Fmt.initial('đặng văn an'), 'Đ');
      expect(Fmt.initial('  "Ánh" '), 'Á');
    });

    test('không có chữ hoặc null → "?"', () {
      expect(Fmt.initial(''), '?');
      expect(Fmt.initial('123 !!'), '?');
      expect(Fmt.initial(null), '?');
    });
  });

  group('Fmt.givenName', () {
    test('từ cuối của họ tên Việt', () {
      expect(Fmt.givenName('Nguyễn Văn An'), 'An');
      expect(Fmt.givenName('  Trần   Thị  Bích  '), 'Bích');
    });

    test('tên Google theo thứ tự phương Tây → lấy từ đầu', () {
      expect(Fmt.givenName('Hoai Nguyễn'), 'Hoai');
      expect(Fmt.givenName('Hoai Nguyen'), 'Hoai');
      expect(Fmt.givenName('Minh Anh Tran'), 'Minh');
    });

    test('họ đứng đầu (thứ tự Việt) vẫn lấy từ cuối, kể cả khi tên trùng một họ', () {
      expect(Fmt.givenName('Nguyễn Thị Mai'), 'Mai');
      expect(Fmt.givenName('Trần Văn Lê'), 'Lê');
      expect(Fmt.givenName('Thu Hà'), 'Hà');
    });

    test('bỏ từ không có chữ; không có chữ → rỗng', () {
      expect(Fmt.givenName('Lê Minh -'), 'Minh');
      expect(Fmt.givenName('   '), '');
      expect(Fmt.givenName(null), '');
    });
  });
}
