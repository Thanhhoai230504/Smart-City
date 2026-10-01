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

// Issue statuses with Vietnamese labels and colors
export const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  reported: { label: 'Mới báo cáo', color: '#EF4444', icon: '🟡' },
  processing: { label: 'Đang xử lý', color: '#F59E0B', icon: '🔵' },
  resolved: { label: 'Đã xử lý', color: '#10B981', icon: '🟢' },
  rejected: { label: 'Từ chối', color: '#6B7280', icon: '🔴' },
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

/**
 * Mở lại sự cố (G8) — khớp Backend/src/utils/reopenConfig.js.
 * Chỉ dùng để ẩn/hiện nút; backend mới là nơi phán quyết và trả mã lỗi.
 */
export const MAX_REOPEN_COUNT = 2;
export const REOPEN_WINDOW_DAYS = 30;
export const MIN_REOPEN_REASON_LENGTH = 10;
export const MAX_REOPEN_REASON_LENGTH = 500;

/** Đích đến hợp lệ từ một trạng thái, để dựng bộ chọn. Rỗng = không còn đích nào. */
export const getAllowedStatusTargets = (from?: string | null): string[] =>
  (from && statusTransitions[from]) || [];

export const PRIORITY_MAP = {
  low: { label: 'Thấp', color: '#94A3B8', background: 'rgba(148,163,184,0.14)' },
  medium: { label: 'Trung bình', color: '#FBBF24', background: 'rgba(251,191,36,0.14)' },
  high: { label: 'Cao', color: '#FB923C', background: 'rgba(251,146,60,0.15)' },
  critical: { label: 'Khẩn cấp', color: '#F87171', background: 'rgba(248,113,113,0.16)' },
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
