import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../api/notificationApi';
import { useSocket } from '../hooks/useSocket';
import {
  IconButton, Badge, Popover, Box, Typography, Stack, Divider,
  Button, Chip, List, ListItemButton, ListItemText, ListItemIcon,
} from '@mui/material';
import {
  Notifications, NotificationsNone, DoneAll, Circle,
  BugReport, CheckCircle, Comment, Update,
} from '@mui/icons-material';
import { Notification } from '../types';

const typeIcons: Record<string, React.ReactNode> = {
  issue_created: <BugReport sx={{ color: '#EF4444', fontSize: 18 }} />,
  issue_updated: <Update sx={{ color: '#F59E0B', fontSize: 18 }} />,
  issue_resolved: <CheckCircle sx={{ color: '#10B981', fontSize: 18 }} />,
  issue_rejected: <Circle sx={{ color: '#6B7280', fontSize: 18 }} />,
  comment: <Comment sx={{ color: '#3B82F6', fontSize: 18 }} />,
};

const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((s: RootState) => s.auth);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const { data } = await notificationApi.getNotifications({ limit: 20 });
      setNotifications(data.data.notifications);
      setUnreadCount(data.data.unreadCount);
    } catch { /* ignore */ }
  }, [isAuthenticated]);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const { data } = await notificationApi.getUnreadCount();
      setUnreadCount(data.data.count);
    } catch { /* ignore */ }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, fetchUnreadCount]);

  useSocket((event: string, data: any) => {
    if (event === 'notification:new') {
      setNotifications((prev) => [data, ...prev].slice(0, 20));
      setUnreadCount((prev) => prev + 1);
    }
  });

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  const handleClick = (notif: Notification) => {
    if (!notif.isRead) handleMarkAsRead(notif._id);
    if (notif.issueId) {
      setAnchorEl(null);
      navigate(`/issues/${notif.issueId}`);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    return `${Math.floor(hours / 24)} ngày trước`;
  };

  if (!isAuthenticated) return null;

  return (
    <>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ color: 'text.secondary' }}>
        <Badge badgeContent={unreadCount} color="error" max={99}
          sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 18, height: 18 } }}>
          {unreadCount > 0 ? <Notifications /> : <NotificationsNone />}
        </Badge>
      </IconButton>

      <Popover
        anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: { xs: 'calc(100vw - 32px)', sm: 380 }, maxHeight: 480, mt: 1,
            bgcolor: 'background.paper', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', overflow: 'hidden',
          },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, pb: 1 }}>
          <Typography fontWeight={700}>🔔 Thông báo</Typography>
          {unreadCount > 0 && (
            <Button size="small" startIcon={<DoneAll sx={{ fontSize: 14 }} />} onClick={handleMarkAllAsRead}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
              Đọc tất cả
            </Button>
          )}
        </Stack>

        {unreadCount > 0 && (
          <Chip label={`${unreadCount} chưa đọc`} size="small"
            sx={{ mx: 2, mb: 1, bgcolor: 'rgba(239,68,68,0.1)', color: 'error.main', fontSize: '0.7rem' }} />
        )}

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

        <Box sx={{ maxHeight: 380, overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <NotificationsNone sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">Chưa có thông báo</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {notifications.map((notif) => (
                <ListItemButton key={notif._id} onClick={() => handleClick(notif)}
                  sx={{
                    py: 1.5, px: 2,
                    bgcolor: notif.isRead ? 'transparent' : 'rgba(108,99,255,0.04)',
                    borderLeft: notif.isRead ? 'none' : '3px solid',
                    borderColor: 'primary.main',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                  }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {typeIcons[notif.type] || <Notifications sx={{ fontSize: 18 }} />}
                  </ListItemIcon>
                  <ListItemText
                    primary={<Typography variant="body2" fontWeight={notif.isRead ? 400 : 600} sx={{ fontSize: '0.85rem' }}>{notif.title}</Typography>}
                    secondary={
                      <Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>{notif.message}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, fontSize: '0.7rem' }}>{timeAgo(notif.createdAt)}</Typography>
                      </Stack>
                    }
                  />
                  {!notif.isRead && <Circle sx={{ fontSize: 8, color: 'primary.main', ml: 1 }} />}
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
};

export default NotificationCenter;
