import type { Issue, UserRole } from '../types';

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
