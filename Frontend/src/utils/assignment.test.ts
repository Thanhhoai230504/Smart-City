import { describe, it, expect } from 'vitest';
import { canAssignIssue, getAssignedDepartmentId, getStaffIssueAction } from './assignment';
import type { Issue, User } from '../types';

const issue = (overrides: Record<string, unknown> = {}) => ({
  _id: 'i1',
  status: 'reported',
  mergedInto: null,
  departmentId: null,
  ...overrides,
}) as unknown as Issue;

/**
 * Nút "Phân công" trên trang chi tiết phải hiện ĐÚNG như backend sẽ nhận
 * (assignmentService.assignIssue + route chỉ cho admin), để admin bấm vào thông
 * báo "có sự cố mới" là phân công được ngay, không bao giờ gặp nút bấm rồi mới lỗi.
 */
describe('canAssignIssue', () => {
  it('lets an admin assign a newly reported issue', () => {
    expect(canAssignIssue(issue(), 'admin')).toBe(true);
  });

  // Phân công lại cho đơn vị khác khi đang xử lý — backend cho phép và tính lại hạn.
  it('lets an admin reassign an issue that is being processed', () => {
    expect(canAssignIssue(issue({ status: 'processing', departmentId: 'd1' }), 'admin')).toBe(true);
  });

  it.each([['staff'], ['user'], [undefined]])('hides the button for role %p', (role) => {
    expect(canAssignIssue(issue(), role as never)).toBe(false);
  });

  it.each([['resolved'], ['rejected']])('hides the button once the issue is %s', (status) => {
    expect(canAssignIssue(issue({ status }), 'admin')).toBe(false);
  });

  it('hides the button on a merged issue', () => {
    expect(canAssignIssue(issue({ mergedInto: 'other' }), 'admin')).toBe(false);
  });
});

describe('getAssignedDepartmentId', () => {
  // departmentId là chuỗi ObjectId hoặc object đã populate, tuỳ endpoint.
  it('reads both a populated department and a plain id', () => {
    expect(getAssignedDepartmentId(issue({ departmentId: { _id: 'd1', name: 'Cây xanh' } }))).toBe('d1');
    expect(getAssignedDepartmentId(issue({ departmentId: 'd2' }))).toBe('d2');
    expect(getAssignedDepartmentId(issue({ departmentId: null }))).toBeNull();
  });
});

/**
 * Khung "Xử lý sự cố" của cán bộ trên trang chi tiết phải đi đúng luật backend
 * (claimIssue, assertCanHandleIssue): trước đây cán bộ mở phiếu từ bàn làm việc xong
 * phải quay lại danh sách mới nhận việc hay cập nhật được.
 */
describe('getStaffIssueAction', () => {
  const staff = (overrides: Record<string, unknown> = {}) => ({
    _id: 'me',
    role: 'staff',
    departmentId: 'd1',
    ...overrides,
  }) as unknown as User;
  const deptIssue = (overrides: Record<string, unknown> = {}) => issue({
    status: 'processing',
    departmentId: { _id: 'd1', name: 'Hạ tầng giao thông' },
    assigneeId: null,
    ...overrides,
  });

  it('offers "Nhận việc" on an unclaimed issue of my department', () => {
    expect(getStaffIssueAction(deptIssue(), staff())).toEqual({ kind: 'claim' });
    expect(getStaffIssueAction(deptIssue({ status: 'reported', departmentId: 'd1' }), staff())).toEqual({ kind: 'claim' });
  });

  it('offers "Cập nhật trạng thái" when I am the assignee (populated or plain id)', () => {
    expect(getStaffIssueAction(deptIssue({ assigneeId: { _id: 'me', name: 'Tôi' } }), staff())).toEqual({ kind: 'update' });
    expect(getStaffIssueAction(deptIssue({ assigneeId: 'me' }), staff())).toEqual({ kind: 'update' });
    // Hồ sơ cũ chỉ có `id`, cùng cách bàn làm việc đọc.
    expect(getStaffIssueAction(deptIssue({ assigneeId: 'me' }), staff({ _id: undefined, id: 'me' }))).toEqual({ kind: 'update' });
  });

  it('only tells who is in charge when a colleague holds the issue (NOT_ASSIGNEE)', () => {
    expect(getStaffIssueAction(deptIssue({ assigneeId: { _id: 'other', name: 'Phạm Thu Dung' } }), staff()))
      .toEqual({ kind: 'taken', assigneeName: 'Phạm Thu Dung' });
    expect(getStaffIssueAction(deptIssue({ assigneeId: 'other' }), staff()))
      .toEqual({ kind: 'taken', assigneeName: null });
  });

  it('says the issue is closed — only an admin can reopen it (REOPEN_ADMIN_ONLY)', () => {
    expect(getStaffIssueAction(deptIssue({ status: 'resolved', assigneeId: 'me' }), staff())).toEqual({ kind: 'closed' });
    expect(getStaffIssueAction(deptIssue({ status: 'rejected' }), staff())).toEqual({ kind: 'closed' });
  });

  it('shows nothing for another department, an unassigned or merged issue, or a staff without department', () => {
    expect(getStaffIssueAction(deptIssue({ departmentId: 'd2' }), staff())).toEqual({ kind: 'none' });
    expect(getStaffIssueAction(deptIssue({ departmentId: null }), staff())).toEqual({ kind: 'none' });
    expect(getStaffIssueAction(deptIssue({ mergedInto: 'parent' }), staff())).toEqual({ kind: 'none' });
    expect(getStaffIssueAction(deptIssue(), staff({ departmentId: null }))).toEqual({ kind: 'none' });
    expect(getStaffIssueAction(deptIssue(), staff({ departmentId: { _id: 'd1', name: 'HTGT' } }))).toEqual({ kind: 'claim' });
  });

  it.each([['admin'], ['user']])('shows nothing for role %s (admin has its own panel)', (role) => {
    expect(getStaffIssueAction(deptIssue(), staff({ role }))).toEqual({ kind: 'none' });
  });

  it('shows nothing for a guest', () => {
    expect(getStaffIssueAction(deptIssue(), null)).toEqual({ kind: 'none' });
  });
});
