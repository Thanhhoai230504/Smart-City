import React from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  AssignmentTurnedIn,
  ChevronLeft,
  ChevronRight,
  CorporateFare,
  DashboardOutlined,
  History,
  HomeOutlined,
  Insights,
  LocationOnOutlined,
  MapOutlined,
  PeopleAltOutlined,
  ReportProblemOutlined,
  VideocamOutlined,
  WorkOutline,
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
} from '@mui/material';
import { RootState } from '../store/store';

type WorkspaceItem = {
  label: string;
  path: string;
  icon: React.ReactElement;
  tab?: string;
};

const adminItems: WorkspaceItem[] = [
  { label: 'Tổng quan', path: '/admin?tab=overview', tab: 'overview', icon: <DashboardOutlined /> },
  { label: 'Quản lý sự cố', path: '/admin/issues', icon: <ReportProblemOutlined /> },
  { label: 'Đơn vị xử lý', path: '/admin?tab=departments', tab: 'departments', icon: <CorporateFare /> },
  { label: 'Người dùng & cán bộ', path: '/admin/users', icon: <PeopleAltOutlined /> },
  { label: 'Quản lý địa điểm', path: '/admin/places', icon: <LocationOnOutlined /> },
  { label: 'Phân công', path: '/admin?tab=assignments', tab: 'assignments', icon: <AssignmentTurnedIn /> },
  { label: 'Công việc đơn vị', path: '/admin?tab=work', tab: 'work', icon: <WorkOutline /> },
  { label: 'Hiệu suất', path: '/admin?tab=performance', tab: 'performance', icon: <Insights /> },
  { label: 'Camera', path: '/admin?tab=cameras', tab: 'cameras', icon: <VideocamOutlined /> },
  { label: 'Nhật ký hoạt động', path: '/admin?tab=audit', tab: 'audit', icon: <History /> },
];

const staffItems: WorkspaceItem[] = [
  { label: 'Công việc của đơn vị', path: '/staff', icon: <WorkOutline /> },
  { label: 'Bản đồ đô thị', path: '/map', icon: <MapOutlined /> },
  { label: 'Danh sách sự cố', path: '/issues', icon: <ReportProblemOutlined /> },
];

interface WorkspaceSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({ collapsed, onToggle }) => {
  const { pathname, search } = useLocation();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = pathname.startsWith('/admin');
  const activeTab = new URLSearchParams(search).get('tab') || 'overview';
  const items = isAdmin ? adminItems : staffItems;

  return (
    <Box
      component="aside"
      sx={{
        display: { xs: 'none', lg: 'flex' },
        flexDirection: 'column',
        width: collapsed ? 76 : 236,
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
          px: collapsed ? 1.25 : 2.5,
          py: 1.75,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 1,
          flexShrink: 0,
        }}
      >
        {!collapsed && (
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
          px: collapsed ? 0.75 : 1.25,
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
          const selected = item.tab
            ? pathname === '/admin' && activeTab === item.tab
            : pathname === item.path;

          const itemButton = (
            <ListItemButton
              key={item.path}
              component={RouterLink}
              to={item.path}
              selected={selected}
              sx={{
                minHeight: 44,
                mb: 0.25,
                px: collapsed ? 0 : 1.5,
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 1,
                color: selected ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
                '& .MuiListItemIcon-root': {
                  minWidth: collapsed ? 0 : 36,
                  justifyContent: 'center',
                  color: selected ? '#8FC5DE' : 'rgba(255,255,255,0.54)',
                },
                '&.Mui-selected': {
                  bgcolor: 'rgba(255,255,255,0.11)',
                  borderLeft: '3px solid #74B7D5',
                  pl: collapsed ? 0 : '9px',
                },
                '&.Mui-selected:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#FFFFFF' },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 700 : 550, noWrap: true }}
                />
              )}
            </ListItemButton>
          );

          return collapsed ? (
            <Tooltip key={item.path} title={item.label} placement="right" arrow>
              {itemButton}
            </Tooltip>
          ) : itemButton;
        })}
      </List>

      <Box sx={{ mt: 'auto', p: collapsed ? 0.75 : 1.25, flexShrink: 0 }}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mb: 1 }} />
        <Tooltip title={collapsed ? 'Về trang công khai' : ''} placement="right" arrow>
          <ListItemButton
            component={RouterLink}
            to="/"
            sx={{
              minHeight: 42,
              borderRadius: 1,
              color: 'rgba(255,255,255,0.68)',
              px: collapsed ? 0 : 1.5,
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, justifyContent: 'center', color: 'rgba(255,255,255,0.54)' }}>
              <HomeOutlined />
            </ListItemIcon>
            {!collapsed && <ListItemText primary="Về trang công khai" primaryTypographyProps={{ fontSize: 14 }} />}
          </ListItemButton>
        </Tooltip>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent={collapsed ? 'center' : 'flex-start'}
          spacing={1.2}
          sx={{ px: collapsed ? 0 : 1.5, pt: 1.25, pb: 0.5 }}
        >
          <Tooltip title={collapsed ? 'Hệ thống đang hoạt động' : ''} placement="right">
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#63B38D', flexShrink: 0 }} />
          </Tooltip>
          {!collapsed && (
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
