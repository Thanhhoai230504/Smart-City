import { describe, it, expect } from 'vitest';
import reducer, {
  clearCurrentIssue,
  addNewIssue,
  fetchIssues,
  fetchIssueById,
} from './issueSlice';
import type { Issue, Pagination } from '../../types';

const initial = reducer(undefined, { type: '@@INIT' });

const pagination: Pagination = { current: 1, pages: 1, total: 1, limit: 10 };
const anIssue = (id: string) => ({ _id: id, title: `Sự cố ${id}` } as unknown as Issue);

/** Dựng action của createAsyncThunk thủ công để điều khiển requestId. */
const pending = (thunk: { pending: { type: string } }, requestId: string) => ({
  type: thunk.pending.type,
  meta: { requestId, arg: undefined },
});
const fulfilled = (thunk: { fulfilled: { type: string } }, requestId: string, payload: unknown) => ({
  type: thunk.fulfilled.type,
  payload,
  meta: { requestId, arg: undefined },
});
const rejected = (
  thunk: { rejected: { type: string } },
  requestId: string,
  payload: unknown,
  aborted = false,
) => ({
  type: thunk.rejected.type,
  payload,
  meta: { requestId, arg: undefined, aborted },
});

describe('issueSlice — reducer thuần', () => {
  it('clears the current issue', () => {
    const state = { ...initial, currentIssue: anIssue('1') };
    expect(reducer(state, clearCurrentIssue()).currentIssue).toBeNull();
  });

  // Sự cố mới đến qua socket phải nằm đầu danh sách, không phải cuối.
  it('puts a newly reported issue at the top of the list', () => {
    const state = { ...initial, issues: [anIssue('old')] };
    const next = reducer(state, addNewIssue(anIssue('new')));
    expect(next.issues.map((i) => i._id)).toEqual(['new', 'old']);
  });
});

/**
 * Chống "stale response".
 *
 * Người dùng gõ nhanh vào ô tìm kiếm hoặc đổi bộ lọc liên tục sẽ tạo nhiều
 * request chồng nhau. Mạng không bảo đảm thứ tự, nên một phản hồi CŨ có thể về
 * SAU và ghi đè kết quả mới — danh sách hiện ra không khớp bộ lọc đang chọn.
 * Slice chống việc đó bằng cách chỉ nhận phản hồi của request mới nhất.
 */
describe('issueSlice — chống phản hồi cũ ghi đè', () => {
  it('accepts the response of the latest request', () => {
    let state = reducer(initial, pending(fetchIssues, 'req-1'));
    state = reducer(state, fulfilled(fetchIssues, 'req-1', { issues: [anIssue('a')], pagination }));

    expect(state.issues.map((i) => i._id)).toEqual(['a']);
    expect(state.loading).toBe(false);
  });

  it('ignores a stale response that arrives after a newer request started', () => {
    let state = reducer(initial, pending(fetchIssues, 'req-1'));
    state = reducer(state, pending(fetchIssues, 'req-2'));

    // Phản hồi của request CŨ về muộn — phải bị bỏ qua.
    state = reducer(state, fulfilled(fetchIssues, 'req-1', { issues: [anIssue('cu')], pagination }));
    expect(state.issues).toEqual([]);

    state = reducer(state, fulfilled(fetchIssues, 'req-2', { issues: [anIssue('moi')], pagination }));
    expect(state.issues.map((i) => i._id)).toEqual(['moi']);
  });

  it('keeps the spinner on while a newer request is still in flight', () => {
    let state = reducer(initial, pending(fetchIssues, 'req-1'));
    state = reducer(state, pending(fetchIssues, 'req-2'));
    state = reducer(state, fulfilled(fetchIssues, 'req-1', { issues: [], pagination }));

    expect(state.loading).toBe(true);
  });

  it('ignores a stale rejection too', () => {
    let state = reducer(initial, pending(fetchIssues, 'req-1'));
    state = reducer(state, pending(fetchIssues, 'req-2'));
    state = reducer(state, rejected(fetchIssues, 'req-1', 'Lỗi cũ'));

    expect(state.error).toBeNull();
  });

  // Huỷ request là hành vi bình thường khi người dùng gõ tiếp, không phải lỗi
  // đáng hiện cho họ.
  it('does not surface an aborted request as an error', () => {
    let state = reducer(initial, pending(fetchIssues, 'req-1'));
    state = reducer(state, rejected(fetchIssues, 'req-1', 'canceled', true));

    expect(state.error).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('does surface a real failure', () => {
    let state = reducer(initial, pending(fetchIssues, 'req-1'));
    state = reducer(state, rejected(fetchIssues, 'req-1', 'Mất kết nối'));

    expect(state.error).toBe('Mất kết nối');
  });

  // Danh sách và chi tiết dùng hai bộ đếm riêng, nên mở chi tiết không được làm
  // mất kết quả danh sách đang hiển thị.
  it('tracks list and detail requests independently', () => {
    let state = reducer(initial, pending(fetchIssues, 'list-1'));
    state = reducer(state, fulfilled(fetchIssues, 'list-1', { issues: [anIssue('a')], pagination }));
    state = reducer(state, pending(fetchIssueById, 'detail-1'));
    state = reducer(state, fulfilled(fetchIssueById, 'detail-1', { issue: anIssue('a') }));

    expect(state.issues.map((i) => i._id)).toEqual(['a']);
    expect(state.currentIssue?._id).toBe('a');
  });
});
