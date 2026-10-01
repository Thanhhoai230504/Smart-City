import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store/store';
import { setToken, getProfileThunk } from '../../store/slices/authSlice';
import { authApi } from '../../api/authApi';
import { Box, CircularProgress, Typography } from '@mui/material';

const AuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  useEffect(() => {
    const error = searchParams.get('error');

    if (error) {
      navigate('/login?error=oauth_failed');
      return;
    }

    // Backend KHÔNG còn gửi access token qua URL (lỗ hổng L8: URL vào lịch sử
    // trình duyệt, log proxy và rò qua header Referer). Nó set cookie refresh
    // httpOnly rồi chuyển hướng về đây; đổi cookie đó lấy access token.
    let cancelled = false;
    authApi.refresh()
      .then(({ data }) => {
        if (cancelled) return;
        dispatch(setToken(data.data.accessToken));
        return dispatch(getProfileThunk());
      })
      .then(() => { if (!cancelled) navigate('/'); })
      .catch(() => { if (!cancelled) navigate('/login?error=oauth_failed'); });

    return () => { cancelled = true; };
  }, [searchParams, dispatch, navigate]);

  return (
    <Box sx={{
      minHeight: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #F4F7F8 0%, #EAF2F4 100%)',
    }}>
      <CircularProgress size={48} sx={{ mb: 3, color: '#0EA5E9' }} />
      <Typography variant="h6" fontWeight={600}>Đang xác thực...</Typography>
      <Typography color="text.secondary" mt={1}>Vui lòng chờ trong giây lát</Typography>
    </Box>
  );
};

export default AuthCallbackPage;
