/**
 * Luật chuyển trạng thái sự cố — NGUỒN DUY NHẤT ở phía backend.
 *
 * Trước đây `updateIssueStatus` chỉ kiểm tra giá trị mới có thuộc enum hay không,
 * nên MỌI cặp chuyển tiếp đều được nhận: gọi thẳng `PATCH /api/issues/:id/status`
 * với `status: 'reported'` lùi được một phiếu đã xử lý về "mới báo cáo", xoá mất
 * dấu vết đã có người tiếp nhận. Ba màn hình web còn quy định ba kiểu khác nhau
 * (bảng quản trị sự cố cho chọn cả 'reported', màn chi tiết admin thì không), nên
 * ràng buộc phải nằm ở service chứ không thể để từng client tự giữ.
 *
 * App mobile là client thứ hai — nếu luật chỉ nằm ở UI thì app sẽ kế thừa lỗ hổng.
 */

/**
 * Đích đến hợp lệ cho từng trạng thái hiện tại.
 *
 * - 'reported' KHÔNG BAO GIỜ là đích: phiếu đã được tiếp nhận thì không lùi về
 *   "mới báo cáo" được nữa.
 * - Hai trạng thái đóng ('resolved', 'rejected') chỉ mở lại được bằng cách quay về
 *   'processing', không nhảy thẳng sang nhau — "từ chối một phiếu đã xử lý xong"
 *   không phải một nghiệp vụ có nghĩa, và nếu đổi ý thật thì đi qua 'processing'
 *   để lịch sử còn đọc được.
 * - Không có self-transition. Xem ghi chú ở canTransition.
 */
const ALLOWED_TRANSITIONS = {
  reported: ['processing', 'resolved', 'rejected'],
  processing: ['resolved', 'rejected'],
  resolved: ['processing'],
  rejected: ['processing'],
};

/**
 * @param {string} from - Trạng thái hiện tại
 * @param {string} to - Trạng thái muốn chuyển sang
 * @returns {boolean}
 */
const canTransition = (from, to) => {
  const targets = ALLOWED_TRANSITIONS[from];
  if (!Array.isArray(targets)) return false;
  if (typeof to !== 'string') return false;
  return targets.includes(to);
};

/**
 * Danh sách đích đến hợp lệ — trả về để client dựng bộ chọn trạng thái thay vì
 * tự hardcode. Client gọi sai vẫn bị service chặn, đây chỉ là tiện ích.
 */
const getAllowedTargets = (from) => ALLOWED_TRANSITIONS[from] || [];

module.exports = { ALLOWED_TRANSITIONS, canTransition, getAllowedTargets };
