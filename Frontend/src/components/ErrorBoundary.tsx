import React from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Chặn lỗi render để một component hỏng không làm trắng toàn bộ ứng dụng.
 *
 * Trường hợp hay gặp nhất không phải bug logic mà là **lỗi tải chunk sau deploy**:
 * người dùng đang mở tab cũ, bản build mới lên, mọi file băm tên đã đổi — lúc họ
 * chuyển trang thì `import()` của route lazy thất bại. `Suspense` ở router chỉ có
 * `fallback` (lúc đang tải) chứ không bắt lỗi, nên màn hình trắng hoàn toàn.
 *
 * Phải là class component: React chưa có hook tương đương `componentDidCatch`.
 */
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Giữ lại trong console để còn truy được; không gửi đi đâu vì dự án chưa có
    // dịch vụ thu thập lỗi.
    console.error('ErrorBoundary bắt được lỗi render:', error, info.componentStack);
  }

  /**
   * Lỗi tải chunk có cách xử lý khác hẳn lỗi logic: tải lại trang là xong, vì
   * bản build mới đã sẵn trên server.
   */
  private isChunkLoadError(error: Error): boolean {
    return /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i
      .test(`${error.name} ${error.message}`);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isStale = this.isChunkLoadError(error);

    return (
      <Container maxWidth="sm" sx={{ py: 10 }}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Typography fontSize="3rem">{isStale ? '🔄' : '⚠️'}</Typography>
          <Typography variant="h5" fontWeight={700}>
            {isStale ? 'Đã có phiên bản mới' : 'Đã xảy ra lỗi'}
          </Typography>
          <Typography color="text.secondary">
            {isStale
              ? 'Ứng dụng vừa được cập nhật. Hãy tải lại trang để dùng phiên bản mới nhất.'
              : 'Trang này gặp sự cố khi hiển thị. Bạn có thể thử lại hoặc quay về trang chủ.'}
          </Typography>

          {/* Chi tiết lỗi chỉ hữu ích khi phát triển; người dùng cuối không cần thấy. */}
          {import.meta.env.DEV && (
            <Box
              component="pre"
              sx={{
                mt: 1, p: 2, width: '100%', textAlign: 'left', overflow: 'auto',
                bgcolor: 'grey.100', borderRadius: 2, fontSize: 12,
              }}
            >
              {error.message}
            </Box>
          )}

          <Stack direction="row" spacing={1.5} pt={1}>
            <Button variant="contained" onClick={() => window.location.reload()}>
              Tải lại trang
            </Button>
            {!isStale && (
              <Button variant="outlined" onClick={() => { window.location.href = '/'; }}>
                Về trang chủ
              </Button>
            )}
          </Stack>
        </Stack>
      </Container>
    );
  }
}

export default ErrorBoundary;
