export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Da Nang center coordinates
export const DA_NANG_CENTER = { lat: 16.0544, lng: 108.2022 };
export const DEFAULT_ZOOM = 13;

// Issue categories with Vietnamese labels and colors
export const CATEGORY_MAP: Record<string, { label: string; color: string; icon: string }> = {
  pothole: { label: 'Ổ gà', color: '#FF6B35', icon: '🕳️' },
  garbage: { label: 'Rác thải', color: '#8B5CF6', icon: '🗑️' },
  streetlight: { label: 'Đèn đường hỏng', color: '#F59E0B', icon: '💡' },
  flooding: { label: 'Ngập nước', color: '#3B82F6', icon: '🌊' },
  tree: { label: 'Cây đổ', color: '#10B981', icon: '🌳' },
  other: { label: 'Khác', color: '#6B7280', icon: '📌' },
};

/**
 * Màu trạng thái — HAI vai trò khác nhau, đừng dùng lẫn:
 *
 * - `color`: màu ĐỒ HOẠ (chấm tròn, viền, biểu đồ, marker). WCAG chỉ đòi 3:1
 *   cho đồ hoạ, nên giữ màu tươi để biểu đồ dễ phân biệt.
 * - `text` trên `bg`: dùng khi màu là CHỮ (chip, nhãn). Đã đo, mọi cặp ≥ 4.5:1.
 *
 * Trước đây chip dùng `color` làm chữ trên nền tô alpha của chính nó, cho ra
 * 2.15:1 (processing) và 2.54:1 (resolved) — không đạt chuẩn ở đúng những chỗ
 * truyền thông tin quan trọng nhất. Bảng đo ở APP-DESIGN-SYSTEM.md mục 2–3;
 * test ở constants.test.ts chặn việc đổi màu làm tụt dưới ngưỡng.
 */
export const STATUS_MAP: Record<string, { label: string; color: string; text: string; bg: string; icon: string }> = {
  reported: { label: 'Mới báo cáo', color: '#EF4444', text: '#A82C22', bg: '#FBE9E7', icon: '🟡' },
  processing: { label: 'Đang xử lý', color: '#F59E0B', text: '#7D4F05', bg: '#FDF2E0', icon: '🔵' },
  resolved: { label: 'Đã xử lý', color: '#10B981', text: '#17543E', bg: '#E6F2EC', icon: '🟢' },
  rejected: { label: 'Từ chối', color: '#6B7280', text: '#485862', bg: '#EDF1F4', icon: '🔴' },
};

/**
 * Luật chuyển trạng thái — BẢN DỰ PHÒNG.
 *
 * Nguồn thật là `GET /api/meta/enums` (`statusTransitions`), nạp lúc khởi động
 * và ghi đè bảng này qua `setStatusTransitions()`. Giữ bản cứng ở đây để màn hình
 * vẫn dựng được bộ chọn khi meta chưa kịp về hoặc mạng lỗi — không có nó thì bộ
 * chọn rỗng và người dùng không đổi được trạng thái.
 *
 * Backend luôn là nơi phán quyết cuối cùng: gọi sai vẫn bị chặn với
 * code 'INVALID_STATUS_TRANSITION'.
 */
let statusTransitions: Record<string, string[]> = {
  reported: ['processing', 'resolved', 'rejected'],
  processing: ['resolved', 'rejected'],
  resolved: ['processing'],
  rejected: ['processing'],
};

/** Nạp luật từ `GET /api/meta/enums`. Payload rỗng/hỏng thì giữ bản dự phòng. */
export const setStatusTransitions = (next?: Record<string, string[]> | null) => {
  if (next && Object.keys(next).length > 0) statusTransitions = next;
};

export const ALLOWED_STATUS_TRANSITIONS = statusTransitions;

// Luật mở lại sự cố (G8) đã chuyển sang utils/reopen.ts và nạp từ /api/meta/enums.

/** Đích đến hợp lệ từ một trạng thái, để dựng bộ chọn. Rỗng = không còn đích nào. */
export const getAllowedStatusTargets = (from?: string | null): string[] =>
  (from && statusTransitions[from]) || [];

