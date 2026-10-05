import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store/store';
import { setToken, getProfileThunk } from '../../store/slices/authSlice';
import { authApi } from '../../api/authApi';
import { Box, CircularProgress, Typography } from '@mui/material';
import {
  forgetRememberedPostLoginPath,
  readRememberedPostLoginPath,
  resolvePostLoginPath,
} from '../../utils/authRedirect';

/**
 * Đổi cookie refresh lấy access token — MỘT lần cho mỗi lượt quay về từ Google.
 *
 * StrictMode (môi trường dev) chạy effect hai lần. Refresh token được XOAY (mỗi
 * lần dùng là thu hồi bản cũ), nên hai lời gọi song song cầm cùng một cookie thì
 * một lời gọi thất bại — nếu đó là lời gọi của lần chạy còn hiệu lực, người dùng
 * bị đẩy về /login dù đăng nhập Google đã thành công. Dùng chung một promise cho
 * hai lần chạy; xoá sau khi xong để lần quay về sau (trang tải lại) gọi mới.
 */
let pendingExchange: Promise<string> | null = null;
const exchangeRefreshCookie = (): Promise<string> => {
  if (!pendingExchange) {
    pendingExchange = authApi.refresh()
      .then(({ data }) => data.data.accessToken as string)
      .finally(() => { pendingExchange = null; });
  }
  return pendingExchange;
};

const AuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  useEffect(() => {
    // Đích đến được Login ghi nhớ trước khi rời sang Google (chỉ đọc ở đây, xoá
    // khi đã dùng — xem chú thích ở exchangeRefreshCookie về StrictMode).
    const rememberedPath = readRememberedPostLoginPath();
    const backToLogin = () => {
      forgetRememberedPostLoginPath();
      // Mang đích đến theo để lần thử lại từ trang đăng nhập vẫn quay về đúng chỗ.
      const query = new URLSearchParams({ error: 'oauth_failed' });
      if (rememberedPath) query.set('from', rememberedPath);
      navigate(`/login?${query.toString()}`, { replace: true });
    };

    if (searchParams.get('error')) {
      backToLogin();
      return undefined;
    }

    // Backend KHÔNG còn gửi access token qua URL (lỗ hổng L8: URL vào lịch sử
    // trình duyệt, log proxy và rò qua header Referer). Nó set cookie refresh
    // httpOnly rồi chuyển hướng về đây; đổi cookie đó lấy access token.
    let cancelled = false;
    exchangeRefreshCookie()
      .then((accessToken) => {
        if (cancelled) return null;
        dispatch(setToken(accessToken));
        return dispatch(getProfileThunk()).unwrap();
      })
      .then((profile) => {
        if (cancelled || !profile) return;
        forgetRememberedPostLoginPath();
        navigate(resolvePostLoginPath(rememberedPath, profile.user?.role), { replace: true });
      })
      .catch(() => { if (!cancelled) backToLogin(); });

    return () => { cancelled = true; };
  }, [searchParams, dispatch, navigate]);

  return (
    <Box sx={{
      minHeight: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #F4F7F8 0%, #EAF2F4 100%)',
    }}>
      <CircularProgress size={48} sx={{ mb: 3, color: 'primary.main' }} />
      <Typography variant="h6" fontWeight={600}>Đang xác thực...</Typography>
      <Typography color="text.secondary" mt={1}>Vui lòng chờ trong giây lát</Typography>
    </Box>
  );
};

export default AuthCallbackPage;
