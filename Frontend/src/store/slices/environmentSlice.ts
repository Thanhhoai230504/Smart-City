import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { environmentApi } from '../../api/environmentApi';
import { EnvironmentData } from '../../types';

interface EnvState {
  environmentData: EnvironmentData[];
  envSource: string;
  loading: boolean;
  error: string | null;
}

const initialState: EnvState = {
  environmentData: [], envSource: '',
  loading: false, error: null,
};

export const fetchEnvironment = createAsyncThunk('env/fetchEnvironment', async (_, { rejectWithValue }) => {
  try {
    const { data } = await environmentApi.getEnvironmentData();
    return data.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Lỗi tải dữ liệu môi trường');
  }
});

const environmentSlice = createSlice({
  name: 'environment',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchEnvironment.pending, (state) => { state.loading = true; })
      .addCase(fetchEnvironment.fulfilled, (state, action) => {
        state.loading = false;
        state.environmentData = action.payload.environment;
        state.envSource = action.payload.source;
      })
      .addCase(fetchEnvironment.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; });
  },
});

export default environmentSlice.reducer;
