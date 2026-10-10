import { describe, it, expect } from 'vitest';
import { cloudinarySized, escapeHtml, formatDate, formatDateShort, timeAgo } from './helpers';

/**
 * `escapeHtml` là hàng rào chống XSS cho hai chỗ xuất báo cáo.
 *
 * Cả hai dựng chuỗi HTML rồi `document.write` vào cửa sổ mở bằng
 * `window.open('', '_blank')` — cửa sổ đó CÙNG ORIGIN nên đọc được `localStorage`,
 * nơi đang lưu access token. Không escape thì một người dùng thường đặt tiêu đề
 * sự cố dạng `<img src=x onerror=...>` có thể lấy token của admin, kích hoạt bởi
 * chính admin khi bấm nút xuất báo cáo.
 */
describe('escapeHtml', () => {
  it('neutralises a script payload', () => {
    const out = escapeHtml('<img src=x onerror=alert(document.cookie)>');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
  });

  it('closes both attribute-breakout routes', () => {
    expect(escapeHtml('"><script>alert(1)</script>')).not.toContain('"');
    expect(escapeHtml("'><script>")).not.toContain("'");
  });

  it('escapes all five characters that matter', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  // `&` phải thay đầu tiên, nếu không sẽ escape ngược các entity vừa tạo ra.
  it('escapes the ampersand first so entities are not double-escaped wrongly', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });

  it('leaves Vietnamese diacritics untouched', () => {
    expect(escapeHtml('Ổ gà đường Nguyễn Văn Linh')).toBe('Ổ gà đường Nguyễn Văn Linh');
  });

  it.each([
    [null, ''],
    [undefined, ''],
    // Số 0 phải ra '0', không được thành chuỗi rỗng — nếu không thì ô "0 lượt"
    // sẽ hiện trống trong báo cáo.
    [0, '0'],
    [false, 'false'],
  ])('converts %p to %p', (input, expected) => {
    expect(escapeHtml(input)).toBe(expected);
  });
});

describe('formatDate', () => {
  it('renders a Vietnamese date with time', () => {
    const out = formatDate('2026-10-01T07:30:00.000Z');
    expect(out).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('formatDateShort omits the time', () => {
    const out = formatDateShort('2026-10-01T07:30:00.000Z');
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

describe('timeAgo', () => {
  const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

  it.each([
    [0.2, 'Vừa xong'],
    [5, '5 phút trước'],
    [120, '2 giờ trước'],
    [60 * 24 * 2, '2 ngày trước'],
  ])('describes %p minutes ago as "%s"', (mins, expected) => {
    expect(timeAgo(minutesAgo(mins))).toBe(expected);
  });

  // Quá một tuần thì "8 ngày trước" kém hữu ích hơn ngày cụ thể.
  it('falls back to a concrete date beyond a week', () => {
    expect(timeAgo(minutesAgo(60 * 24 * 10))).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

describe('cloudinarySized', () => {
  it('inserts the transformation right after /upload/', () => {
    expect(cloudinarySized('https://res.cloudinary.com/demo/image/upload/v17/smart-city/a.jpg', 'c_fill,w_200,h_200'))
      .toBe('https://res.cloudinary.com/demo/image/upload/c_fill,w_200,h_200/v17/smart-city/a.jpg');
  });

  it('leaves images hosted elsewhere untouched', () => {
    const url = 'https://example.com/upload/a.jpg';
    expect(cloudinarySized(url, 'w_200')).toBe(url);
  });
});
