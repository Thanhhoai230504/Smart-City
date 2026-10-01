import type { Issue } from '../types';
import { CLOSED_STATUSES, getReporterId } from './reopen';

/** Khớp `rating.comment.maxlength` ở Backend/src/models/Issue.js. */
export const MAX_RATING_COMMENT_LENGTH = 500;

/**
 * Có hiện nút đánh giá không — cùng điều kiện với ratingService.rateIssue ở
 * backend: phiếu chưa gộp, đúng người báo cáo, đã ĐÓNG (`resolved` hoặc
 * `rejected`, mở từ task I1), và chưa đánh giá.
 *
 * Trước đây web chỉ nhận `resolved`, nên người có phiếu bị từ chối — nhóm dễ
 * không hài lòng nhất — không có kênh phản hồi nào trên web.
 */
export const canRateIssue = (issue: Issue, userId: string | undefined | null): boolean => {
  if (issue.mergedInto) return false;
  const reporterId = getReporterId(issue);
  if (!userId || !reporterId || reporterId !== String(userId)) return false;
  if (!CLOSED_STATUSES.includes(issue.status)) return false;
  return !issue.rating?.score;
};
