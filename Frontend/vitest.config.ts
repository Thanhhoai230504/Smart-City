import { defineConfig } from 'vitest/config';

/**
 * Cấu hình test cho frontend.
 *
 * Trước đây dự án có 0 file test ở frontend trong khi backend có hơn 500 — chênh
 * lệch đó là câu hỏi hiển nhiên khi bảo vệ.
 *
 * Phạm vi có chủ đích: logic thuần ở `utils` và reducer ở `store`. 81% mã frontend
 * nằm trong `src/pages` (trung bình ~364 dòng/trang), nên cố test giao diện sẽ tốn
 * nhiều công mà bắt được ít lỗi. Những hàm được test ở đây là nơi lỗi gây hậu quả
 * thật: `escapeHtml` chặn XSS, bảng chuyển trạng thái quyết định nút nào hiện ra.
 */
export default defineConfig({
  test: {
    // Không cần jsdom: toàn bộ test ở đây là hàm thuần và reducer.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
  },
});
