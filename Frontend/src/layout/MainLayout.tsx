import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import Header from './Header';
import Footer from './Footer';
import WorkspaceSidebar from './WorkspaceSidebar';
const ChatbotWidget = lazy(() => import('../components/ChatbotWidget'));

const MainLayout: React.FC = () => {
  const { pathname } = useLocation();
  const isWorkspace = pathname.startsWith('/admin') || pathname.startsWith('/staff');
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
      bgcolor: pathname === '/' ? '#07111F' : 'background.default',
    }}>
      <Header />
      <Box aria-hidden="true" sx={{ height: 64, flexShrink: 0 }} />
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
            ml: isWorkspace
              ? { xs: 0, lg: sidebarCollapsed ? '76px' : '236px' }
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
