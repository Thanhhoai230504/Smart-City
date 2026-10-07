import React, { useState } from 'react';
import { useNavigate, Link as RouterLink, useLocation, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { loginThunk, clearError } from '../../store/slices/authSlice';
import {
  Alert, Box, CircularProgress, IconButton, InputAdornment, Link, TextField, Typography,
} from '@mui/material';
import {
  EmailOutlined, LockOutlined, LoginRounded, NotificationsActiveRounded,
  StarRateRounded, TimelineRounded, Visibility, VisibilityOff,
} from '@mui/icons-material';
import { rememberPostLoginPath, resolvePostLoginPath } from '../../utils/authRedirect';
import AuthShell, { AuthDivider, AuthSubmitButton, GoogleButton } from '../../components/AuthShell';
import { authFieldSx, authLinkSx } from '../../components/authStyles';
import { GradientText } from '../Home/SectionHeading';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const POINTS = [
  { icon: NotificationsActiveRounded, title: 'Thông báo ngay khi có cập nhật', text: 'Biết khi phản ánh được tiếp nhận, đang xử lý hay đã hoàn tất.' },
  { icon: TimelineRounded, title: 'Theo dõi từng bước', text: 'Xem trạng thái, hạn xử lý và ảnh minh chứng khi hoàn tất.' },
  { icon: StarRateRounded, title: 'Đánh giá và yêu cầu mở lại', text: 'Chấm điểm kết quả; chưa hài lòng thì yêu cầu đơn vị xử lý tiếp.' },
];

const LoginPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { loading, error } = useSelector((s: RootState) => s.auth);
  // Trang người dùng đang định vào trước khi bị yêu cầu đăng nhập: ProtectedRoute
  // truyền qua state; `?from=` dùng khi quay lại từ Google OAuth thất bại hoặc tải lại trang.
  const from = (location.state as { from?: unknown } | null)?.from ?? searchParams.get('from');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const oauthError = searchParams.get('error');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());
    const result = await dispatch(loginThunk({ email, password }));
    if (loginThunk.fulfilled.match(result)) {
      // Quay lại đúng trang đang định vào (đã kiểm tra là đường dẫn nội bộ), nếu
      // không thì về trang làm việc theo vai trò — trước đây luôn về trang chủ.
      navigate(resolvePostLoginPath(from, result.payload.user?.role), { replace: true });
    } else if (loginThunk.rejected.match(result) && result.payload?.code === 'EMAIL_NOT_VERIFIED') {
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    }
  };

  const handleGoogleLogin = () => {
    // Rời ứng dụng sang Google thì state của router mất — ghi nhớ đích đến để
    // AuthCallback đưa người dùng quay lại sau khi đăng nhập xong.
    rememberPostLoginPath(from);
    const backendUrl = API_URL.replace('/api', '');
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  return (
    <AuthShell
      pitch={<>Theo dõi phản ánh của bạn <GradientText dark>đến khi xử lý xong.</GradientText></>}
      pitchText="Đăng nhập để báo sự cố mới, xem tiến độ xử lý và nhận thông báo ngay khi có cập nhật."
      points={POINTS}
      title="Đăng nhập"
      subtitle="Chào mừng bạn trở lại Smart City Đà Nẵng."
    >
      {(error || oauthError) && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => dispatch(clearError())}>
          {error || 'Đăng nhập bằng Google thất bại. Vui lòng thử lại.'}
        </Alert>
      )}

      <GoogleButton onClick={handleGoogleLogin}>Đăng nhập với Google</GoogleButton>

      <AuthDivider>hoặc dùng email</AuthDivider>

      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth label="Email" type="email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          required sx={{ ...authFieldSx, mb: 2.25 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined /></InputAdornment> }}
        />
        <TextField
          fullWidth label="Mật khẩu" type={showPass ? 'text' : 'password'} autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)}
          required sx={authFieldSx}
          InputProps={{
            startAdornment: <InputAdornment position="start"><LockOutlined /></InputAdornment>,
            endAdornment: (
              <InputAdornment position="end">
                <IconButton aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPass(!showPass)} edge="end">
                  {showPass ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.25, mb: 3 }}>
          <Link component={RouterLink} to="/forgot-password" sx={{ ...authLinkSx, fontSize: 14 }}>Quên mật khẩu?</Link>
        </Box>

        <AuthSubmitButton
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginRounded />}
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </AuthSubmitButton>
      </Box>

      <Typography sx={{ mt: 3, textAlign: 'center', fontSize: 15, color: '#3F5563' }}>
        Chưa có tài khoản?{' '}
        <Link component={RouterLink} to="/register" sx={authLinkSx}>Đăng ký ngay</Link>
      </Typography>
    </AuthShell>
  );
};

export default LoginPage;