/** Cùng quy ước với STATUS_MAP: `color` cho đồ hoạ, `text` trên `background` cho chữ. */
export const PRIORITY_MAP = {
  low: { label: 'Thấp', color: '#94A3B8', text: '#485862', background: '#EDF1F4' },
  medium: { label: 'Trung bình', color: '#FBBF24', text: '#6B4E00', background: '#FCF3DA' },
  high: { label: 'Cao', color: '#FB923C', text: '#8A3D10', background: '#FCEDE2' },
  critical: { label: 'Khẩn cấp', color: '#F87171', text: '#8C1D16', background: '#FBE7E5' },
} as const;

/**
 * Mọi loại thông báo backend có thể gửi — NGUỒN DUY NHẤT phía web.
 *
 * Kiểu `NotificationType` suy ra từ mảng này, và map icon ở NotificationCenter
 * khai báo `Record<NotificationType, …>` nên thiếu icon là tsc báo lỗi. Danh sách
 * này đã lệch backend BA lần (E6, F1, I1/I2); test ở constants.test.ts đọc enum
 * thật trong Backend/src/models/Notification.js để không có lần thứ tư.
 */
export const NOTIFICATION_TYPES = [
  'issue_created', 'issue_updated', 'issue_resolved', 'issue_rejected',
  'comment', 'area_alert',
  'issue_assigned', 'sla_reminder', 'sla_escalated',
  'issue_merged', 'intake_overdue', 'issue_reopened',
  'issue_rated', 'issue_unassigned',
] as const;

/** Badge "phiếu bị người dân mở lại" (G8) — cặp chữ/nền đã đo 6.66:1. */
export const REOPENED_BADGE = { text: '#8A3D10', bg: '#FCEDE2' } as const;

/** Màu badge SLA — trước nằm trong SlaBadge.tsx với 3 màu chữ không đạt chuẩn. */
export const SLA_STATUS_MAP = {
  on_time: { label: 'Trong hạn', text: '#17543E', bg: '#E6F2EC', icon: '⏱️' },
  due_soon: { label: 'Sắp đến hạn', text: '#7D4F05', bg: '#FDF2E0', icon: '⏳' },
  overdue: { label: 'Quá hạn', text: '#B3261E', bg: '#FBE7E5', icon: '🔥' },
  met: { label: 'Đúng hạn', text: '#17543E', bg: '#E6F2EC', icon: '✅' },
  breached: { label: 'Trễ hạn', text: '#8C1D16', bg: '#FBE7E5', icon: '⚠️' },
} as const;

export const PRIORITY_FACTOR_LABELS = {
  severity: 'Mức nghiêm trọng',
  age_sla: 'Tồn đọng / SLA',
  votes: 'Lượt ủng hộ',
  nearby_density: 'Mật độ lân cận',
  sensitive_place: 'Điểm nhạy cảm',
} as const;

// Place types with Vietnamese labels and icons
export const PLACE_TYPE_MAP: Record<string, { label: string; color: string; icon: string }> = {
  hospital: { label: 'Bệnh viện', color: '#EF4444', icon: '🏥' },
  school: { label: 'Trường học', color: '#3B82F6', icon: '🏫' },
  bus_stop: { label: 'Trạm xe buýt', color: '#F59E0B', icon: '🚌' },
  park: { label: 'Công viên', color: '#10B981', icon: '🌳' },
  police: { label: 'Công an', color: '#6366F1', icon: '🏛️' },
};

// Danh sách quận/huyện Đà Nẵng — nguồn duy nhất cho frontend, khớp với
// Backend/src/utils/districts.js. Trước đây danh sách này bị lặp ở
// Issues, Profile và AdminDashboard với nội dung không khớp nhau.
export const DA_NANG_DISTRICTS = [
  'Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn',
  'Liên Chiểu', 'Cẩm Lệ', 'Hòa Vang', 'Hoàng Sa',
];

// Loại camera công cộng — khớp với Backend/src/utils/publicCameras.js
export const CAMERA_TYPE_MAP: Record<string, { label: string; color: string; icon: string }> = {
  traffic: { label: 'Giao thông', color: '#0EA5E9', icon: '🚦' },
  school: { label: 'Trường học', color: '#3B82F6', icon: '🏫' },
  construction: { label: 'Công trình', color: '#F59E0B', icon: '🏗️' },
  public: { label: 'Công cộng', color: '#8B5CF6', icon: '📹' },
};
