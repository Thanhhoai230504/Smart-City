import type { Issue } from '../types';

/**
 * Mở lại sự cố (G8) — luật phía client.
 *
 * Nguồn thật là `GET /api/meta/enums` → `reopen`, nạp lúc khởi động qua
 * `setReopenRules()` (App.tsx). Bản dưới đây chỉ là DỰ PHÒNG khi meta chưa về,
 * khớp Backend/src/utils/reopenConfig.js. Trước đây bốn con số này hardcode ở
 * constants.ts dù server đã trả sẵn — đổi chính sách ở backend là web lệch.
 *
 * Client chỉ dùng để ẩn/hiện nút và báo trước cho người dùng. Backend vẫn là nơi
 * phán quyết cuối cùng và trả mã lỗi tương ứng.
 */
export interface ReopenRules {
  maxCount: number;
  windowDays: number;
  minReasonLength: number;
  maxReasonLength: number;
}

export const DEFAULT_REOPEN_RULES: Readonly<ReopenRules> = Object.freeze({
  maxCount: 2,
  windowDays: 30,
  minReasonLength: 10,
  maxReasonLength: 500,
});

let rules: ReopenRules = { ...DEFAULT_REOPEN_RULES };

const isPositiveInt = (value: unknown) => Number.isInteger(value) && (value as number) > 0;

/** Ghi đè bằng luật từ server. Dữ liệu thiếu hoặc hỏng thì giữ nguyên bản dự phòng. */
export const setReopenRules = (next?: Partial<ReopenRules> | null) => {
  if (!next) return;
  const keys: (keyof ReopenRules)[] = ['maxCount', 'windowDays', 'minReasonLength', 'maxReasonLength'];
  if (!keys.every((key) => isPositiveInt(next[key]))) return;
  rules = { ...(next as ReopenRules) };
};

export const getReopenRules = (): ReopenRules => rules;

export const CLOSED_STATUSES = ['resolved', 'rejected'];

/** `userId` là chuỗi ObjectId hoặc object đã populate, tuỳ endpoint. */
export const getReporterId = (issue: Issue): string | null => {
  const reporter = issue.userId;
  const id = typeof reporter === 'object' && reporter ? reporter._id : reporter;
  return id ? String(id) : null;
};
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Thời điểm phiếu bị đóng — cùng thứ tự ưu tiên với `getClosedAt` ở backend:
 * lần đóng gần nhất trong statusHistory, rồi resolvedAt, rồi updatedAt. Phiếu bị
 * từ chối không có resolvedAt nên phải tra lịch sử trước.
 */
export const getClosedAt = (issue: Issue): Date | null => {
  const history = Array.isArray(issue.statusHistory) ? issue.statusHistory : [];
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i] as { status?: string; changedAt?: string };
    if (entry && CLOSED_STATUSES.includes(entry.status || '') && entry.changedAt) {
      return new Date(entry.changedAt);
    }
  }
  if (issue.resolvedAt) return new Date(issue.resolvedAt);
  return issue.updatedAt ? new Date(issue.updatedAt) : null;
};

export type ReopenBlockReason =
  | 'MERGED_ISSUE'
  | 'NOT_REPORTER'
  | 'ISSUE_NOT_CLOSED'
  | 'REOPEN_LIMIT_REACHED'
  | 'REOPEN_WINDOW_EXPIRED';

export interface ReopenEligibility {
  allowed: boolean;
  reason?: ReopenBlockReason;
  /** Số ngày còn được mở lại; null khi phiếu cũ thiếu mốc đóng (không chặn). */
  daysLeft: number | null;
}

/**
 * Cùng thứ tự kiểm tra với `checkCanReopen` ở backend, để nút hiện ra thì backend
 * sẽ nhận. Đúng ngày cuối cửa sổ vẫn được mở (backend dùng `days > windowDays`).
 */
export const getReopenEligibility = (
  issue: Issue,
  userId: string | undefined | null,
  now: number = Date.now(),
): ReopenEligibility => {
  const block = (reason: ReopenBlockReason): ReopenEligibility => ({ allowed: false, reason, daysLeft: null });

  if (issue.mergedInto) return block('MERGED_ISSUE');

  const reporterId = getReporterId(issue);
  if (!userId || !reporterId || reporterId !== String(userId)) return block('NOT_REPORTER');

  if (!CLOSED_STATUSES.includes(issue.status)) return block('ISSUE_NOT_CLOSED');
  if ((issue.reopenCount || 0) >= rules.maxCount) return block('REOPEN_LIMIT_REACHED');

  const closedAt = getClosedAt(issue);
  if (!closedAt) return { allowed: true, daysLeft: null };

  const elapsedDays = (now - closedAt.getTime()) / DAY_MS;
  if (elapsedDays > rules.windowDays) return block('REOPEN_WINDOW_EXPIRED');

  return { allowed: true, daysLeft: Math.max(0, Math.floor(rules.windowDays - elapsedDays)) };
};

/** Câu giải thích cho từng mã từ chối — dùng khi backend từ chối lúc gửi. */
export const REOPEN_BLOCK_MESSAGES: Record<ReopenBlockReason, (r: ReopenRules) => string> = {
  MERGED_ISSUE: () => 'Báo cáo này đã được gộp vào sự cố khác — hãy mở lại sự cố gốc.',
  NOT_REPORTER: () => 'Chỉ người báo cáo mới mở lại được sự cố này.',
  ISSUE_NOT_CLOSED: () => 'Sự cố đang được xử lý lại, chưa cần mở lại.',
  REOPEN_LIMIT_REACHED: (r) => `Bạn đã dùng hết ${r.maxCount} lượt mở lại. Vui lòng liên hệ trực tiếp đơn vị phụ trách.`,
  REOPEN_WINDOW_EXPIRED: (r) => `Đã quá ${r.windowDays} ngày kể từ khi đóng phiếu nên không mở lại được nữa.`,
};
