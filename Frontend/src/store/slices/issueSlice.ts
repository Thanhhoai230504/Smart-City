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
}

const initialState: IssueState = {
  issues: [],
  myIssues: [],
  currentIssue: null,
  pagination: null,
  myPagination: null,
  loading: false,
  error: null,
};

export const fetchIssues = createAsyncThunk('issues/fetchAll', async (params: Record<string, string | number> | undefined, { rejectWithValue }) => {
  try {
    const { data } = await issueApi.getIssues(params);
    return data.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Lỗi tải danh sách sự cố');
  }
});

export const fetchIssueById = createAsyncThunk('issues/fetchById', async (id: string, { rejectWithValue }) => {
  try {
    const { data } = await issueApi.getIssueById(id);
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

export const fetchMyIssues = createAsyncThunk('issues/fetchMy', async (params: Record<string, string | number> | undefined, { rejectWithValue }) => {
  try {
    const { data } = await issueApi.getMyIssues(params);
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
      .addCase(fetchIssues.pending, (state) => { state.loading = true; })
      .addCase(fetchIssues.fulfilled, (state, action) => {
        state.loading = false;
        state.issues = action.payload.issues;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchIssues.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; })
      .addCase(fetchIssueById.pending, (state) => { state.loading = true; })
      .addCase(fetchIssueById.fulfilled, (state, action) => { state.loading = false; state.currentIssue = action.payload.issue; })
      .addCase(fetchIssueById.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; })
      .addCase(createIssue.pending, (state) => { state.loading = true; })
      .addCase(createIssue.fulfilled, (state) => { state.loading = false; })
      .addCase(createIssue.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; })
      .addCase(fetchMyIssues.pending, (state) => { state.loading = true; })
      .addCase(fetchMyIssues.fulfilled, (state, action) => {
        state.loading = false;
        state.myIssues = action.payload.issues;
        state.myPagination = action.payload.pagination;
      })
      .addCase(fetchMyIssues.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; });
  },
});

export const { clearCurrentIssue, addNewIssue } = issueSlice.actions;
export default issueSlice.reducer;
