import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  TextField,
  Typography,
} from '@mui/material';
import { Login, MarkEmailRead, Refresh } from '@mui/icons-material';
import { authApi } from '../../api/authApi';

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const initialEmail = searchParams.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [verifying, setVerifying] = useState(Boolean(token));
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!token) return undefined;

    let active = true;
    const verify = async () => {
      try {
        await authApi.verifyEmail(token);
        if (active) setVerified(true);
      } catch (err: unknown) {
        if (!active) return;
        const message = axios.isAxiosError<{ message?: string }>(err)
          ? err.response?.data?.message
          : null;
        setError(message || 'Liên kết xác thực không hợp lệ hoặc đã hết hạn.');
      } finally {
        if (active) setVerifying(false);
      }
    };

    verify();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email.trim()) {
      setError('Vui lòng nhập email đã đăng ký.');
      return;
    }

    setResending(true);
    setError('');
    setResendMessage('');
    try {
      const { data } = await authApi.resendVerification(email.trim());
      setResendMessage(data.message || 'Email xác thực mới đã được gửi.');
      setCooldown(60);
    } catch (err: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message
        : null;
      setError(message || 'Không thể gửi lại email xác thực. Vui lòng thử lại.');
    } finally {
      setResending(false);
    }
  };

  return (
    <Box sx={{
      minHeight: 'calc(100vh - 70px)',
      display: 'flex',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #0A0E1A 0%, #111827 100%)',
    }}>
      <Container maxWidth="sm">
        <Card sx={{ p: { xs: 2, md: 4 }, bgcolor: 'rgba(17,24,39,0.88)' }}>
          <CardContent>
            <Box textAlign="center" mb={3}>
              <MarkEmailRead color="primary" sx={{ fontSize: 58, mb: 1.5 }} />
              <Typography variant="h4" fontWeight={700}>Xác thực email</Typography>
            </Box>

            {verifying ? (
              <Box textAlign="center" py={3}>
                <CircularProgress />
                <Typography color="text.secondary" mt={2}>
                  Đang kiểm tra liên kết xác thực...
                </Typography>
              </Box>
            ) : verified ? (
              <>
                <Alert severity="success" sx={{ mb: 3 }}>
                  Email đã được xác thực thành công. Bạn có thể đăng nhập ngay.
                </Alert>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  component={RouterLink}
                  to="/login"
                  startIcon={<Login />}
                >
                  Đến trang đăng nhập
                </Button>
              </>
            ) : (
              <>
                <Typography color="text.secondary" textAlign="center" mb={3}>
                  Hãy mở liên kết trong email chúng tôi vừa gửi. Nếu chưa nhận được,
                  bạn có thể gửi lại bên dưới.
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {resendMessage && <Alert severity="success" sx={{ mb: 2 }}>{resendMessage}</Alert>}

                <TextField
                  fullWidth
                  type="email"
                  label="Email đã đăng ký"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={resending}
                  sx={{ mb: 2 }}
                />
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleResend}
                  disabled={resending || cooldown > 0}
                  startIcon={resending ? <CircularProgress size={20} /> : <Refresh />}
                >
                  {resending
                    ? 'Đang gửi...'
                    : cooldown > 0
                      ? `Gửi lại sau ${cooldown}s`
                      : 'Gửi lại email xác thực'}
                </Button>
                <Button fullWidth component={RouterLink} to="/login" sx={{ mt: 1.5 }}>
                  Quay lại đăng nhập
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default VerifyEmailPage;
