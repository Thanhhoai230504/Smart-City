import React from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  AssignmentTurnedIn,
  CorporateFare,
  DashboardOutlined,
  History,
  HomeOutlined,
  Insights,
  MapOutlined,
  ReportProblemOutlined,
  VideocamOutlined,
} from '@mui/icons-material';
import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
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
  { label: 'Đơn vị xử lý', path: '/admin?tab=departments', tab: 'departments', icon: <CorporateFare /> },
  { label: 'Phân công', path: '/admin?tab=assignments', tab: 'assignments', icon: <AssignmentTurnedIn /> },
  { label: 'Hiệu suất', path: '/admin?tab=performance', tab: 'performance', icon: <Insights /> },
  { label: 'Camera', path: '/admin?tab=cameras', tab: 'cameras', icon: <VideocamOutlined /> },
  { label: 'Nhật ký hoạt động', path: '/admin?tab=audit', tab: 'audit', icon: <History /> },
];

const staffItems: WorkspaceItem[] = [
  { label: 'Công việc của đơn vị', path: '/staff', icon: <AssignmentTurnedIn /> },
  { label: 'Bản đồ đô thị', path: '/map', icon: <MapOutlined /> },
  { label: 'Danh sách sự cố', path: '/issues', icon: <ReportProblemOutlined /> },
];

const WorkspaceSidebar: React.FC = () => {
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
        width: 236,
        position: 'fixed',
        top: 64,
        bottom: 0,
        left: 0,
        zIndex: 1050,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        bgcolor: '#0B2942',
        color: '#FFFFFF',
        borderRight: '1px solid #173D59',
      }}
    >
      <Box sx={{ px: 2.5, pt: 3, pb: 2.25 }}>
        <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.54)', fontSize: '0.67rem' }}>
          {isAdmin ? 'Trung tâm điều hành' : 'Đơn vị xử lý'}
        </Typography>
        <Typography fontWeight={700} sx={{ mt: 0.4, lineHeight: 1.35 }}>
          {isAdmin ? 'Quản trị thành phố' : user?.departmentId && typeof user.departmentId !== 'string'
            ? user.departmentId.name
            : 'Cổng công việc cán bộ'}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

      <List component="nav" aria-label="Điều hướng không gian làm việc" sx={{ px: 1.25, py: 2 }}>
        {items.map((item) => {
          const selected = item.tab
            ? isAdmin && activeTab === item.tab
            : pathname === item.path;

          return (
            <ListItemButton
              key={item.path}
              component={RouterLink}
              to={item.path}
              selected={selected}
              sx={{
                minHeight: 44,
                mb: 0.5,
                px: 1.5,
                borderRadius: 1,
                color: selected ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
                '& .MuiListItemIcon-root': {
                  minWidth: 36,
                  color: selected ? '#8FC5DE' : 'rgba(255,255,255,0.54)',
                },
                '&.Mui-selected': {
                  bgcolor: 'rgba(255,255,255,0.11)',
                  borderLeft: '3px solid #74B7D5',
                  pl: '9px',
                },
                '&.Mui-selected:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#FFFFFF' },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 700 : 550 }} />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ mt: 'auto', p: 1.5 }}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mb: 1.5 }} />
        <ListItemButton
          component={RouterLink}
          to="/"
          sx={{ borderRadius: 1, color: 'rgba(255,255,255,0.68)', px: 1.5 }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: 'rgba(255,255,255,0.54)' }}>
            <HomeOutlined />
          </ListItemIcon>
          <ListItemText primary="Về trang công khai" primaryTypographyProps={{ fontSize: 14 }} />
        </ListItemButton>
        <Stack direction="row" alignItems="center" spacing={1.2} sx={{ px: 1.5, pt: 2, pb: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#63B38D' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            Hệ thống đang hoạt động
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
};

export default WorkspaceSidebar;
