import React, { useState } from 'react';
import { useNavigate, Link as RouterLink, useLocation, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { loginThunk, clearError } from '../../store/slices/authSlice';
import {
  Box, Container, Card, CardContent, Typography, TextField, Button,
  Alert, InputAdornment, IconButton, CircularProgress, Link, Divider,
} from '@mui/material';
import { Email, Lock, Visibility, VisibilityOff, Login as LoginIcon } from '@mui/icons-material';
import { rememberPostLoginPath, resolvePostLoginPath } from '../../utils/authRedirect';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
    <Box sx={{
      minHeight: 'calc(100vh - 70px)', display: 'flex', alignItems: 'center',
      background: 'linear-gradient(135deg, #F4F7F8 0%, #EAF2F4 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      <Box sx={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(11,94,142,0.08), transparent 70%)', filter: 'blur(60px)' }} />

      <Container maxWidth="sm">
        <Card sx={{ p: { xs: 2, md: 4 }, bgcolor: '#FFFFFF' }}>
          <CardContent>
            <Box textAlign="center" mb={4}>
              <Box sx={{
                width: 56, height: 56, borderRadius: '16px', mx: 'auto', mb: 2,
                background: '#176B87',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
              }}>🏙️</Box>
              <Typography variant="h4" fontWeight={700}>Đăng nhập</Typography>
              <Typography color="text.secondary" mt={1}>Chào mừng bạn trở lại Smart City</Typography>
            </Box>

            {(error || oauthError) && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => dispatch(clearError())}>
                {error || 'Đăng nhập bằng Google thất bại. Vui lòng thử lại.'}
              </Alert>
            )}

            {/* Google Login Button */}
            <Button
              fullWidth variant="outlined" size="large"
              onClick={handleGoogleLogin}
              sx={{
                py: 1.4, mb: 3, borderRadius: '12px', textTransform: 'none',
                borderColor: '#C8D9DE', color: '#18323F', fontWeight: 700,
                fontSize: '0.95rem',
                '&:hover': { borderColor: '#176B87', bgcolor: '#EFF7F9' },
              }}
              startIcon={
                <Box component="img" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  sx={{ width: 20, height: 20 }} />
              }
            >
              Đăng nhập với Google
            </Button>

            <Divider sx={{ mb: 3, '&::before, &::after': { borderColor: '#DCE7EB' } }}>
              <Typography variant="caption" color="text.secondary" px={1}>hoặc đăng nhập bằng email</Typography>
            </Divider>

            <Box component="form" onSubmit={handleSubmit}>
              <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required sx={{ mb: 2.5 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Email sx={{ color: 'text.secondary' }} /></InputAdornment> }} />
              <TextField fullWidth label="Mật khẩu" type={showPass ? 'text' : 'password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
                required sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Lock sx={{ color: 'text.secondary' }} /></InputAdornment>,
                  endAdornment: <InputAdornment position="end"><IconButton aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPass(!showPass)} edge="end">{showPass ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment>,
                }} />
              <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />} sx={{ py: 1.5, mb: 2.5 }}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
              <Typography textAlign="center" color="text.secondary">
                Chưa có tài khoản?{' '}
                <Link component={RouterLink} to="/register" sx={{ color: 'primary.main', fontWeight: 600 }}>Đăng ký ngay</Link>
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center" mt={1}>
                <Link component={RouterLink} to="/forgot-password" sx={{ color: 'primary.main', fontWeight: 600 }}>Quên mật khẩu?</Link>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default LoginPage;
