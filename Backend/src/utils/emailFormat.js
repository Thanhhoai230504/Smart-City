/**
 * Định dạng email kiểm ở tầng model (User, Department).
 *
 * Chỉ kiểm tối thiểu: không khoảng trắng, đúng một @, tên miền có ít nhất một dấu
 * chấm và không có nhãn rỗng. Kiểm chặt hơn là việc của isEmail() ở validator.
 *
 * Biểu thức cũ `^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$` (Department dùng biến thể
 * `{2,}`) có ba vấn đề:
 *   - từ chối địa chỉ hợp lệ: dấu "+" (ten+thu@gmail.com), đuôi dài như .info, .email;
 *   - lồng lượng từ nên chuỗi không khớp làm bộ máy regex quay lui theo cấp số mũ
 *     (ReDoS): 27 ký tự mất 65 ms, mỗi ký tự thêm gấp đôi;
 *   - email ẩn danh khi xoá tài khoản (`deleted-<24 hex>@deleted.invalid`) không khớp,
 *     nên lưu tài khoản đã xoá có thể treo tiến trình.
 * Ở đây mỗi nhãn tên miền không chứa dấu chấm nên mỗi chuỗi chỉ có một cách khớp,
 * thời gian chạy tuyến tính theo độ dài.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

module.exports = { EMAIL_PATTERN };
