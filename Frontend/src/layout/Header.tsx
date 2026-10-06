import React, { lazy, Suspense, useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { logoutThunk } from '../store/slices/authSlice';
import {
  AppBar, Toolbar, Typography, Button, Box, IconButton, Drawer,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText, ListSubheader,
  Avatar, Menu, MenuItem, Divider, useMediaQuery, useScrollTrigger, useTheme,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Menu as MenuIcon, Map as MapIcon, ReportProblem, Home, ListAlt,
  Login, PersonAdd, Person, Logout, Add, Dashboard, Close,
  BarChart as BarChartIcon, AssignmentInd, Videocam,
} from '@mui/icons-material';
import { UserRole } from '../types';
import { FONT_MONO } from '../pages/Home/homeStyle';
import { ADMIN_WORKSPACE_ITEMS, STAFF_WORKSPACE_ITEMS, isWorkspaceItemActive } from './workspaceNav';
import { CHROME, FOCUS_ON_DARK, HEADER_HEIGHT } from './chrome';
import BrandMark from './BrandMark';

const NotificationCenter = lazy(() => import('../components/NotificationCenter'));

const NAV_ITEMS = [
  { label: 'Trang chủ', path: '/', icon: <Home /> },
  { label: 'Bản đồ', path: '/map', icon: <MapIcon /> },
  { label: 'Sự cố', path: '/issues', icon: <ReportProblem /> },
  { label: 'Thống kê', path: '/statistics', icon: <BarChartIcon /> },
  { label: 'Camera', path: '/cameras', icon: <Videocam /> },
];

const ROLE_NAV_ITEMS: Array<{
  label: string;
  path: string;
  icon: React.ReactElement;
  roles: UserRole[];
}> = [
  { label: 'Cán bộ', path: '/staff', icon: <AssignmentInd />, roles: ['staff'] },
  { label: 'Dashboard', path: '/admin', icon: <Dashboard />, roles: ['admin'] },
];

/** "Sự cố" vẫn sáng khi đang xem /issues/:id, "Dashboard" khi ở /admin/users… */
const isNavActive = (path: string, pathname: string) => (
  path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)
);

/** Một mục trong nhóm điều hướng dạng viên thuốc ở giữa thanh (màn ≥ 900 px). */
const NavLink: React.FC<{ label: string; path: string; active: boolean; icon?: React.ReactElement }> = ({
  label, path, active, icon,
}) => (
  <Box
    component={RouterLink}
    to={path}
    aria-current={active ? 'page' : undefined}
    sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.75,
      height: 36, px: { md: 1.4, lg: 1.9 }, borderRadius: 999,
      fontSize: 14, fontWeight: active ? 650 : 550, whiteSpace: 'nowrap', textDecoration: 'none',
      color: active ? CHROME.text : CHROME.body,
      bgcolor: active ? 'rgba(255,255,255,.14)' : 'transparent',
      boxShadow: active ? 'inset 0 0 0 1px rgba(255,255,255,.1)' : 'none',
      transition: 'background-color 180ms ease, color 180ms ease',
      '&:hover': { color: CHROME.text, bgcolor: active ? 'rgba(255,255,255,.18)' : CHROME.hover },
      '& svg': { fontSize: 18, color: active ? CHROME.cyan : CHROME.soft },
    }}
  >
    {icon}
    {label}
  </Box>
);

const drawerItemSx = {
  position: 'relative', mx: 1.25, my: 0.25, minHeight: 46, borderRadius: '10px',
  color: CHROME.body,
  '&:hover': { bgcolor: CHROME.hover },
  '& .MuiListItemIcon-root': { minWidth: 40, color: CHROME.muted },
  '& .MuiListItemText-primary': { fontSize: 15, fontWeight: 550 },
  '&.Mui-selected': {
    color: CHROME.text, bgcolor: 'rgba(255,255,255,.12)',
    '&:hover': { bgcolor: 'rgba(255,255,255,.16)' },
    '& .MuiListItemIcon-root': { color: CHROME.cyan },
    '& .MuiListItemText-primary': { fontWeight: 700 },
    '&::before': {
      content: '""', position: 'absolute', left: 0, top: 11, bottom: 11, width: 3, borderRadius: 3,
      background: `linear-gradient(180deg, ${CHROME.cyan}, ${CHROME.mint})`,
    },
  },
} as const;

