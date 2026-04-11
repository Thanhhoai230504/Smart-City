import React, { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { logoutThunk } from '../store/slices/authSlice';
import {
  AppBar, Toolbar, Typography, Button, Box, IconButton, Drawer,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Avatar, Menu, MenuItem, Divider, useMediaQuery, useTheme, Badge,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Menu as MenuIcon, Map as MapIcon, ReportProblem, Home, ListAlt,
  Login, PersonAdd, Person, Logout, Add, NotificationsActive, Dashboard,
  BarChart as BarChartIcon,
} from '@mui/icons-material';

import NotificationCenter from '../components/NotificationCenter';

const NAV_ITEMS = [
  { label: 'Trang chủ', path: '/', icon: <Home /> },
  { label: 'Bản đồ', path: '/map', icon: <MapIcon /> },
  { label: 'Sự cố', path: '/issues', icon: <ReportProblem /> },
  { label: 'Thống kê', path: '/statistics', icon: <BarChartIcon /> },
];

const Header: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogout = async () => {
    setLogoutOpen(false);
    setAnchorEl(null);
    await dispatch(logoutThunk());
    navigate('/');
  };

  return (
    <>
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ maxWidth: 1400, width: '100%', mx: 'auto', px: { xs: 1, md: 3 } }}>
          {isMobile && (
            <IconButton color="inherit" onClick={() => setDrawerOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}

          <Box component={RouterLink} to="/" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit', gap: 1.5 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '10px',
              background: 'linear-gradient(135deg, #6C63FF, #00D9A6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem', fontWeight: 800,
            }}>🏙️</Box>
            <Typography variant="h6" sx={{ fontWeight: 700, display: { xs: 'none', sm: 'block' }, background: 'linear-gradient(135deg, #6C63FF, #00D9A6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Smart City Đà Nẵng
            </Typography>
          </Box>

          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 0.5, ml: 4 }}>
              {NAV_ITEMS.map((item) => (
                <Button
                  key={item.path}
                  component={RouterLink}
                  to={item.path}
                  startIcon={item.icon}
                  sx={{
                    color: location.pathname === item.path ? 'primary.main' : 'text.secondary',
                    fontWeight: location.pathname === item.path ? 600 : 400,
                    '&:hover': { color: 'primary.light', bgcolor: 'rgba(108,99,255,0.08)' },
                  }}
                >
                  {item.label}
                </Button>
              ))}
              {user?.role === 'admin' && (
                <Button
                  component={RouterLink}
                  to="/admin"
                  startIcon={<Dashboard />}
                  sx={{
                    color: location.pathname === '/admin' ? 'primary.main' : 'text.secondary',
                    fontWeight: location.pathname === '/admin' ? 600 : 400,
                    '&:hover': { color: 'primary.light', bgcolor: 'rgba(108,99,255,0.08)' },
                  }}
                >
                  Dashboard
                </Button>
              )}
            </Box>
          )}

          <Box sx={{ flexGrow: 1 }} />

          {isAuthenticated ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button variant="contained" size="small" startIcon={<Add />} onClick={() => navigate('/report')}
                sx={{ display: { xs: 'none', sm: 'flex' }, borderRadius: '20px' }}>
                Báo cáo
              </Button>
              <NotificationCenter />
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
                <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: '0.9rem', fontWeight: 700 }}>
                  {user?.name?.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
              <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}
                PaperProps={{ sx: { mt: 1.5, minWidth: 200, bgcolor: 'background.paper', border: '1px solid rgba(255,255,255,0.08)' } }}>
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography fontWeight={600}>{user?.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
                </Box>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }}><ListItemIcon><Person fontSize="small" /></ListItemIcon>Hồ sơ</MenuItem>
                <MenuItem onClick={() => { setAnchorEl(null); navigate('/my-issues'); }}><ListItemIcon><ListAlt fontSize="small" /></ListItemIcon>Sự cố của tôi</MenuItem>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                <MenuItem onClick={() => { setAnchorEl(null); setLogoutOpen(true); }} sx={{ color: 'error.main' }}><ListItemIcon><Logout fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>Đăng xuất</MenuItem>
              </Menu>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button component={RouterLink} to="/login" startIcon={<Login />} sx={{ color: 'text.secondary' }}>Đăng nhập</Button>
              <Button component={RouterLink} to="/register" variant="contained" size="small" startIcon={<PersonAdd />}>Đăng ký</Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 280, bgcolor: 'background.paper' } }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ background: 'linear-gradient(135deg, #6C63FF, #00D9A6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🏙️ Smart City Đà Nẵng
          </Typography>
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
        <List>
          {NAV_ITEMS.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton onClick={() => { setDrawerOpen(false); navigate(item.path); }}
                selected={location.pathname === item.path}>
                <ListItemIcon sx={{ color: location.pathname === item.path ? 'primary.main' : 'text.secondary' }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
          {isAuthenticated && (
            <ListItem disablePadding>
              <ListItemButton onClick={() => { setDrawerOpen(false); navigate('/report'); }}>
                <ListItemIcon><Add /></ListItemIcon>
                <ListItemText primary="Báo cáo sự cố" />
              </ListItemButton>
            </ListItem>
          )}
          {user?.role === 'admin' && (
            <ListItem disablePadding>
              <ListItemButton onClick={() => { setDrawerOpen(false); navigate('/admin'); }}
                selected={location.pathname === '/admin'}>
                <ListItemIcon sx={{ color: location.pathname === '/admin' ? 'primary.main' : 'text.secondary' }}><Dashboard /></ListItemIcon>
                <ListItemText primary="Dashboard" />
              </ListItemButton>
            </ListItem>
          )}
        </List>
      </Drawer>

      {/* Logout confirmation dialog */}
      <Dialog open={logoutOpen} onClose={() => setLogoutOpen(false)}
        PaperProps={{ sx: { bgcolor: '#1F2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', minWidth: 320 } }}>
        <DialogTitle sx={{ pb: 1 }}>⚠️ Xác nhận đăng xuất</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLogoutOpen(false)} sx={{ color: 'text.secondary' }}>Hủy</Button>
          <Button onClick={handleLogout} variant="contained" color="error">Đăng xuất</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Header;
