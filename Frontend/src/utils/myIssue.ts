import type { Issue } from '../types';

/**
 * Người báo cáo còn sửa/xoá được phiếu của mình không — cùng điều kiện với
 * `updateMyIssue`/`deleteMyIssue` ở backend (services/issueService.js):
 *
 * - còn "Mới báo cáo";
 * - chưa bị gộp vào phiếu khác (`MERGED_ISSUE`);
 * - chưa có báo cáo nào khác gộp vào nó (`MERGED_INTO_THIS`): khi đó nó đại diện cho cả
 *   nhóm, chỉ quản trị viên xử lý.
 *
 * Trước đây web chỉ xét trạng thái, nên phiếu đã có báo cáo trùng gộp vào vẫn hiện nút
 * Sửa/Xoá, bấm mới bị máy chủ từ chối.
 */
export const canReporterModifyIssue = (
  issue: Pick<Issue, 'status' | 'mergedInto' | 'duplicateCount'>,
): boolean => issue.status === 'reported' && !issue.mergedInto && !(issue.duplicateCount && issue.duplicateCount > 0);
