const { DA_NANG_DISTRICTS, UNKNOWN_DISTRICT } = require('./districts');
const { ISSUE_CATEGORIES, DEFAULT_SLA_HOURS, INTAKE_SLA_HOURS } = require('./slaConfig');
const { ALLOWED_TRANSITIONS } = require('./issueStatusConfig');
const { PRIORITY_THRESHOLDS } = require('./priorityConfig');
const {
  MAX_REOPEN_COUNT,
  REOPEN_WINDOW_DAYS,
  MIN_REASON_LENGTH,
  MAX_REASON_LENGTH,
} = require('./reopenConfig');
const { MAX_ISSUE_IMAGES } = require('../models/Issue');

/**
 * Taxonomy phục vụ client — NGUỒN DUY NHẤT cho nhãn hiển thị.
 *
 * Vì sao cần: nhãn tiếng Việt trước đây CHỈ tồn tại ở `Frontend/src/utils/constants.ts`.
 * Backend chỉ biết giá trị enum ('pothole'), không biết nó hiển thị là 'Ổ gà'. Hệ quả
 * là email do backend gửi phải tự dịch nhãn ở một chỗ khác, và hai nguồn có thể lệch nhau.
 *
 * Với app mobile thì nghiêm trọng hơn một bậc: web sửa constant là deploy xong, còn
 * **app đã cài trên máy người dùng thì phải chờ duyệt lên store**. Mọi thứ có thể đổi
 * theo thời gian (danh mục, nhãn, khu vực, ngưỡng) phải đến từ server.
 *
 * `version` để client cache và chỉ tải lại khi đổi.
 */
const META_VERSION = '2026-10-01';

const CATEGORY_LABELS = {
  pothole: { label: 'Ổ gà', icon: '🕳️', color: '#FF6B35' },
  garbage: { label: 'Rác thải', icon: '🗑️', color: '#8B5CF6' },
  streetlight: { label: 'Đèn đường hỏng', icon: '💡', color: '#F59E0B' },
  flooding: { label: 'Ngập nước', icon: '🌊', color: '#3B82F6' },
  tree: { label: 'Cây đổ', icon: '🌳', color: '#10B981' },
  other: { label: 'Khác', icon: '📌', color: '#6B7280' },
};

/**
 * Màu trạng thái và mức ưu tiên đã được chỉnh để đạt WCAG AA khi dùng làm CHỮ
 * trên nền trắng. Bảng cũ ở frontend không đạt: `processing` #F59E0B chỉ 2.15:1,
 * priority `medium` #FBBF24 chỉ 1.67:1 — xem APP-DESIGN-SYSTEM.md mục 2.
 * `container` là nền đặc đi kèm, thay cho cách tô alpha 12% vốn cho kết quả
 * không dự đoán được.
 */
const STATUS_LABELS = {
  reported: { label: 'Mới báo cáo', color: '#A82C22', container: '#FBE9E7', icon: '🟡' },
  processing: { label: 'Đang xử lý', color: '#7D4F05', container: '#FDF2E0', icon: '🔵' },
  resolved: { label: 'Đã xử lý', color: '#17543E', container: '#E6F2EC', icon: '🟢' },
  rejected: { label: 'Từ chối', color: '#485862', container: '#EDF1F4', icon: '🔴' },
};

const PRIORITY_LABELS = {
  low: { label: 'Thấp', color: '#485862', container: '#EDF1F4' },
  medium: { label: 'Trung bình', color: '#6B4E00', container: '#FCF3DA' },
  high: { label: 'Cao', color: '#8A3D10', container: '#FCEDE2' },
  critical: { label: 'Khẩn cấp', color: '#8C1D16', container: '#FBE7E5' },
};

const SLA_STATUS_LABELS = {
  none: 'Chưa có hạn',
  on_time: 'Còn hạn',
  due_soon: 'Sắp đến hạn',
  overdue: 'Quá hạn',
  met: 'Hoàn thành đúng hạn',
  breached: 'Hoàn thành trễ hạn',
};

const NOTIFICATION_TYPE_LABELS = {
  issue_created: 'Sự cố mới',
  issue_updated: 'Cập nhật sự cố',
  issue_resolved: 'Sự cố đã xử lý',
  issue_rejected: 'Sự cố bị từ chối',
  comment: 'Bình luận',
  area_alert: 'Cảnh báo khu vực',
  issue_assigned: 'Được phân công',
  sla_reminder: 'Nhắc hạn xử lý',
  sla_escalated: 'Leo cấp quá hạn',
  issue_merged: 'Sự cố được gộp',
  intake_overdue: 'Quá hạn tiếp nhận',
  issue_reopened: 'Sự cố được mở lại',
  issue_rated: 'Người dân đã đánh giá',
  issue_unassigned: 'Sự cố được thu hồi',
  department_evaluated: 'Đánh giá đơn vị',
};

/**
 * Dựng payload meta. Tách thành hàm thuần để test không cần dựng request.
 */
const buildMeta = () => ({
  version: META_VERSION,

  categories: ISSUE_CATEGORIES.map((value) => ({
    value,
    ...CATEGORY_LABELS[value],
    slaHours: DEFAULT_SLA_HOURS[value],
    intakeHours: INTAKE_SLA_HOURS[value],
  })),

  statuses: Object.entries(STATUS_LABELS).map(([value, meta]) => ({ value, ...meta })),

  // Luật chuyển trạng thái về server, thay cho bản sao ở Frontend/src/utils/constants.ts.
  // Backend vẫn là nơi phán quyết cuối cùng; bảng này chỉ để client dựng bộ chọn.
  statusTransitions: ALLOWED_TRANSITIONS,

  priorities: Object.entries(PRIORITY_LABELS).map(([value, meta]) => ({
    value,
    ...meta,
    minScore: PRIORITY_THRESHOLDS[value] ?? 0,
  })),

  slaStatuses: Object.entries(SLA_STATUS_LABELS).map(([value, label]) => ({ value, label })),

  notificationTypes: Object.entries(NOTIFICATION_TYPE_LABELS)
    .map(([value, label]) => ({ value, label })),

  // Khu vực hiện vẫn là 8 quận/huyện cũ. Từ 01/07/2025 Việt Nam bỏ cấp quận/huyện
  // và Đà Nẵng mới có 94 đơn vị cấp xã — đây là hạn chế đã biết, ghi rõ ở mục 5.1
  // của KE-HOACH-FLUTTER-APP.md. Đưa danh sách ra endpoint này là bước chuẩn bị:
  // khi đổi sang mô hình mới, client không phải cập nhật theo.
  areas: [...DA_NANG_DISTRICTS, UNKNOWN_DISTRICT].map((value) => ({
    value,
    label: value,
    level: 'district',
  })),

  limits: {
    maxImages: MAX_ISSUE_IMAGES,
    maxImageMb: 5,
    maxTitleLength: 200,
    maxDescriptionLength: 2000,
    maxNoteLength: 500,
    maxCommentLength: 1000,
  },

  reopen: {
    maxCount: MAX_REOPEN_COUNT,
    windowDays: REOPEN_WINDOW_DAYS,
    minReasonLength: MIN_REASON_LENGTH,
    maxReasonLength: MAX_REASON_LENGTH,
  },
});

module.exports = {
  META_VERSION,
  CATEGORY_LABELS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  SLA_STATUS_LABELS,
  NOTIFICATION_TYPE_LABELS,
  buildMeta,
};
