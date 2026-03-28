import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import Header from './Header';
import Footer from './Footer';
import ChatbotWidget from '../components/ChatbotWidget';

const HIDE_FOOTER_ROUTES = ['/map'];

const MainLayout: React.FC = () => {
  const { pathname } = useLocation();
  const showFooter = !HIDE_FOOTER_ROUTES.includes(pathname);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <Box component="main" sx={{ flexGrow: 1 }}>
        <Outlet />
      </Box>
      {showFooter && <Footer />}
      <ChatbotWidget />
    </Box>
  );
};

export default MainLayout;
