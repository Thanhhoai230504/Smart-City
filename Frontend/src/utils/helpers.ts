export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDateShort = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Escape một chuỗi trước khi nội suy vào HTML.
 *
 * Hai chỗ xuất báo cáo (ExportButton và công văn ở IssueDetail) dựng chuỗi HTML rồi
 * `document.write` vào cửa sổ mở bằng `window.open('', '_blank')`. Cửa sổ đó CÙNG
 * ORIGIN với ứng dụng nên đọc được `localStorage` — nơi đang lưu access token.
 * Không escape thì một người dùng thường đặt tiêu đề sự cố dạng
 * `<img src=x onerror=...>` sẽ chạy được script trong phiên của admin, kích hoạt
 * bởi chính admin khi bấm nút xuất báo cáo.
 *
 * Mọi giá trị có nguồn gốc từ người dùng nội suy vào hai template này BẮT BUỘC đi
 * qua hàm này. Thêm chỗ nội suy mới mà không escape là mở lại lỗ hổng.
 */
export const escapeHtml = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  // & phải thay đầu tiên, nếu không sẽ escape ngược các entity vừa tạo ra.
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const timeAgo = (dateString: string): string => {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'Vừa xong';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;
  return formatDateShort(dateString);
};
