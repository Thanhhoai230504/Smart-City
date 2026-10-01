import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from './store/store';
import { getProfileThunk } from './store/slices/authSlice';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { useSocket } from './hooks/useSocket';
import AppRouter from './router';
import { metaApi } from './api/metaApi';
import ErrorBoundary from './components/ErrorBoundary';
import { setStatusTransitions } from './utils/constants';

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated } = useSelector((s: RootState) => s.auth);

  // Fetch user profile on mount if token exists
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(getProfileThunk());
    }
  }, [dispatch, isAuthenticated]);

  // Taxonomy (luật chuyển trạng thái, nhãn, ngưỡng) lấy từ server thay vì hardcode.
  // Lỗi mạng không được chặn app khởi động: constants đã có sẵn bản dự phòng.
  useEffect(() => {
    const controller = new AbortController();
    metaApi.getEnums(controller.signal)
      .then(({ data }) => setStatusTransitions(data.data.statusTransitions))
      .catch(() => { /* giữ bản dự phòng trong utils/constants */ });
    return () => controller.abort();
  }, []);

  // Socket.io notifications
  useSocket((event, data) => {
    if (event === 'issue:created') {
      toast.info(`📍 Sự cố mới: ${data.message}`, { position: 'bottom-right' });
    }
    if (event === 'issue:updated') {
      toast.info(`🔄 ${data.message}`, { position: 'bottom-right' });
    }
    if (event === 'issue:resolved') {
      toast.success(`✅ ${data.message}`, { position: 'bottom-right' });
    }
  });

  return (
    <BrowserRouter>
      {/* Bọc trong BrowserRouter để khi lỗi xảy ra vẫn còn router context — nếu
          bọc ngoài thì nút "Về trang chủ" phải dùng window.location thay vì điều
          hướng client-side. */}
      <ErrorBoundary>
        <AppRouter />
      </ErrorBoundary>
      {/* ToastContainer đặt NGOÀI ErrorBoundary để thông báo vẫn hiện được khi
          cây component chính đã hỏng. */}
      <ToastContainer theme="light" toastStyle={{ background: '#FFFFFF', color: '#18323F', borderRadius: 10, border: '1px solid #DCE7EB', boxShadow: '0 8px 24px rgba(32,71,83,.12)' }} />
    </BrowserRouter>
  );
};

export default App;
