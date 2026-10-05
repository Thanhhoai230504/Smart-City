import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../api/authApi';
import { AuthState, LoginCredentials, RegisterData, User } from '../../types';
import { getApiErrorCode, getApiErrorMessage } from '../../utils/apiError';

const initialState: AuthState = {
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  loading: false,
  error: null,
};

export interface AuthFailure {
  message: string;
  code?: string;
}

export const loginThunk = createAsyncThunk<
  { accessToken: string; user: User },
  LoginCredentials,
  { rejectValue: AuthFailure }
>('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await authApi.login(credentials);
    return data.data;
  } catch (err: unknown) {
    return rejectWithValue({
      message: getApiErrorMessage(err, 'Đăng nhập thất bại. Vui lòng thử lại.'),
      code: getApiErrorCode(err),
    });
  }
});

export const registerThunk = createAsyncThunk('auth/register', async (userData: RegisterData, { rejectWithValue }) => {
  try {
    const { data } = await authApi.register(userData);
    return data.data;
  } catch (err: unknown) {
    return rejectWithValue(getApiErrorMessage(err, 'Đăng ký thất bại. Vui lòng thử lại.'));
  }
});

export const getProfileThunk = createAsyncThunk('auth/getProfile', async (_, { rejectWithValue }) => {
  try {
    const { data } = await authApi.getProfile();
    return data.data;
  } catch (err: unknown) {
    return rejectWithValue(getApiErrorMessage(err, 'Không lấy được thông tin tài khoản.'));
  }
});

export const logoutThunk = createAsyncThunk('auth/logout', async () => {
  try { await authApi.logout(); } catch { /* ignore */ }
  localStorage.removeItem('accessToken');
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    setToken: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload;
      state.isAuthenticated = true;
      localStorage.setItem('accessToken', action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginThunk.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.isAuthenticated = true;
        localStorage.setItem('accessToken', action.payload.accessToken);
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.error.message || 'Đăng nhập thất bại';
      })
      // Register
      .addCase(registerThunk.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(registerThunk.fulfilled, (state) => { state.loading = false; })
      .addCase(registerThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Profile
      .addCase(getProfileThunk.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(getProfileThunk.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.accessToken = null;
        localStorage.removeItem('accessToken');
      })
      // Logout
      .addCase(logoutThunk.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.isAuthenticated = false;
      });
  },
});

export const { clearError, setToken } = authSlice.actions;
export default authSlice.reducer;
