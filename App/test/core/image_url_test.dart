import 'package:flutter_test/flutter_test.dart';
import 'package:smart_city_app/core/utils/image_url.dart';

void main() {
  const demo = 'https://res.cloudinary.com/demo-cloud/image/upload/v1791094287/smart-city-issues/demo/g20.jpg';

  test('ô vuông 96 dp ở 2,625× xin bản rộng 480', () {
    expect(
      cloudinarySized(demo, width: 96, height: 96, dpr: 2.625),
      'https://res.cloudinary.com/demo-cloud/image/upload/c_limit,w_480,q_auto/v1791094287/smart-city-issues/demo/g20.jpg',
    );
  });

  test('dải ảnh thấp vẫn đủ cho ảnh ngang 16:9 khi cắt kiểu cover', () {
    // 140 × 96 dp: cần ≥ 96 × 1,78 × 2 = 342 px → bậc 480.
    expect(cloudinarySized(demo, width: 140, height: 96, dpr: 2), contains('/c_limit,w_480,q_auto/'));
  });

  test('khung lớn hơn bậc cao nhất thì giữ ảnh gốc', () {
    expect(cloudinarySized(demo, width: 411, height: 400, dpr: 3), demo);
  });

  test('khung không giới hạn một chiều chỉ tính theo chiều còn lại', () {
    expect(cloudinarySized(demo, width: 100, height: double.infinity, dpr: 3), contains(',w_320,'));
    expect(cloudinarySized(demo, width: double.infinity, height: double.infinity, dpr: 3), demo);
  });

  test('không đụng URL ngoài Cloudinary hoặc đã có tham số biến đổi', () {
    const other = 'https://example.com/image/upload/a.jpg';
    const transformed = 'https://res.cloudinary.com/demo-cloud/image/upload/c_fill,w_100/v1/a.jpg';
    expect(cloudinarySized(other, width: 96, height: 96, dpr: 2), other);
    expect(cloudinarySized(transformed, width: 96, height: 96, dpr: 2), transformed);
  });
}
