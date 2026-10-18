import { describe, it, expect } from 'vitest';
import { canReporterModifyIssue } from './myIssue';
import type { Issue } from '../types';

const issue = (overrides: Record<string, unknown> = {}) => ({
  status: 'reported',
  mergedInto: null,
  duplicateCount: 0,
  ...overrides,
}) as unknown as Issue;

/** Nút Sửa/Xoá phải hiện ĐÚNG như backend (updateMyIssue/deleteMyIssue) sẽ nhận. */
describe('canReporterModifyIssue', () => {
  it('cho sửa/xoá phiếu còn "Mới báo cáo"', () => {
    expect(canReporterModifyIssue(issue())).toBe(true);
    expect(canReporterModifyIssue(issue({ duplicateCount: undefined }))).toBe(true);
  });

  it('không cho khi phiếu đã được tiếp nhận hoặc đã đóng', () => {
    expect(canReporterModifyIssue(issue({ status: 'processing' }))).toBe(false);
    expect(canReporterModifyIssue(issue({ status: 'resolved' }))).toBe(false);
  });

  // Đây là lỗi vừa sửa: phiếu đại diện cho cả nhóm báo cáo trùng vẫn hiện nút.
  it('không cho khi đã có báo cáo khác gộp vào (MERGED_INTO_THIS)', () => {
    expect(canReporterModifyIssue(issue({ duplicateCount: 2 }))).toBe(false);
  });

  it('không cho khi phiếu đã bị gộp vào phiếu khác (MERGED_ISSUE)', () => {
    expect(canReporterModifyIssue(issue({ mergedInto: { _id: 'p1', title: 'Gốc', status: 'reported' } }))).toBe(false);
    expect(canReporterModifyIssue(issue({ mergedInto: 'p1' }))).toBe(false);
  });
});
