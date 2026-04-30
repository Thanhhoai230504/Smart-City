import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from './store/store';
import { getProfileThunk } from './store/slices/authSlice';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { useSocket } from './hooks/useSocket';
import AppRouter from './router';

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated } = useSelector((s: RootState) => s.auth);

  // Fetch user profile on mount if token exists
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(getProfileThunk());
    }
  }, [dispatch, isAuthenticated]);

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
      <AppRouter />
      <ToastContainer theme="dark" toastStyle={{ background: '#1A2332', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }} />
    </BrowserRouter>
  );
};

export default App;
