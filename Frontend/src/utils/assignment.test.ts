import { describe, it, expect } from 'vitest';
import { canAssignIssue, getAssignedDepartmentId } from './assignment';
import type { Issue } from '../types';

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
