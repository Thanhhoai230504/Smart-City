import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { registerThunk, clearError } from '../../store/slices/authSlice';
import {
  Box, Container, Card, CardContent, Typography, TextField, Button,
  Alert, InputAdornment, IconButton, CircularProgress, Link, Divider,
} from '@mui/material';
import { Person, Email, Lock, Visibility, VisibilityOff, PersonAdd } from '@mui/icons-material';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const RegisterPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((s: RootState) => s.auth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    dispatch(clearError());

    if (password !== confirmPwd) {
      setLocalError('Mật khẩu xác nhận không khớp');
      return;
    }

    const result = await dispatch(registerThunk({ name, email, password }));
    if (registerThunk.fulfilled.match(result)) {
      navigate('/login');
    }
  };

  const handleGoogleRegister = () => {
    const backendUrl = API_URL.replace('/api', '');
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  return (
    <Box sx={{
      minHeight: 'calc(100vh - 70px)', display: 'flex', alignItems: 'center',
      background: 'linear-gradient(135deg, #0A0E1A 0%, #111827 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      <Box sx={{ position: 'absolute', bottom: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1), transparent 70%)', filter: 'blur(60px)' }} />

      <Container maxWidth="sm">
        <Card sx={{ p: { xs: 2, md: 4 }, backdropFilter: 'blur(20px)', bgcolor: 'rgba(17,24,39,0.8)' }}>
          <CardContent>
            <Box textAlign="center" mb={4}>
              <Box sx={{
                width: 56, height: 56, borderRadius: '16px', mx: 'auto', mb: 2,
                background: 'linear-gradient(135deg, #10B981, #0EA5E9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
              }}>👤</Box>
              <Typography variant="h4" fontWeight={700}>Đăng ký</Typography>
              <Typography color="text.secondary" mt={1}>Tạo tài khoản Smart City Dashboard</Typography>
            </Box>

            {(error || localError) && <Alert severity="error" sx={{ mb: 3 }} onClose={() => { dispatch(clearError()); setLocalError(''); }}>{error || localError}</Alert>}

            {/* Google Register Button */}
            <Button
              fullWidth variant="outlined" size="large"
              onClick={handleGoogleRegister}
              sx={{
                py: 1.4, mb: 3, borderRadius: '12px', textTransform: 'none',
                borderColor: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600,
                fontSize: '0.95rem',
                '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.05)' },
              }}
              startIcon={
                <Box component="img" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  sx={{ width: 20, height: 20 }} />
              }
            >
              Đăng ký với Google
            </Button>

            <Divider sx={{ mb: 3, '&::before, &::after': { borderColor: 'rgba(255,255,255,0.1)' } }}>
              <Typography variant="caption" color="text.secondary" px={1}>hoặc đăng ký bằng email</Typography>
            </Divider>

            <Box component="form" onSubmit={handleSubmit}>
              <TextField fullWidth label="Họ và tên" value={name} onChange={(e) => setName(e.target.value)}
                required sx={{ mb: 2.5 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Person sx={{ color: 'text.secondary' }} /></InputAdornment> }} />
              <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required sx={{ mb: 2.5 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Email sx={{ color: 'text.secondary' }} /></InputAdornment> }} />
              <TextField fullWidth label="Mật khẩu" type={showPass ? 'text' : 'password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
                required helperText="Tối thiểu 6 ký tự" sx={{ mb: 2.5 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Lock sx={{ color: 'text.secondary' }} /></InputAdornment>,
                  endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPass(!showPass)} edge="end">{showPass ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment>,
                }} />
              <TextField fullWidth label="Xác nhận mật khẩu" type={showPass ? 'text' : 'password'}
                value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)}
                required sx={{ mb: 3 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Lock sx={{ color: 'text.secondary' }} /></InputAdornment> }} />
              <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <PersonAdd />} sx={{ py: 1.5, mb: 2.5 }}>
                {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
              </Button>
              <Typography textAlign="center" color="text.secondary">
                Đã có tài khoản?{' '}
                <Link component={RouterLink} to="/login" sx={{ color: 'primary.main', fontWeight: 600 }}>Đăng nhập</Link>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default RegisterPage;
