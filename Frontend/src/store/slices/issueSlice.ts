import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { issueApi } from '../../api/issueApi';
import { Issue, Pagination } from '../../types';

interface IssueState {
  issues: Issue[];
  myIssues: Issue[];
  currentIssue: Issue | null;
  pagination: Pagination | null;
  myPagination: Pagination | null;
  loading: boolean;
  error: string | null;
  activeListRequestId: string | null;
  activeDetailRequestId: string | null;
  activeMyRequestId: string | null;
  activeLoadingRequestId: string | null;
}

const initialState: IssueState = {
  issues: [],
  myIssues: [],
  currentIssue: null,
  pagination: null,
  myPagination: null,
  loading: false,
  error: null,
  activeListRequestId: null,
  activeDetailRequestId: null,
  activeMyRequestId: null,
  activeLoadingRequestId: null,
};

export const fetchIssues = createAsyncThunk('issues/fetchAll', async (params: Record<string, string | number> | undefined, { rejectWithValue, signal }) => {
  try {
    const { data } = await issueApi.getIssues(params, signal);
    return data.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Lỗi tải danh sách sự cố');
  }
});

export const fetchIssueById = createAsyncThunk('issues/fetchById', async (id: string, { rejectWithValue, signal }) => {
  try {
    const { data } = await issueApi.getIssueById(id, signal);
    return data.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Không tìm thấy sự cố');
  }
});

export const createIssue = createAsyncThunk('issues/create', async (formData: FormData, { rejectWithValue }) => {
  try {
    const { data } = await issueApi.createIssue(formData);
    return data.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Tạo sự cố thất bại');
  }
});

export const fetchMyIssues = createAsyncThunk('issues/fetchMy', async (params: Record<string, string | number> | undefined, { rejectWithValue, signal }) => {
  try {
    const { data } = await issueApi.getMyIssues(params, signal);
    return data.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Lỗi tải sự cố của bạn');
  }
});

const issueSlice = createSlice({
  name: 'issues',
  initialState,
  reducers: {
    clearCurrentIssue: (state) => { state.currentIssue = null; },
    addNewIssue: (state, action) => { state.issues.unshift(action.payload); },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchIssues.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.activeListRequestId = action.meta.requestId;
        state.activeLoadingRequestId = action.meta.requestId;
      })
      .addCase(fetchIssues.fulfilled, (state, action) => {
        if (state.activeListRequestId !== action.meta.requestId) return;
        if (state.activeLoadingRequestId === action.meta.requestId) state.loading = false;
        state.issues = action.payload.issues;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchIssues.rejected, (state, action) => {
        if (state.activeListRequestId !== action.meta.requestId) return;
        if (state.activeLoadingRequestId === action.meta.requestId) state.loading = false;
        if (!action.meta.aborted) state.error = action.payload as string;
      })
      .addCase(fetchIssueById.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.activeDetailRequestId = action.meta.requestId;
        state.activeLoadingRequestId = action.meta.requestId;
      })
      .addCase(fetchIssueById.fulfilled, (state, action) => {
        if (state.activeDetailRequestId !== action.meta.requestId) return;
        if (state.activeLoadingRequestId === action.meta.requestId) state.loading = false;
        state.currentIssue = action.payload.issue;
      })
      .addCase(fetchIssueById.rejected, (state, action) => {
        if (state.activeDetailRequestId !== action.meta.requestId) return;
        if (state.activeLoadingRequestId === action.meta.requestId) state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createIssue.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.activeLoadingRequestId = action.meta.requestId;
      })
      .addCase(createIssue.fulfilled, (state, action) => {
        if (state.activeLoadingRequestId === action.meta.requestId) state.loading = false;
      })
      .addCase(createIssue.rejected, (state, action) => {
        if (state.activeLoadingRequestId === action.meta.requestId) state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchMyIssues.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.activeMyRequestId = action.meta.requestId;
        state.activeLoadingRequestId = action.meta.requestId;
      })
      .addCase(fetchMyIssues.fulfilled, (state, action) => {
        if (state.activeMyRequestId !== action.meta.requestId) return;
        if (state.activeLoadingRequestId === action.meta.requestId) state.loading = false;
        state.myIssues = action.payload.issues;
        state.myPagination = action.payload.pagination;
      })
      .addCase(fetchMyIssues.rejected, (state, action) => {
        if (state.activeMyRequestId !== action.meta.requestId) return;
        if (state.activeLoadingRequestId === action.meta.requestId) state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCurrentIssue, addNewIssue } = issueSlice.actions;
export default issueSlice.reducer;
