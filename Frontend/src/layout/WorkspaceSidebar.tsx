import React from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  HomeOutlined,
} from '@mui/icons-material';
import {
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { RootState } from '../store/store';
import {
  ADMIN_WORKSPACE_ITEMS,
  STAFF_WORKSPACE_ITEMS,
  WORKSPACE_SIDEBAR_WIDTH,
  isWorkspaceItemActive,
} from './workspaceNav';

interface WorkspaceSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({ collapsed, onToggle }) => {
  const theme = useTheme();
  // 900–1199 px: menu hamburger của Header chỉ hiện dưới 900 px còn thanh này trước
  // đây chỉ hiện từ 1200 px — quản trị viên ở khoảng giữa (laptop 1366 px phóng to
  // 125%) không có lối nào tới Quản lý sự cố, Người dùng, Địa điểm. Giờ thanh hiện
  // từ 900 px nhưng luôn ở dạng icon vì chưa đủ chỗ cho bản 236 px.
  const forceCompact = useMediaQuery(theme.breakpoints.between('md', 'lg'), { noSsr: true });
  const compact = collapsed || forceCompact;
  const { pathname, search } = useLocation();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = pathname.startsWith('/admin');
  const items = isAdmin ? ADMIN_WORKSPACE_ITEMS : STAFF_WORKSPACE_ITEMS;

  return (
    <Box
      component="aside"
      sx={{
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        width: compact ? WORKSPACE_SIDEBAR_WIDTH.compact : WORKSPACE_SIDEBAR_WIDTH.expanded,
        position: 'fixed',
        top: 64,
        bottom: 0,
        left: 0,
        zIndex: 1050,
        overflow: 'hidden',
        overscrollBehavior: 'contain',
        bgcolor: '#0B2942',
        color: '#FFFFFF',
        borderRight: '1px solid #173D59',
        transition: 'width 220ms ease',
      }}
    >
      <Box
        sx={{
          minHeight: 82,
          px: compact ? 1.25 : 2.5,
          py: 1.75,
          display: 'flex',
          alignItems: 'center',
          justifyContent: compact ? 'center' : 'space-between',
          gap: 1,
          flexShrink: 0,
        }}
      >
        {!compact && (
          <Box minWidth={0}>
            <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.54)', fontSize: '0.67rem' }}>
              {isAdmin ? 'Trung tâm điều hành' : 'Đơn vị xử lý'}
            </Typography>
            <Typography fontWeight={700} noWrap sx={{ mt: 0.15, lineHeight: 1.35 }}>
              {isAdmin ? 'Quản trị thành phố' : user?.departmentId && typeof user.departmentId !== 'string'
                ? user.departmentId.name
                : 'Cổng công việc cán bộ'}
            </Typography>
          </Box>
        )}
        {/* Ở 900–1199 px thanh luôn thu gọn nên nút mở rộng không có tác dụng — ẩn đi. */}
        {!forceCompact && (
          <Tooltip title={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'} placement="right">
            <IconButton
              onClick={onToggle}
              aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
              size="small"
              sx={{
                flexShrink: 0,
                color: '#B9D7E6',
                border: '1px solid rgba(255,255,255,0.16)',
                bgcolor: 'rgba(255,255,255,0.05)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.12)', color: '#FFFFFF' },
              }}
            >
              {collapsed ? <ChevronRight /> : <ChevronLeft />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

      <List
        component="nav"
        aria-label="Điều hướng không gian làm việc"
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          px: compact ? 0.75 : 1.25,
          py: 1.25,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.2) transparent',
          '&::-webkit-scrollbar': { width: 5 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(255,255,255,0.2)',
            borderRadius: 10,
          },
        }}
      >
        {items.map((item) => {
          const selected = isWorkspaceItemActive(item, pathname, search);
          const { Icon } = item;

          const itemButton = (
            <ListItemButton
              key={item.path}
              component={RouterLink}
              to={item.path}
              selected={selected}
              sx={{
                minHeight: 44,
                mb: 0.25,
                px: compact ? 0 : 1.5,
                justifyContent: compact ? 'center' : 'flex-start',
                borderRadius: 1,
                color: selected ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
                '& .MuiListItemIcon-root': {
                  minWidth: compact ? 0 : 36,
                  justifyContent: 'center',
                  color: selected ? '#8FC5DE' : 'rgba(255,255,255,0.54)',
                },
                '&.Mui-selected': {
                  bgcolor: 'rgba(255,255,255,0.11)',
                  borderLeft: '3px solid #74B7D5',
                  pl: compact ? 0 : '9px',
                },
                '&.Mui-selected:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#FFFFFF' },
              }}
            >
              <ListItemIcon><Icon /></ListItemIcon>
              {!compact && (
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 700 : 550, noWrap: true }}
                />
              )}
            </ListItemButton>
          );

          return compact ? (
            <Tooltip key={item.path} title={item.label} placement="right" arrow>
              {itemButton}
            </Tooltip>
          ) : itemButton;
        })}
      </List>

      <Box sx={{ mt: 'auto', p: compact ? 0.75 : 1.25, flexShrink: 0 }}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mb: 1 }} />
        <Tooltip title={compact ? 'Về trang công khai' : ''} placement="right" arrow>
          <ListItemButton
            component={RouterLink}
            to="/"
            sx={{
              minHeight: 42,
              borderRadius: 1,
              color: 'rgba(255,255,255,0.68)',
              px: compact ? 0 : 1.5,
              justifyContent: compact ? 'center' : 'flex-start',
            }}
          >
            <ListItemIcon sx={{ minWidth: compact ? 0 : 36, justifyContent: 'center', color: 'rgba(255,255,255,0.54)' }}>
              <HomeOutlined />
            </ListItemIcon>
            {!compact && <ListItemText primary="Về trang công khai" primaryTypographyProps={{ fontSize: 14 }} />}
          </ListItemButton>
        </Tooltip>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent={compact ? 'center' : 'flex-start'}
          spacing={1.2}
          sx={{ px: compact ? 0 : 1.5, pt: 1.25, pb: 0.5 }}
        >
          <Tooltip title={compact ? 'Hệ thống đang hoạt động' : ''} placement="right">
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#63B38D', flexShrink: 0 }} />
          </Tooltip>
          {!compact && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Hệ thống đang hoạt động
            </Typography>
          )}
        </Stack>
      </Box>
    </Box>
  );
};

export default WorkspaceSidebar;
