/**
 * Escape chuỗi trước khi chèn vào HTML.
 *
 * Dùng cho MỌI giá trị có nguồn gốc người dùng (tên, tiêu đề, địa chỉ, ghi chú)
 * khi dựng HTML email. Email đi ra từ chính hệ thống nên người nhận tin nó; mail
 * client chặn script nhưng không chặn link, ảnh theo dõi hay HTML giả giao diện.
 *
 * Cùng hành vi với `escapeHtml` ở Frontend/src/utils/helpers.ts (task E4).
 */
const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;') // phải đứng đầu, nếu không sẽ escape kép
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

module.exports = { escapeHtml };
