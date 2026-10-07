import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { registerThunk, clearError } from '../../store/slices/authSlice';
import {
  Alert, Box, CircularProgress, IconButton, InputAdornment, Link, TextField, Typography,
} from '@mui/material';
import {
  AddAPhotoRounded, EmailOutlined, LocationOnRounded, LockOutlined, NotificationsActiveRounded,
  PersonAddRounded, PersonOutlineRounded, Visibility, VisibilityOff,
} from '@mui/icons-material';
import { getPasswordLengthError, PASSWORD_HINT } from '../../utils/password';
import AuthShell, { AuthDivider, AuthSubmitButton, GoogleButton } from '../../components/AuthShell';
import { authFieldSx, authLinkSx } from '../../components/authStyles';
import { GradientText } from '../Home/SectionHeading';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const POINTS = [
  { icon: AddAPhotoRounded, title: 'Báo sự cố trong khoảng 1 phút', text: 'Chụp ảnh, AI gợi ý loại sự cố, vị trí lấy tự động từ GPS.' },
  { icon: NotificationsActiveRounded, title: 'Nhận thông báo từng bước', text: 'Theo dõi tiến độ cho tới khi sự cố được xử lý xong.' },
  { icon: LocationOnRounded, title: 'Theo dõi khu vực của bạn', text: 'Chọn quận, huyện để được báo khi có sự cố mới gần bạn.' },
];

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

    // Báo sớm thay vì để server từ chối: trước đây màn hình ghi "tối thiểu 6 ký tự"
    // trong khi backend đòi 8, người dùng làm đúng hướng dẫn vẫn bị từ chối.
    const passwordError = getPasswordLengthError(password);
    if (passwordError) {
      setLocalError(passwordError);
      return;
    }

    if (password !== confirmPwd) {
      setLocalError('Mật khẩu xác nhận không khớp');
      return;
    }

    const result = await dispatch(registerThunk({ name, email, password }));
    if (registerThunk.fulfilled.match(result)) {
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    }
  };

  const handleGoogleRegister = () => {
    const backendUrl = API_URL.replace('/api', '');
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  return (
    <AuthShell
      pitch={<>Cùng giữ cho Đà Nẵng <GradientText dark>an toàn và sạch đẹp hơn.</GradientText></>}
      pitchText="Tài khoản miễn phí cho người dân — báo sự cố, theo dõi xử lý và đánh giá kết quả trên cả web lẫn ứng dụng Android."
      points={POINTS}
      title="Tạo tài khoản"
      subtitle="Miễn phí — chỉ cần họ tên, email và mật khẩu."
    >
      {(error || localError) && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => { dispatch(clearError()); setLocalError(''); }}>
          {error || localError}
        </Alert>
      )}

      <GoogleButton onClick={handleGoogleRegister}>Đăng ký với Google</GoogleButton>

      <AuthDivider>hoặc dùng email</AuthDivider>

      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth label="Họ và tên" autoComplete="name"
          value={name} onChange={(e) => setName(e.target.value)}
          required sx={{ ...authFieldSx, mb: 2.25 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutlineRounded /></InputAdornment> }}
        />
        <TextField
          fullWidth label="Email" type="email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          required sx={{ ...authFieldSx, mb: 2.25 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined /></InputAdornment> }}
        />
        <TextField
          fullWidth label="Mật khẩu" type={showPass ? 'text' : 'password'} autoComplete="new-password"
          value={password} onChange={(e) => setPassword(e.target.value)}
          required helperText={PASSWORD_HINT} sx={{ ...authFieldSx, mb: 2.25 }}
          error={password.length > 0 && getPasswordLengthError(password) !== null}
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
        <TextField
          fullWidth label="Xác nhận mật khẩu" type={showPass ? 'text' : 'password'} autoComplete="new-password"
          value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)}
          required sx={{ ...authFieldSx, mb: 3.5 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><LockOutlined /></InputAdornment> }}
        />

        <AuthSubmitButton
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PersonAddRounded />}
        >
          {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
        </AuthSubmitButton>
      </Box>

      <Typography sx={{ mt: 3, textAlign: 'center', fontSize: 15, color: '#3F5563' }}>
        Đã có tài khoản?{' '}
        <Link component={RouterLink} to="/login" sx={authLinkSx}>Đăng nhập</Link>
      </Typography>
    </AuthShell>
  );
};

export default RegisterPage;
