/**
 * Cấu hình mở lại sự cố (khiếu nại kết quả xử lý) — NGUỒN DUY NHẤT.
 *
 * Vấn đề gốc mà tính năng này giải quyết: vòng đời phiếu trước đây chỉ chạy MỘT
 * HƯỚNG — người dân gửi, cán bộ xử lý, đóng phiếu. Người dân không có đường nào
 * đưa phiếu trở lại quy trình: chỉ có vote, rate, confirm-duplicate, và sửa/xoá
 * phiếu của mình khi còn 'reported'. Nếu đơn vị báo "đã xử lý" mà thực tế chưa
 * xong, hoặc từ chối không thoả đáng, người dân không làm gì được.
 *
 * Luồng chuyển trạng thái đã có sẵn đường về: `utils/issueStatusConfig.js` cho
 * phép resolved -> processing và rejected -> processing. Trước đây chỉ admin và
 * cán bộ đi được đường đó; tính năng này mở cho chính người báo cáo, kèm rào chắn.
 */

/** Số lần tối đa một người được mở lại cùng một phiếu. */
const MAX_REOPEN_COUNT = 2;

/**
 * Chỉ được mở lại trong N ngày kể từ lúc phiếu bị đóng. Quá hạn thì coi như đã
 * chấp nhận kết quả — nếu không, một phiếu đóng từ hai năm trước vẫn có thể bị
 * lôi lại và làm hỏng mọi thống kê theo kỳ.
 */
const REOPEN_WINDOW_DAYS = 30;

/** Bắt buộc nêu lý do, đủ dài để có nội dung thật chứ không phải "chưa xong". */
const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

/** Trạng thái đóng — chỉ hai trạng thái này mới mở lại được. */
const CLOSED_STATUSES = ['resolved', 'rejected'];

/**
 * Thời điểm phiếu bị đóng.
 *
 * `resolvedAt` chỉ được gán khi chuyển sang 'resolved', nên phiếu bị 'rejected'
 * không có mốc nào. Tra ngược statusHistory để tìm lần đóng gần nhất, và chỉ
 * dùng updatedAt khi không còn cách nào khác (dữ liệu cũ thiếu lịch sử).
 *
 * @returns {Date|null}
 */
const getClosedAt = (issue) => {
  const history = Array.isArray(issue?.statusHistory) ? issue.statusHistory : [];
  const lastClose = [...history]
    .reverse()
    .find((entry) => CLOSED_STATUSES.includes(entry?.status) && entry?.changedAt);
  if (lastClose) return new Date(lastClose.changedAt);
  if (issue?.resolvedAt) return new Date(issue.resolvedAt);
  return issue?.updatedAt ? new Date(issue.updatedAt) : null;
};

/**
 * Kiểm tra một người có được mở lại phiếu này không.
 *
 * Trả về mã lỗi máy đọc được thay vì chỉ chuỗi tiếng Việt, để app mobile phân
 * nhánh giao diện mà không phải so khớp câu chữ (xem utils/apiError.js).
 *
 * @returns {{ ok: boolean, code?: string, message?: string }}
 */
const checkCanReopen = (issue, userId, now = new Date()) => {
  if (!issue) {
    return { ok: false, code: 'ISSUE_NOT_FOUND', message: 'Sự cố không tồn tại' };
  }
  if (issue.mergedInto) {
    return {
      ok: false,
      code: 'MERGED_ISSUE',
      message: 'Báo cáo này đã được gộp; hãy mở lại sự cố gốc',
    };
  }

  const reporterId = issue.userId?._id || issue.userId;
  if (!reporterId || reporterId.toString() !== userId.toString()) {
    return {
      ok: false,
      code: 'NOT_REPORTER',
      message: 'Chỉ người báo cáo mới có thể mở lại sự cố này',
    };
  }

  if (!CLOSED_STATUSES.includes(issue.status)) {
    return {
      ok: false,
      code: 'ISSUE_NOT_CLOSED',
      message: 'Chỉ mở lại được sự cố đã xử lý xong hoặc bị từ chối',
    };
  }

  if ((issue.reopenCount || 0) >= MAX_REOPEN_COUNT) {
    return {
      ok: false,
      code: 'REOPEN_LIMIT_REACHED',
      message: `Mỗi sự cố chỉ được mở lại tối đa ${MAX_REOPEN_COUNT} lần. `
        + 'Vui lòng liên hệ trực tiếp đơn vị phụ trách.',
    };
  }

  const closedAt = getClosedAt(issue);
  if (closedAt) {
    const days = (now.getTime() - closedAt.getTime()) / (24 * 60 * 60 * 1000);
    if (days > REOPEN_WINDOW_DAYS) {
      return {
        ok: false,
        code: 'REOPEN_WINDOW_EXPIRED',
        message: `Chỉ mở lại được trong ${REOPEN_WINDOW_DAYS} ngày kể từ khi đóng phiếu`,
      };
    }
  }

  return { ok: true };
};

module.exports = {
  MAX_REOPEN_COUNT,
  REOPEN_WINDOW_DAYS,
  MIN_REASON_LENGTH,
  MAX_REASON_LENGTH,
  CLOSED_STATUSES,
  getClosedAt,
  checkCanReopen,
};
