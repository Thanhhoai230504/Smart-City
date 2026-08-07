import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { UserRole } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

interface Props {
  children: React.ReactElement;
  roles?: UserRole[];
}

const ProtectedRoute: React.FC<Props> = ({ children, roles }) => {
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Khi tải lại trang, token có sẵn trước khi profile được lấy về.
  // Chờ profile để tránh chuyển hướng sai người dùng có quyền.
  if (roles && !user) {
    return <LoadingSpinner text="Đang kiểm tra quyền truy cập..." />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
