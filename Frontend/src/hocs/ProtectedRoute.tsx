import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { RootState } from '../store/store';
import { UserRole } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { getRoleHomePath } from '../utils/authRedirect';

interface Props {
  children: React.ReactElement;
  roles?: UserRole[];
}

/**
 * Sai vai trò thì báo lý do rồi đưa về trang của vai trò đó (người dân → trang chủ,
 * cán bộ → /staff, quản trị → /admin), thay vì lặng lẽ về trang chủ.
 */
const DeniedRedirect: React.FC<{ to: string }> = ({ to }) => {
  useEffect(() => {
    toast.warning('Bạn không có quyền truy cập trang này.', { toastId: 'route-denied' });
  }, []);
  return <Navigate to={to} replace />;
};

const ProtectedRoute: React.FC<Props> = ({ children, roles }) => {
  const { user, isAuthenticated, loggedOut } = useSelector((s: RootState) => s.auth);
  const location = useLocation();

  if (!isAuthenticated) {
    // Tự đăng xuất thì về trang chủ. Không dựa vào lệnh điều hướng của nút Đăng xuất:
    // chuyển trang chạy trong transition và trang đích tải lười, nên cây cũ (trang này)
    // còn hiển thị lúc phiên bị xoá và kịp đẩy người dùng sang /login.
    if (loggedOut) return <Navigate to="/" replace />;
    // Hết phiên / chưa đăng nhập: sang /login và nhớ trang đang xem để quay lại.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Khi tải lại trang, token có sẵn trước khi hồ sơ được lấy về. Chờ hồ sơ để biết vai
  // trò; chưa dựng trang con (và MainLayout chưa dựng thanh điều hướng làm việc) nên
  // không lộ giao diện hay gọi API của vai trò khác.
  if (roles && !user) {
    return <LoadingSpinner text="Đang kiểm tra quyền truy cập..." />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <DeniedRedirect to={getRoleHomePath(user.role)} />;
  }

  return children;
};

export default ProtectedRoute;
