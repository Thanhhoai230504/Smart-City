import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Container, Paper, Typography, TextField, Button, Alert, Link, Stack,
} from '@mui/material';
import { authApi } from '../../api/authApi';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * Quên mật khẩu.
 *
 * Trước đây tính năng này không tồn tại ở cả hai phía: người dùng đăng ký bằng
 * email/mật khẩu mà quên mật khẩu là mất tài khoản vĩnh viễn, vì chỉ đổi được
 * mật khẩu khi đã đăng nhập. Trên mobile còn dễ xảy ra hơn (bàn phím ảo, mật
 * khẩu lưu ở thiết bị khác).
 */
const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Không gửi được yêu cầu. Vui lòng thử lại.'));
    }
    setSubmitting(false);
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h5" fontWeight={700} mb={1}>Quên mật khẩu</Typography>

        {sent ? (
          <>
            {/* Thông điệp cố tình không xác nhận email có tồn tại hay không —
                nếu không, trang này thành công cụ dò tài khoản. */}
            <Alert severity="success" sx={{ mt: 2 }}>
              Nếu email tồn tại trong hệ thống, một liên kết đặt lại mật khẩu đã được gửi.
              Liên kết có hiệu lực trong 30 phút.
            </Alert>
            <Typography variant="body2" color="text.secondary" mt={2}>
              Không thấy email? Kiểm tra cả hộp thư rác, hoặc thử lại sau một phút.
            </Typography>
          </>
        ) : (
          <Box component="form" onSubmit={handleSubmit}>
            <Typography color="text.secondary" mb={3}>
              Nhập email bạn đã dùng để đăng ký. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu.
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField
              fullWidth type="email" label="Email" autoFocus required
              value={email} onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 3 }}
            />
            <Button fullWidth type="submit" variant="contained" disabled={submitting || !email.trim()}>
              {submitting ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
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

export default ForgotPasswordPage;
