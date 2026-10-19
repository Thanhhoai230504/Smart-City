import type { Issue, User, UserRole } from '../types';

/**
 * Có hiện nút "Phân công" không — cùng điều kiện với backend: route
 * `POST /issues/:id/assign` chỉ cho admin, và assignmentService.assignIssue từ chối
 * phiếu đã gộp hoặc đã đóng (resolved/rejected). Phiếu đang xử lý vẫn phân công LẠI
 * được — backend tính lại hạn xử lý từ lúc phân công mới.
 */
export const canAssignIssue = (issue: Issue, role: UserRole | undefined | null): boolean =>
  role === 'admin'
  && !issue.mergedInto
  && (issue.status === 'reported' || issue.status === 'processing');

/** `departmentId` là chuỗi ObjectId hoặc object đã populate, tuỳ endpoint. */
export const getAssignedDepartmentId = (issue: Issue): string | null => {
  const dept = issue.departmentId as unknown;
  if (!dept) return null;
  if (typeof dept === 'string') return dept;
  return (dept as { _id?: string })._id ?? null;
};

/** Tương tự cho cán bộ đang nhận việc. */
export const getAssigneeId = (issue: Issue): string | null => {
  const assignee = issue.assigneeId as unknown;
  if (!assignee) return null;
  if (typeof assignee === 'string') return assignee;
  return (assignee as { _id?: string })._id ?? null;
};

export type StaffIssueAction =
  | { kind: 'none' }
  | { kind: 'closed' }
  | { kind: 'claim' }
  | { kind: 'update' }
  | { kind: 'taken'; assigneeName: string | null };

/**
 * Cán bộ đang xem trang chi tiết được làm gì với phiếu — cùng luật với backend
 * (assignmentService.claimIssue, assertCanHandleIssue) và bàn làm việc /staff:
 * - không phải cán bộ, phiếu không thuộc đơn vị mình hoặc đã gộp: không có thao tác;
 * - phiếu đã đóng: chỉ báo đã đóng (chỉ quản trị viên mở lại — REOPEN_ADMIN_ONLY);
 * - chưa ai nhận: "Nhận việc";
 * - mình đang đứng tên: "Cập nhật trạng thái";
 * - người khác đứng tên: chỉ báo ai đang phụ trách (máy chủ chặn bằng NOT_ASSIGNEE).
 *
 * Trước đây trang chi tiết chỉ có thao tác cho quản trị viên: cán bộ mở phiếu từ bàn
 * làm việc xong phải quay lại danh sách mới nhận việc hay cập nhật được.
 */
export const getStaffIssueAction = (
  issue: Issue,
  user: Pick<User, '_id' | 'id' | 'role' | 'departmentId'> | null | undefined,
): StaffIssueAction => {
  if (!user || user.role !== 'staff' || issue.mergedInto) return { kind: 'none' };

  const dept = user.departmentId;
  const userDeptId = typeof dept === 'string' ? dept : dept?._id ?? null;
  const issueDeptId = getAssignedDepartmentId(issue);
  if (!userDeptId || !issueDeptId || userDeptId !== issueDeptId) return { kind: 'none' };

  if (issue.status === 'resolved' || issue.status === 'rejected') return { kind: 'closed' };

  const assigneeId = getAssigneeId(issue);
  if (!assigneeId) return { kind: 'claim' };
  if (assigneeId === (user._id || user.id)) return { kind: 'update' };

  const assignee = issue.assigneeId as unknown;
  const assigneeName = assignee && typeof assignee === 'object'
    ? (assignee as { name?: string }).name ?? null
    : null;
  return { kind: 'taken', assigneeName };
};
