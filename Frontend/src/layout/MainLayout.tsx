import React, { lazy, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import Header from './Header';
import Footer from './Footer';
const ChatbotWidget = lazy(() => import('../components/ChatbotWidget'));

const HIDE_FOOTER_ROUTES = ['/map'];

const MainLayout: React.FC = () => {
  const { pathname } = useLocation();
  const showFooter = !HIDE_FOOTER_ROUTES.includes(pathname);

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      overflowX: 'hidden',
      maxWidth: '100vw',
      bgcolor: 'background.default',
      backgroundImage: pathname === '/map'
        ? 'none'
        : `
          radial-gradient(circle at 8% 5%, rgba(14,165,233,0.10), transparent 30rem),
          radial-gradient(circle at 92% 18%, rgba(16,185,129,0.07), transparent 26rem)
        `,
      backgroundAttachment: 'fixed',
    }}>
      <Header />
      <Box component="main" sx={{ flexGrow: 1, position: 'relative' }}>
        <Outlet />
      </Box>
      {showFooter && <Footer />}
      <Suspense fallback={null}>
        <ChatbotWidget />
      </Suspense>
    </Box>
  );
};

export default MainLayout;
