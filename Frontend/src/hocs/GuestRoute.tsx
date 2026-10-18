import React, { useRef } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import LoadingSpinner from '../components/LoadingSpinner';
import { resolvePostLoginPath } from '../utils/authRedirect';

/**
 * Trang chỉ dành cho khách: đăng nhập, đăng ký, quên mật khẩu.
 *
 * Trước đây người đã đăng nhập vẫn mở được các trang này và đăng nhập chồng bằng tài
 * khoản khác. Giờ vào khi đã có phiên thì chuyển tới nơi định tới (`from`) hoặc trang
 * theo vai trò — cùng quy tắc với trang Đăng nhập (`resolvePostLoginPath`).
 *
 * Chỉ xét trạng thái lúc vừa vào trang: đăng nhập ngay trên trang này thì để trang
 * Đăng nhập tự chuyển hướng (nó còn xử lý EMAIL_NOT_VERIFIED). Token có sẵn nhưng hồ
 * sơ chưa về thì chờ; token hỏng thì hồ sơ lỗi, phiên bị xoá và trang hiện bình thường.
 */
const GuestRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const arrivedLoggedIn = useRef(isAuthenticated).current;

  if (!arrivedLoggedIn || !isAuthenticated) return children;
  if (!user) return <LoadingSpinner text="Đang kiểm tra phiên đăng nhập..." />;

  const from = (location.state as { from?: unknown } | null)?.from ?? searchParams.get('from');
  return <Navigate to={resolvePostLoginPath(from, user.role)} replace />;
};

export default GuestRoute;
