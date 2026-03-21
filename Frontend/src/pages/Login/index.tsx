import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { loginThunk, clearError } from '../../store/slices/authSlice';
import {
  Box, Container, Card, CardContent, Typography, TextField, Button,
  Alert, InputAdornment, IconButton, CircularProgress, Link,
} from '@mui/material';
import { Email, Lock, Visibility, VisibilityOff, Login as LoginIcon } from '@mui/icons-material';

const LoginPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((s: RootState) => s.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());
    const result = await dispatch(loginThunk({ email, password }));
    if (loginThunk.fulfilled.match(result)) {
      navigate('/');
    }
  };

  return (
    <Box sx={{
      minHeight: 'calc(100vh - 70px)', display: 'flex', alignItems: 'center',
      background: 'linear-gradient(135deg, #0A0E1A 0%, #111827 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      <Box sx={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.1), transparent 70%)', filter: 'blur(60px)' }} />

      <Container maxWidth="sm">
        <Card sx={{ p: { xs: 2, md: 4 }, backdropFilter: 'blur(20px)', bgcolor: 'rgba(17,24,39,0.8)' }}>
          <CardContent>
            <Box textAlign="center" mb={4}>
              <Box sx={{
                width: 56, height: 56, borderRadius: '16px', mx: 'auto', mb: 2,
                background: 'linear-gradient(135deg, #6C63FF, #00D9A6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
              }}>🏙️</Box>
              <Typography variant="h4" fontWeight={700}>Đăng nhập</Typography>
              <Typography color="text.secondary" mt={1}>Chào mừng bạn trở lại Smart City</Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => dispatch(clearError())}>{error}</Alert>}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required sx={{ mb: 2.5 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Email sx={{ color: 'text.secondary' }} /></InputAdornment> }} />
              <TextField fullWidth label="Mật khẩu" type={showPass ? 'text' : 'password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
                required sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Lock sx={{ color: 'text.secondary' }} /></InputAdornment>,
                  endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPass(!showPass)} edge="end">{showPass ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment>,
                }} />
              <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />} sx={{ py: 1.5, mb: 2.5 }}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
              <Typography textAlign="center" color="text.secondary">
                Chưa có tài khoản?{' '}
                <Link component={RouterLink} to="/register" sx={{ color: 'primary.main', fontWeight: 600 }}>Đăng ký ngay</Link>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default LoginPage;
