import { describe, it, expect } from 'vitest';
import { parseMapView } from './mapView';

/**
 * Khung nhìn đọc lại từ sessionStorage đi thẳng vào `MapContainer`. Giá trị hỏng mà lọt qua thì
 * bản đồ mở ra nền xám ở toạ độ vô nghĩa, nên mọi thứ không hợp lệ phải rơi về khung mặc định.
 */
describe('parseMapView', () => {
  it('reads a saved view', () => {
    expect(parseMapView('{"lat":16.0544,"lng":108.2022,"zoom":15}')).toEqual({ lat: 16.0544, lng: 108.2022, zoom: 15 });
  });

  it.each([
    ['nothing saved', null],
    ['an empty string', ''],
    ['broken JSON', '{"lat":16'],
    ['JSON null', 'null'],
    ['a bare number', '42'],
    ['a missing zoom', '{"lat":16,"lng":108}'],
    ['coordinates as strings', '{"lat":"16","lng":"108","zoom":13}'],
    ['a latitude out of range', '{"lat":96,"lng":108,"zoom":13}'],
    ['a longitude out of range', '{"lat":16,"lng":208,"zoom":13}'],
    ['a negative zoom', '{"lat":16,"lng":108,"zoom":-1}'],
  ])('falls back to the default view for %s', (_label, raw) => {
    expect(parseMapView(raw)).toBeNull();
  });
});
