import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box } from '@mui/material';
import { RootState } from '../store/store';
import { requiredRoleForPath } from '../utils/authRedirect';
import Header from './Header';
import Footer from './Footer';
import WorkspaceSidebar from './WorkspaceSidebar';
import { WORKSPACE_SIDEBAR_WIDTH } from './workspaceNav';
import { HEADER_HEIGHT } from './chrome';
const ChatbotWidget = lazy(() => import('../components/ChatbotWidget'));

const MainLayout: React.FC = () => {
  const { pathname } = useLocation();
  const role = useSelector((s: RootState) => s.auth.user?.role);
  // Chỉ dựng khung làm việc (thanh điều hướng quản trị/cán bộ) khi đúng vai trò.
  // Chưa tải xong hồ sơ hoặc sai vai trò thì dùng khung thường; ProtectedRoute lo
  // màn chờ và chuyển hướng, nên không ai thấy menu quản trị khi không có quyền.
  const areaRole = requiredRoleForPath(pathname);
  const isWorkspace = areaRole !== null && role === areaRole;
  const showFooter = pathname !== '/map' && !isWorkspace;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => (
    window.localStorage.getItem('workspace-sidebar-collapsed') === 'true'
  ));

  useEffect(() => {
    window.localStorage.setItem('workspace-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      overflowX: 'hidden',
      maxWidth: '100vw',
      // Cùng nền sáng với trang chủ — nền navy cũ (#07111F) làm màn chờ và vùng
      // cuộn quá đà nháy tối trước khi trang chủ sáng hiện ra.
      bgcolor: 'background.default',
    }}>
      <Header />
      <Box aria-hidden="true" sx={{ height: HEADER_HEIGHT, flexShrink: 0 }} />
      <Box sx={{ display: 'flex', flexGrow: 1, minWidth: 0, alignItems: 'stretch' }}>
        {isWorkspace && (
          <WorkspaceSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((current) => !current)}
          />
        )}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            position: 'relative',
            // Từ 900 px thanh điều hướng luôn hiện (900–1199 px ở dạng icon), nên nội
            // dung chừa lề tương ứng; dưới 900 px dùng ngăn kéo menu của Header.
            ml: isWorkspace
              ? {
                xs: 0,
                md: `${WORKSPACE_SIDEBAR_WIDTH.compact}px`,
                lg: `${sidebarCollapsed ? WORKSPACE_SIDEBAR_WIDTH.compact : WORKSPACE_SIDEBAR_WIDTH.expanded}px`,
              }
              : 0,
            transition: 'margin-left 220ms ease',
          }}
        >
          <Outlet />
        </Box>
      </Box>
      {showFooter && <Footer />}
      {!isWorkspace && (
        <Suspense fallback={null}>
          <ChatbotWidget />
        </Suspense>
      )}
    </Box>
  );
};

export default MainLayout;
