/**
 * Lượt xử lý của một sự cố.
 *
 * Mỗi lần phiếu đã đóng (đã xử lý / từ chối) bị mở lại là bắt đầu một LƯỢT mới.
 * Trước đây mở lại chỉ đổi trạng thái về "Đang xử lý" và giữ nguyên ảnh minh chứng
 * + đánh giá cũ, nên:
 *   - cán bộ báo xong lần nữa được ngay, bằng chính bộ ảnh người dân vừa khiếu nại
 *     (điều kiện "phải có ảnh minh chứng" đã thoả từ lượt trước);
 *   - người dân không đánh giá lại được (ALREADY_RATED) dù nhận email mời đánh giá;
 *   - đủ 5 ảnh cũ thì cán bộ không tải thêm minh chứng mới được nữa.
 *
 * Giờ lượt cũ được cất vào `previousRounds` rồi các field của lượt hiện tại được
 * đặt lại. Dùng chung cho hai đường mở lại: người dân khiếu nại
 * (reopenService) và cán bộ/admin chuyển phiếu đã đóng về "Đang xử lý"
 * (issueService.updateIssueStatus).
 */

const CLOSED_STATUSES = ['resolved', 'rejected'];

const toPlain = (value) => (value && typeof value.toObject === 'function' ? value.toObject() : value);

/** Mốc đóng của lượt hiện tại: resolvedAt, hoặc lần chuyển sang "Từ chối" gần nhất. */
const getClosedAt = (issue) => {
  if (issue.status === 'resolved') return issue.resolvedAt || null;
  if (issue.status === 'rejected') {
    const history = issue.statusHistory || [];
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (history[i]?.status === 'rejected') return history[i].changedAt || null;
    }
  }
  return null;
};

/**
 * Bản lưu trữ của lượt đang khép lại. Gọi TRƯỚC khi đổi trạng thái, trên bản đọc
 * từ DB (cần status, resolvedAt, statusHistory, resolutionImages, rating).
 */
const buildRoundArchive = (issue, { reopenedAt, reopenedBy, reason = '' }) => {
  const rating = toPlain(issue.rating) || {};
  return {
    closedStatus: CLOSED_STATUSES.includes(issue.status) ? issue.status : null,
    closedAt: getClosedAt(issue),
    resolutionImages: (issue.resolutionImages || []).map((img) => {
      const plain = toPlain(img);
      return {
        url: plain.url,
        publicId: plain.publicId ?? null,
        uploadedBy: plain.uploadedBy ?? null,
        uploadedAt: plain.uploadedAt ?? null,
      };
    }),
    rating: {
      score: rating.score ?? null,
      comment: rating.comment ?? null,
      ratedAt: rating.ratedAt ?? null,
    },
    reopenedAt,
    reopenedBy,
    reopenReason: String(reason || '').slice(0, 500),
  };
};

/** Field của lượt hiện tại cần đặt lại khi mở lượt mới (dùng trong `$set`). */
const resetRoundFields = () => ({
  resolvedAt: null,
  resolutionImages: [],
  rating: { score: null, comment: null, ratedAt: null },
});

module.exports = { CLOSED_STATUSES, getClosedAt, buildRoundArchive, resetRoundFields };
