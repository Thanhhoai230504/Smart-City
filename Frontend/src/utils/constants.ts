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
export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  reported: { label: 'Mới báo cáo', color: '#EF4444' },
  processing: { label: 'Đang xử lý', color: '#F59E0B' },
  resolved: { label: 'Đã xử lý', color: '#10B981' },
  rejected: { label: 'Từ chối', color: '#6B7280' },
};

// Place types with Vietnamese labels and icons
export const PLACE_TYPE_MAP: Record<string, { label: string; color: string; icon: string }> = {
  hospital: { label: 'Bệnh viện', color: '#EF4444', icon: '🏥' },
  school: { label: 'Trường học', color: '#3B82F6', icon: '🏫' },
  bus_stop: { label: 'Trạm xe buýt', color: '#F59E0B', icon: '🚌' },
  park: { label: 'Công viên', color: '#10B981', icon: '🌳' },
  police: { label: 'Công an', color: '#6366F1', icon: '🏛️' },
};
