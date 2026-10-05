import React, { useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Container, Paper, Typography, TextField, Button, Alert, Link, Stack,
} from '@mui/material';
import { authApi } from '../../api/authApi';
import { getApiErrorMessage } from '../../utils/apiError';
import { getPasswordLengthError, MIN_PASSWORD_LENGTH } from '../../utils/password';

/**
 * Đặt mật khẩu mới bằng token trong email.
 *
 * Token chỉ dùng được một lần và backend thu hồi MỌI phiên sau khi đổi — người
 * dùng đặt lại mật khẩu thường vì nghi tài khoản bị chiếm, nên phải cắt được
 * thiết bị của kẻ tấn công chứ không chỉ đổi mật khẩu.
 */
const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const passwordError = password.length > 0 ? getPasswordLengthError(password) : null;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length > 0 && !getPasswordLengthError(password) && password === confirm && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      // Đợi một nhịp để người dùng kịp đọc thông báo rồi mới chuyển trang.
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Không đặt lại được mật khẩu. Vui lòng thử lại.'));
    }
    setSubmitting(false);
  };

  if (!token) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, borderRadius: 3 }}>
          <Alert severity="error">
            Liên kết không hợp lệ — thiếu mã đặt lại mật khẩu. Hãy yêu cầu một liên kết mới.
          </Alert>
          <Stack direction="row" justifyContent="center" mt={3}>
            <Link component={RouterLink} to="/forgot-password" sx={{ fontWeight: 600 }}>
              Gửi lại liên kết
            </Link>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h5" fontWeight={700} mb={1}>Đặt mật khẩu mới</Typography>

        {done ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            Đặt lại mật khẩu thành công. Mọi thiết bị đã được đăng xuất để bảo vệ tài khoản.
            Đang chuyển tới trang đăng nhập...
          </Alert>
        ) : (
          <Box component="form" onSubmit={handleSubmit}>
            <Typography color="text.secondary" mb={3}>
              Chọn mật khẩu mới cho tài khoản của bạn.
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField
              fullWidth type="password" label="Mật khẩu mới" autoFocus required
              value={password} onChange={(e) => setPassword(e.target.value)}
              error={Boolean(passwordError)}
              helperText={passwordError || `Tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`}
              sx={{ mb: 1 }}
            />
            <TextField
              fullWidth type="password" label="Nhập lại mật khẩu mới" required
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              error={mismatch}
              helperText={mismatch ? 'Hai mật khẩu không khớp' : ' '}
              sx={{ mb: 2 }}
            />
            <Button fullWidth type="submit" variant="contained" disabled={!canSubmit}>
              {submitting ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
            </Button>
          </Box>
        )}

        <Stack direction="row" justifyContent="center" mt={3}>
          <Link component={RouterLink} to="/login" sx={{ fontWeight: 600 }}>
            Quay lại đăng nhập
          </Link>
        </Stack>
      </Paper>
    </Container>
  );
};

export default ResetPasswordPage;
