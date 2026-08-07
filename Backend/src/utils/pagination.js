/**
 * Chuẩn hoá phân trang từ query string.
 *
 * Không dùng trực tiếp `parseInt()` tại từng service vì `NaN`, số âm hoặc
 * `limit` quá lớn có thể tạo truy vấn tốn RAM/CPU. Mọi endpoint danh sách
 * nên đi qua helper này để có cùng một giới hạn an toàn.
 */
const parsePagination = (
  { page = 1, limit } = {},
  { defaultLimit = 10, maxLimit = 100 } = {}
) => {
  const parsedPage = Number.parseInt(page, 10);
  const parsedLimit = Number.parseInt(limit, 10);
  const pageNum = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const requestedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? parsedLimit
    : defaultLimit;
  const limitNum = Math.min(requestedLimit, maxLimit);

  return {
    pageNum,
    limitNum,
    skip: (pageNum - 1) * limitNum,
  };
};

module.exports = { parsePagination };
