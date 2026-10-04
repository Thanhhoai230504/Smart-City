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
import { setReopenRules } from './utils/reopen';

/** Thông báo cần người nhận chú ý ngay — toast màu cảnh báo. */
const WARNING_TYPES = new Set(['sla_reminder', 'sla_escalated', 'intake_overdue', 'issue_reopened', 'issue_unassigned']);

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
      .then(({ data }) => {
        setStatusTransitions(data.data.statusTransitions);
        setReopenRules(data.data.reopen);
      })
      .catch(() => { /* giữ bản dự phòng trong utils/constants */ });
    return () => controller.abort();
  }, []);

  // Toast cho MỌI thông báo realtime, theo đúng bản ghi Notification của người
  // nhận. Trước đây chỉ có toast cho `issue:created/updated/resolved` — cán bộ
  // được giao việc, nhắc hạn, bị mở lại… chỉ thấy số trên chuông nhảy; còn toast
  // "sự cố mới" của admin in nguyên câu tiếng Anh từ server. Mỗi sự kiện
  // `issue:*` luôn đi kèm một `notification:new` cho cùng người nhận nên không
  // mất toast nào, và không bị hai toast cho một việc.
  useSocket((event, data) => {
    if (event !== 'notification:new' || !data) return;
    const content = (
      <div>
        <strong>{data.title}</strong>
        <div>{data.message}</div>
      </div>
    );
    const options = { position: 'bottom-right' as const };
    if (data.type === 'issue_resolved') toast.success(content, options);
    else if (WARNING_TYPES.has(data.type) || String(data.title || '').startsWith('⚠️')) toast.warning(content, options);
    else toast.info(content, options);
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
