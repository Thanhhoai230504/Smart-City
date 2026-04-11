import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { userApi } from '../../api/userApi';
import {
  Typography, Chip, Stack, Avatar, Select, MenuItem, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Skeleton, Pagination, FormControl, InputLabel, SelectChangeEvent,
  Snackbar, Alert,
} from '@mui/material';
import { AdminPanelSettings, PersonOff, PersonOutline, BugReport, EmojiEvents } from '@mui/icons-material';
import { GlassCard, UserItem, cellSx, headCellSx } from './types';

interface Props {
  onDataChange: () => void;
}

const UserManagement: React.FC<Props> = ({ onDataChange }) => {
  const { user: currentUser } = useSelector((s: RootState) => s.auth);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [pag, setPag] = useState({ current: 1, pages: 1, total: 0 });
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });

  const loadUsers = useCallback(async (page = 1, role = '') => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 8 };
      if (role) params.role = role;
      const { data } = await userApi.getUsers(params);
      setUsers(data.data.users);
      setPag(data.data.pagination);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(1, filter); }, [filter, loadUsers]);

  const handleRoleChange = async (id: string, role: string) => {
    try {
      await userApi.updateRole(id, role);
      setSnack({ open: true, msg: `Đã đổi vai trò → ${role === 'admin' ? 'Admin' : 'User'}`, severity: 'success' });
      loadUsers(pag.current, filter);
      onDataChange();
    } catch { setSnack({ open: true, msg: 'Không thể đổi vai trò', severity: 'error' }); }
  };

  const handleToggleActive = async (id: string) => {
    try {
      await userApi.toggleActive(id);
      setSnack({ open: true, msg: 'Đã thay đổi trạng thái tài khoản', severity: 'success' });
      loadUsers(pag.current, filter);
    } catch { setSnack({ open: true, msg: 'Thất bại', severity: 'error' }); }
  };

  return (
    <GlassCard>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <Typography fontWeight={600} variant="h6">👥 Quản lý người dùng</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel sx={{ color: 'text.secondary' }}>Vai trò</InputLabel>
            <Select value={filter} label="Vai trò" onChange={(e: SelectChangeEvent) => setFilter(e.target.value)}
              sx={{ borderRadius: '10px', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}>
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="admin">👑 Admin</MenuItem>
              <MenuItem value="user">👤 User</MenuItem>
            </Select>
          </FormControl>
          <Chip label={`${pag.total} người dùng`} sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#6EE7B7', fontWeight: 600 }} />
        </Stack>
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead><TableRow>
            {['Tên', 'Email', 'Vai trò', 'Trạng thái', 'Báo cáo', 'Huy hiệu', 'Ngày tạo', 'Thao tác'].map(h => (
              <TableCell key={h} sx={headCellSx}>{h}</TableCell>
            ))}
          </TableRow></TableHead>
          <TableBody>
            {loading ? [...Array(4)].map((_, i) => (
              <TableRow key={i}>{[...Array(8)].map((_, j) => <TableCell key={j} sx={cellSx}><Skeleton sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} /></TableCell>)}</TableRow>
            )) : users.map(u => (
              <TableRow key={u._id} hover sx={{ '&:hover': { bgcolor: 'rgba(108,99,255,0.04)' }, opacity: u.isActive ? 1 : 0.5 }}>
                <TableCell sx={cellSx}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Avatar sx={{ width: 30, height: 30, bgcolor: u.role === 'admin' ? '#6C63FF' : '#3B82F6', fontSize: '0.75rem' }}>
                      {u.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography variant="body2" fontWeight={500}>{u.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={cellSx}><Typography variant="caption">{u.email}</Typography></TableCell>
                <TableCell sx={cellSx}>
                  {u._id === currentUser?._id || u._id === (currentUser as any)?.id ? (
                    <Chip size="small" icon={<AdminPanelSettings sx={{ fontSize: 14 }} />} label={u.role === 'admin' ? 'Admin' : 'User'}
                      sx={{ height: 24, fontSize: '0.7rem', bgcolor: 'rgba(108,99,255,0.2)', color: '#A5B4FC' }} />
                  ) : (
                    <Select size="small" value={u.role} onChange={(e: SelectChangeEvent) => handleRoleChange(u._id, e.target.value)}
                      sx={{
                        height: 28, fontSize: '0.75rem', borderRadius: '8px',
                        bgcolor: u.role === 'admin' ? 'rgba(108,99,255,0.15)' : 'rgba(59,130,246,0.15)',
                        color: u.role === 'admin' ? '#A5B4FC' : '#93C5FD',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                        '& .MuiSvgIcon-root': { color: u.role === 'admin' ? '#A5B4FC' : '#93C5FD' },
                      }}>
                      <MenuItem value="user">👤 User</MenuItem>
                      <MenuItem value="admin">👑 Admin</MenuItem>
                    </Select>
                  )}
                </TableCell>
                <TableCell sx={cellSx}>
                  <Chip size="small" label={u.isActive ? 'Hoạt động' : 'Bị khoá'}
                    sx={{ height: 22, fontSize: '0.7rem', bgcolor: u.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: u.isActive ? '#10B981' : '#EF4444' }} />
                </TableCell>
                <TableCell sx={cellSx}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <BugReport sx={{ fontSize: 14, color: '#F59E0B' }} />
                    <Typography variant="body2" fontWeight={600}>{u.issueCount || 0}</Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={cellSx}>
                  {u.topBadge ? (
                    <Tooltip title={`${u.topBadge.label} (≥ ${u.topBadge.threshold} báo cáo)`}>
                      <Chip size="small"
                        icon={<span style={{ fontSize: 14 }}>{u.topBadge.icon}</span>}
                        label={u.topBadge.label}
                        sx={{ height: 24, fontSize: '0.7rem', fontWeight: 600, bgcolor: 'rgba(245,158,11,0.12)', color: '#FBBF24' }}
                      />
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="text.secondary">—</Typography>
                  )}
                </TableCell>
                <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                  <Typography variant="caption" color="text.secondary">{new Date(u.createdAt).toLocaleDateString('vi-VN')}</Typography>
                </TableCell>
                <TableCell sx={cellSx}>
                  {u._id !== currentUser?._id && u._id !== (currentUser as any)?.id && (
                    <Tooltip title={u.isActive ? 'Khoá tài khoản' : 'Mở khoá'}>
                      <IconButton size="small" onClick={() => handleToggleActive(u._id)}
                        sx={{ color: u.isActive ? '#EF4444' : '#10B981' }}>
                        {u.isActive ? <PersonOff fontSize="small" /> : <PersonOutline fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {pag.pages > 1 && (
        <Stack alignItems="center" mt={2}>
          <Pagination count={pag.pages} page={pag.current} onChange={(_, p) => loadUsers(p, filter)}
            sx={{ '& .MuiPaginationItem-root': { color: 'text.secondary' } }} />
        </Stack>
      )}

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </GlassCard>
  );
};

export default UserManagement;