const Header: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);
  // Trang chủ: thanh trong suốt nằm trên video cho tới khi bắt đầu cuộn, rồi thành kính
  // mờ xanh biển như ở các trang khác.
  const scrolled = useScrollTrigger({ disableHysteresis: true, threshold: 8 });
  const overHero = location.pathname === '/' && !scrolled;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const roleNavItems = user
    ? ROLE_NAV_ITEMS.filter((item) => item.roles.includes(user.role))
    : [];
  // Ngăn kéo menu (< 900 px) là lối điều hướng DUY NHẤT trên điện thoại, nên phải có
  // đủ các trang làm việc như thanh bên — trước đây quản trị viên chỉ thấy 3 trang lẻ
  // (thiếu các tab của bảng điều hành), cán bộ chỉ thấy một mục "Cán bộ".
  const publicPaths = new Set(NAV_ITEMS.map((item) => item.path));
  const workspaceItems = user?.role === 'admin'
    ? ADMIN_WORKSPACE_ITEMS
    : user?.role === 'staff'
      ? STAFF_WORKSPACE_ITEMS.filter((item) => !publicPaths.has(item.path))
      : [];

  const handleLogout = async () => {
    setLogoutOpen(false);
    setAnchorEl(null);
    await dispatch(logoutThunk());
    navigate('/');
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          color: CHROME.text,
          bgcolor: overHero ? 'transparent' : CHROME.glass,
          backgroundImage: 'none',
          borderBottom: '1px solid',
          borderColor: overHero ? 'transparent' : CHROME.line,
          boxShadow: overHero ? 'none' : '0 14px 34px -20px rgba(3,18,28,.8)',
          backdropFilter: overHero ? 'none' : 'saturate(160%) blur(14px)',
          transition: 'background-color 280ms ease, border-color 280ms ease, box-shadow 280ms ease',
          '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))': {
            bgcolor: overHero ? 'transparent' : CHROME.navy,
          },
          // Lớp che mờ dần từ mép trên khi nằm trên video: chữ vẫn ≥ 4,9:1 ngay cả khi
          // khung hình sáng nhất (mây trắng) chạy qua phía sau nút bên phải.
          '&::before': {
            content: '""', position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(180deg, rgba(6,30,46,.72) 0%, rgba(6,30,46,.38) 70%, rgba(6,30,46,0) 100%)',
            opacity: overHero ? 1 : 0,
            transition: 'opacity 280ms ease',
          },
          ...FOCUS_ON_DARK,
        }}
      >
        <Toolbar
          disableGutters
          sx={{
            position: 'relative',
            height: HEADER_HEIGHT,
            px: { xs: 1.5, sm: 2, lg: 3 },
            gap: { xs: 1, md: 2 },
          }}
        >
          {/* Hai bên cùng co giãn đều nên nhóm điều hướng luôn nằm giữa thanh. */}
          <Box sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {isMobile && (
              <IconButton
                aria-label="Mở menu điều hướng"
                color="inherit"
                onClick={() => setDrawerOpen(true)}
                sx={{ ml: -0.75, '&:hover': { bgcolor: CHROME.hover } }}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Box
              component={RouterLink}
              to="/"
              aria-label="Smart City Đà Nẵng — về trang chủ"
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0,
                color: 'inherit', textDecoration: 'none', borderRadius: '12px',
              }}
            >
              {/* 900–1199 px chỉ còn logo để đủ chỗ cho nhóm điều hướng. */}
              <BrandMark textDisplay={{ xs: 'none', sm: 'block', md: 'none', lg: 'block' }} />
            </Box>
          </Box>

          {!isMobile && (
            <Box
              component="nav"
              aria-label="Điều hướng chính"
              sx={{
                flex: 'none', display: 'flex', alignItems: 'center', gap: 0.5, p: 0.5,
                borderRadius: 999, border: `1px solid ${CHROME.line}`,
                bgcolor: overHero ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.04)',
                backdropFilter: overHero ? 'blur(10px)' : 'none',
                transition: 'background-color 280ms ease',
              }}
            >
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.path} label={item.label} path={item.path} active={isNavActive(item.path, location.pathname)} />
              ))}
              {roleNavItems.length > 0 && (
                <Box aria-hidden="true" sx={{ width: '1px', height: 20, mx: 0.5, bgcolor: 'rgba(255,255,255,.16)' }} />
              )}
              {roleNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  label={item.label}
                  path={item.path}
                  icon={item.icon}
                  active={isNavActive(item.path, location.pathname)}
                />
              ))}
            </Box>
          )}

          <Box sx={{
            flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: { xs: 0.5, sm: 1 },
          }}>
            {isAuthenticated ? (
              <>
                <Button
                  startIcon={<Add />}
                  onClick={() => navigate('/report')}
                  sx={{
                    display: { xs: 'none', sm: 'inline-flex' }, flexShrink: 0,
                    height: 38, px: 2, borderRadius: 999, fontSize: 14, fontWeight: 700,
                    color: '#FFFFFF', bgcolor: CHROME.accent,
                    boxShadow: '0 10px 22px -12px rgba(194,65,12,.95)',
                    '&:hover': { bgcolor: CHROME.accentHover },
                  }}
                >
                  Báo cáo
                </Button>
                {/* Chuông thông báo dùng màu chữ của theme sáng — đổi sang tông nền tối ở đây. */}
                <Box sx={{
                  display: 'flex',
                  '& .MuiIconButton-root': { color: CHROME.body, '&:hover': { color: CHROME.text, bgcolor: CHROME.hover } },
                  '& .MuiBadge-badge': { boxShadow: `0 0 0 2px ${CHROME.navy}` },
                }}>
                  <Suspense fallback={null}>
                    <NotificationCenter />
                  </Suspense>
                </Box>
                <IconButton aria-label="Mở menu tài khoản" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
                  <Avatar sx={{
                    width: 36, height: 36, fontSize: '0.95rem', fontWeight: 800,
                    color: '#06263A', background: `linear-gradient(135deg, ${CHROME.cyan}, ${CHROME.mint})`,
                    boxShadow: '0 0 0 2px rgba(255,255,255,.16)',
                  }}>
                    {user?.name?.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
                <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}
                  PaperProps={{ sx: { mt: 1.5, minWidth: 220, borderRadius: '14px', bgcolor: 'background.paper', border: '1px solid #DCE7EB', boxShadow: '0 18px 40px rgba(8,40,60,.18)' } }}>
                  <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography fontWeight={600}>{user?.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
                  </Box>
                  <Divider sx={{ borderColor: '#E4ECEE' }} />
                  <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }}><ListItemIcon><Person fontSize="small" /></ListItemIcon>Hồ sơ</MenuItem>
                  <MenuItem onClick={() => { setAnchorEl(null); navigate('/my-issues'); }}><ListItemIcon><ListAlt fontSize="small" /></ListItemIcon>Sự cố của tôi</MenuItem>
                  <Divider sx={{ borderColor: '#E4ECEE' }} />
                  <MenuItem onClick={() => { setAnchorEl(null); setLogoutOpen(true); }} sx={{ color: 'error.main' }}><ListItemIcon><Logout fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>Đăng xuất</MenuItem>
                </Menu>
              </>
            ) : (
              <>
                {/* Mang theo trang đang xem: đăng nhập xong quay lại đúng chỗ (VD: đang đọc một sự cố). */}
                <Button
                  component={RouterLink}
                  to="/login"
                  state={{ from: location }}
                  startIcon={<Login />}
                  aria-label="Đăng nhập"
                  sx={{
                    flexShrink: 0, height: 38, minWidth: 'auto', px: { xs: 1, sm: 1.75 }, borderRadius: 999,
                    color: CHROME.body, whiteSpace: 'nowrap',
                    '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
                    '&:hover': { color: CHROME.text, bgcolor: CHROME.hover },
                  }}
                >
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Đăng nhập</Box>
                </Button>
                <Button
                  component={RouterLink}
                  to="/register"
                  startIcon={<PersonAdd />}
                  aria-label="Đăng ký"
                  sx={{
                    flexShrink: 0, height: 38, minWidth: 'auto', px: { xs: 1.25, sm: 2 }, borderRadius: 999,
                    fontWeight: 700, whiteSpace: 'nowrap',
                    color: CHROME.navy, bgcolor: '#FFFFFF',
                    boxShadow: '0 10px 22px -14px rgba(0,0,0,.6)',
                    '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
                    '&:hover': { bgcolor: '#E3F4F8' },
                  }}
                >
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Đăng ký</Box>
                </Button>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Ngăn kéo menu trên điện thoại — cùng nền tối với thanh trên. */}
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 300, maxWidth: '86vw', color: CHROME.text, bgcolor: CHROME.navy,
            backgroundImage: 'radial-gradient(120% 55% at 0% 0%, rgba(63,184,201,.16) 0%, rgba(63,184,201,0) 60%)',
            borderRight: `1px solid ${CHROME.line}`,
            ...FOCUS_ON_DARK,
          },
        }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.25, px: 2, height: HEADER_HEIGHT, flexShrink: 0,
          borderBottom: `1px solid ${CHROME.line}`,
        }}>
          <BrandMark size={36} />
          <IconButton
            aria-label="Đóng menu"
            onClick={() => setDrawerOpen(false)}
            sx={{ ml: 'auto', color: CHROME.soft, '&:hover': { color: CHROME.text, bgcolor: CHROME.hover } }}
          >
            <Close />
          </IconButton>
        </Box>
        {isAuthenticated && (
          <Box sx={{ px: 2, pt: 2 }}>
            <Button
              fullWidth
              startIcon={<Add />}
              onClick={() => { setDrawerOpen(false); navigate('/report'); }}
              sx={{
                height: 46, borderRadius: '12px', fontSize: 15, fontWeight: 700,
                color: '#FFFFFF', bgcolor: CHROME.accent,
                '&:hover': { bgcolor: CHROME.accentHover },
              }}
            >
              Báo cáo sự cố
            </Button>
          </Box>
        )}
        <List sx={{ py: 1.5 }}>
          {NAV_ITEMS.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                onClick={() => { setDrawerOpen(false); navigate(item.path); }}
                selected={isNavActive(item.path, location.pathname)}
                sx={drawerItemSx}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        {workspaceItems.length > 0 && (
          <>
            <Divider sx={{ mx: 2, borderColor: CHROME.line }} />
            <List
              aria-label={user?.role === 'admin' ? 'Trang quản trị' : 'Trang cán bộ'}
              sx={{ py: 1.5 }}
              subheader={(
                <ListSubheader disableSticky sx={{
                  bgcolor: 'transparent', color: CHROME.cyan, px: 2.5, lineHeight: '34px',
                  fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500, letterSpacing: '.14em', textTransform: 'uppercase',
                }}>
                  {user?.role === 'admin' ? 'Quản trị' : 'Cán bộ'}
                </ListSubheader>
              )}
            >
              {workspaceItems.map((item) => {
                const selected = isWorkspaceItemActive(item, location.pathname, location.search);
                const { Icon } = item;
                return (
                  <ListItem key={item.path} disablePadding>
                    <ListItemButton
                      onClick={() => { setDrawerOpen(false); navigate(item.path); }}
                      selected={selected}
                      sx={drawerItemSx}
                    >
                      <ListItemIcon>
                        <Icon />
                      </ListItemIcon>
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </>
        )}
      </Drawer>

      {/* Logout confirmation dialog */}
      <Dialog open={logoutOpen} onClose={() => setLogoutOpen(false)}
        PaperProps={{ sx: { bgcolor: '#FFFFFF', border: '1px solid #DCE7EB', borderRadius: '14px', minWidth: 320, boxShadow: '0 20px 50px rgba(32,71,83,.18)' } }}>
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
