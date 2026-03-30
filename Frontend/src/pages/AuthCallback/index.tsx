import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store/store';
import { setToken, getProfileThunk } from '../../store/slices/authSlice';
import { Box, CircularProgress, Typography } from '@mui/material';

const AuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      navigate('/login?error=oauth_failed');
      return;
    }

    if (token) {
      dispatch(setToken(token));
      dispatch(getProfileThunk()).then(() => {
        navigate('/');
      });
    } else {
      navigate('/login');
    }
  }, [searchParams, dispatch, navigate]);

  return (
    <Box sx={{
      minHeight: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0A0E1A 0%, #111827 100%)',
    }}>
      <CircularProgress size={48} sx={{ mb: 3, color: '#6C63FF' }} />
      <Typography variant="h6" fontWeight={600}>Đang xác thực...</Typography>
      <Typography color="text.secondary" mt={1}>Vui lòng chờ trong giây lát</Typography>
    </Box>
  );
};

export default AuthCallbackPage;
