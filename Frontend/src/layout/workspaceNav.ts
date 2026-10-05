import type { SvgIcon } from '@mui/material';
import {
  AssignmentTurnedIn,
  CorporateFare,
  DashboardOutlined,
  History,
  Insights,
  LocationOnOutlined,
  MapOutlined,
  PeopleAltOutlined,
  Psychology,
  ReportProblemOutlined,
  VideocamOutlined,
  WorkOutline,
} from '@mui/icons-material';

/**
 * Điều hướng không gian làm việc (quản trị / cán bộ) — NGUỒN DUY NHẤT.
 *
 * Thanh bên (WorkspaceSidebar) và ngăn kéo menu trên điện thoại (Header) cùng đọc
 * danh sách này. Trước đây ngăn kéo tự liệt kê một phần (thiếu các tab của bảng
 * điều hành, thiếu hẳn mục của cán bộ) và hai nơi dễ lệch nhau khi thêm trang.
 */
export interface WorkspaceNavItem {
  label: string;
  path: string;
  /** Tab của /admin (query `?tab=`); không có nghĩa là một trang riêng. */
  tab?: string;
  Icon: typeof SvgIcon;
}

/** Độ rộng thanh điều hướng — MainLayout chừa lề trái đúng bằng chừng này cho nội dung. */
export const WORKSPACE_SIDEBAR_WIDTH = { expanded: 236, compact: 76 } as const;

export const ADMIN_WORKSPACE_ITEMS: WorkspaceNavItem[] = [
  { label: 'Tổng quan', path: '/admin?tab=overview', tab: 'overview', Icon: DashboardOutlined },
  { label: 'Quản lý sự cố', path: '/admin/issues', Icon: ReportProblemOutlined },
  { label: 'Đơn vị xử lý', path: '/admin?tab=departments', tab: 'departments', Icon: CorporateFare },
  { label: 'Người dùng & cán bộ', path: '/admin/users', Icon: PeopleAltOutlined },
  { label: 'Quản lý địa điểm', path: '/admin/places', Icon: LocationOnOutlined },
  { label: 'Phân công', path: '/admin?tab=assignments', tab: 'assignments', Icon: AssignmentTurnedIn },
  { label: 'Công việc đơn vị', path: '/admin?tab=work', tab: 'work', Icon: WorkOutline },
  { label: 'Hiệu suất', path: '/admin?tab=performance', tab: 'performance', Icon: Insights },
  { label: 'Camera', path: '/admin?tab=cameras', tab: 'cameras', Icon: VideocamOutlined },
  { label: 'Nhật ký hoạt động', path: '/admin?tab=audit', tab: 'audit', Icon: History },
  { label: 'Minh bạch AI', path: '/admin?tab=ai', tab: 'ai', Icon: Psychology },
];

export const STAFF_WORKSPACE_ITEMS: WorkspaceNavItem[] = [
  { label: 'Công việc của đơn vị', path: '/staff', Icon: WorkOutline },
  { label: 'Bản đồ đô thị', path: '/map', Icon: MapOutlined },
  { label: 'Danh sách sự cố', path: '/issues', Icon: ReportProblemOutlined },
];

/** Mục đang được chọn: tab của /admin so theo `?tab=` (mặc định "overview"), trang riêng so theo pathname. */
export const isWorkspaceItemActive = (item: WorkspaceNavItem, pathname: string, search: string): boolean => {
  if (!item.tab) return pathname === item.path;
  const activeTab = new URLSearchParams(search).get('tab') || 'overview';
  return pathname === '/admin' && activeTab === item.tab;
};
