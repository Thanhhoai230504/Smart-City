import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import {
  AdminPanelSettings,
  BugReport,
  Engineering,
  PersonOff,
  PersonOutline,
  Refresh,
  Search,
} from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  SelectChangeEvent,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { RootState } from '../../store/store';
import { departmentApi } from '../../api/departmentApi';
import { ManagedUser, userApi } from '../../api/userApi';
import { Department, UserRole } from '../../types';

const PAGE_SIZE = 12;

const ROLE_LABELS: Record<UserRole, string> = {
  user: 'Người dân',
  staff: 'Cán bộ',
  admin: 'Quản trị viên',
};

const roleStyles: Record<UserRole, { background: string; color: string }> = {
  user: { background: '#EAF2F8', color: '#315F7A' },
  staff: { background: '#E3F1EB', color: '#286653' },
  admin: { background: '#E8EFF5', color: '#174A63' },
};

const getDepartmentId = (user: ManagedUser) => {
  if (!user.departmentId) return '';
  return typeof user.departmentId === 'string'
    ? user.departmentId
    : user.departmentId._id;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<{ message?: string }>(error)) return fallback;
  return error.response?.data?.message || fallback;
};

const UserManagementPage: React.FC = () => {
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [status, setStatus] = useState<boolean | ''>('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await userApi.getUsers({
        page,
        limit: PAGE_SIZE,
        role,
        isActive: status,
        departmentId: departmentId || undefined,
        search: search || undefined,
      });
      setUsers(data.data.users);
      setPagination({
        ...data.data.pagination,
        pages: Math.max(1, data.data.pagination.pages),
      });
    } catch (error) {
      setNotice({
        open: true,
        message: getErrorMessage(error, 'Không thể tải danh sách tài khoản.'),
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [departmentId, page, role, search, status]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    let active = true;
    departmentApi.getDepartments({ includeInactive: true })
      .then(({ data }) => {
        if (active) setDepartments(data.data.departments);
      })
      .catch((error) => {
        if (active) {
          setNotice({
            open: true,
            message: getErrorMessage(error, 'Không thể tải danh sách đơn vị.'),
            severity: 'error',
          });
        }
      })
      .finally(() => {
        if (active) setDepartmentsLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const handleRoleChange = async (user: ManagedUser, nextRole: 'user' | 'admin') => {
    setMutatingId(user._id);
    try {
      await userApi.updateRole(user._id, nextRole);
      setNotice({ open: true, message: `Đã chuyển tài khoản thành ${ROLE_LABELS[nextRole]}.`, severity: 'success' });
      await loadUsers();
    } catch (error) {
      setNotice({ open: true, message: getErrorMessage(error, 'Không thể cập nhật vai trò.'), severity: 'error' });
    } finally {
      setMutatingId('');
    }
  };

  const handleDepartmentChange = async (user: ManagedUser, nextDepartmentId: string) => {
    setMutatingId(user._id);
    try {
      await departmentApi.assignStaff(user._id, nextDepartmentId || null);
      setNotice({
        open: true,
        message: nextDepartmentId
          ? 'Đã gán tài khoản vào đơn vị và cấp vai trò cán bộ.'
          : 'Đã bỏ gán đơn vị và chuyển tài khoản về người dân.',
        severity: 'success',
      });
      await loadUsers();
    } catch (error) {
      setNotice({ open: true, message: getErrorMessage(error, 'Không thể cập nhật đơn vị.'), severity: 'error' });
    } finally {
      setMutatingId('');
    }
  };

  const handleToggleActive = async (user: ManagedUser) => {
    setMutatingId(user._id);
    try {
      await userApi.toggleActive(user._id);
      setNotice({
        open: true,
        message: user.isActive ? 'Đã khóa tài khoản.' : 'Đã kích hoạt tài khoản.',
        severity: 'success',
      });
      await loadUsers();
    } catch (error) {
      setNotice({ open: true, message: getErrorMessage(error, 'Không thể thay đổi trạng thái.'), severity: 'error' });
    } finally {
      setMutatingId('');
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setRole('');
    setStatus('');
    setDepartmentId('');
    setPage(1);
  };

  return (
    <Box sx={{ maxWidth: 1500, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        <Box component="header" sx={{ pb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" color="primary.main" fontWeight={700} mb={0.75}>
            Trung tâm điều hành
          </Typography>
          <Typography variant="h3" component="h1" mb={0.65}>Người dùng & cán bộ</Typography>
          <Typography color="text.secondary">
            Quản lý tài khoản, vai trò, trạng thái hoạt động và đơn vị công tác của cán bộ.
          </Typography>
        </Box>

        <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
          <Box sx={{ p: { xs: 2, md: 2.5 }, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', xl: 'row' }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="h6">Danh sách tài khoản</Typography>
                <Typography variant="body2" color="text.secondary">
                  Gán một người dùng vào đơn vị để cấp vai trò cán bộ và đưa họ vào danh sách phân công.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={`${pagination.total} tài khoản`} sx={{ bgcolor: '#EAF3F4', color: '#176B87', fontWeight: 700 }} />
                <Button variant="outlined" startIcon={<Refresh />} disabled={loading} onClick={loadUsers}>
                  Làm mới
                </Button>
              </Stack>
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'minmax(260px, 1.6fr) repeat(3, minmax(160px, .75fr)) auto' }, gap: 1.25, mt: 2.5 }}>
              <TextField
                size="small"
                label="Tìm theo tên hoặc email"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              />
              <FormControl size="small">
                <InputLabel id="user-role-filter">Vai trò</InputLabel>
                <Select labelId="user-role-filter" label="Vai trò" value={role} onChange={(event: SelectChangeEvent<UserRole | ''>) => { setRole(event.target.value as UserRole | ''); setPage(1); }}>
                  <MenuItem value="">Tất cả vai trò</MenuItem>
                  <MenuItem value="user">Người dân</MenuItem>
                  <MenuItem value="staff">Cán bộ</MenuItem>
                  <MenuItem value="admin">Quản trị viên</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small">
                <InputLabel id="user-status-filter">Trạng thái</InputLabel>
                <Select labelId="user-status-filter" label="Trạng thái" value={status === '' ? '' : String(status)} onChange={(event) => { const value = event.target.value; setStatus(value === '' ? '' : value === 'true'); setPage(1); }}>
                  <MenuItem value="">Tất cả trạng thái</MenuItem>
                  <MenuItem value="true">Đang hoạt động</MenuItem>
                  <MenuItem value="false">Đã khóa</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" disabled={departmentsLoading}>
                <InputLabel id="user-department-filter">Đơn vị</InputLabel>
                <Select labelId="user-department-filter" label="Đơn vị" value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setPage(1); }}>
                  <MenuItem value="">Tất cả đơn vị</MenuItem>
                  {departments.map((department) => (
                    <MenuItem key={department._id} value={department._id}>{department.code} — {department.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button onClick={resetFilters} sx={{ whiteSpace: 'nowrap' }}>Xóa lọc</Button>
            </Box>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Tài khoản', 'Vai trò', 'Đơn vị công tác', 'Trạng thái', 'Báo cáo', 'Ngày tham gia', 'Thao tác'].map((heading) => (
                    <TableCell key={heading} sx={{ color: 'text.secondary', fontWeight: 700, whiteSpace: 'nowrap', borderColor: 'divider' }}>{heading}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? [...Array(6)].map((_, row) => (
                  <TableRow key={row}>{[...Array(7)].map((__, cell) => <TableCell key={cell}><Skeleton height={cell === 0 ? 34 : 20} /></TableCell>)}</TableRow>
                )) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={7} sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}>Không tìm thấy tài khoản phù hợp.</TableCell></TableRow>
                ) : users.map((user) => {
                  const isCurrentUser = user._id === currentUser?._id || user._id === currentUser?.id;
                  const isMutating = mutatingId === user._id;
                  return (
                    <TableRow key={user._id} hover sx={{ opacity: user.isActive ? 1 : 0.58 }}>
                      <TableCell sx={{ minWidth: 250, borderColor: 'divider' }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Avatar sx={{ width: 36, height: 36, bgcolor: roleStyles[user.role].color, fontSize: '0.82rem' }}>{user.name.charAt(0).toUpperCase()}</Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={650} noWrap>{user.name}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap display="block">{user.email}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ borderColor: 'divider' }}>
                        {isCurrentUser || user.role === 'staff' ? (
                          <Chip size="small" icon={user.role === 'admin' ? <AdminPanelSettings /> : user.role === 'staff' ? <Engineering /> : undefined} label={ROLE_LABELS[user.role]} sx={{ bgcolor: roleStyles[user.role].background, color: roleStyles[user.role].color, fontWeight: 650 }} />
                        ) : (
                          <Select size="small" value={user.role} disabled={isMutating} onChange={(event: SelectChangeEvent) => handleRoleChange(user, event.target.value as 'user' | 'admin')} sx={{ minWidth: 140, height: 32 }}>
                            <MenuItem value="user">Người dân</MenuItem>
                            <MenuItem value="admin">Quản trị viên</MenuItem>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: 260, borderColor: 'divider' }}>
                        {user.role === 'admin' ? (
                          <Typography variant="caption" color="text.secondary">Không áp dụng</Typography>
                        ) : (
                          <Select
                            size="small"
                            displayEmpty
                            value={getDepartmentId(user)}
                            disabled={departmentsLoading || isMutating || (!user.isActive && !getDepartmentId(user))}
                            onChange={(event: SelectChangeEvent) => handleDepartmentChange(user, event.target.value)}
                            renderValue={(value) => {
                              if (!value) return 'Chưa thuộc đơn vị';
                              const department = departments.find((item) => item._id === value);
                              return department ? `${department.code} — ${department.name}` : 'Đơn vị không tồn tại';
                            }}
                            sx={{ minWidth: 230, maxWidth: 320, height: 34 }}
                          >
                            <MenuItem value="">Không thuộc đơn vị</MenuItem>
                            {departments.map((department) => (
                              <MenuItem key={department._id} value={department._id} disabled={!department.isActive}>
                                {department.code} — {department.name}{department.isActive ? '' : ' (đã vô hiệu hóa)'}
                              </MenuItem>
                            ))}
                          </Select>
                        )}
                      </TableCell>
                      <TableCell sx={{ borderColor: 'divider' }}>
                        <Chip size="small" label={user.isActive ? 'Hoạt động' : 'Đã khóa'} sx={{ bgcolor: user.isActive ? '#E3F1EB' : '#F8E7E5', color: user.isActive ? '#286653' : '#A23C32', fontWeight: 650 }} />
                      </TableCell>
                      <TableCell sx={{ borderColor: 'divider' }}>
                        <Stack direction="row" spacing={0.6} alignItems="center"><BugReport sx={{ fontSize: 16, color: '#B26A00' }} /><Typography variant="body2" fontWeight={700}>{user.issueCount || 0}</Typography></Stack>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', borderColor: 'divider' }}><Typography variant="caption" color="text.secondary">{new Date(user.createdAt).toLocaleDateString('vi-VN')}</Typography></TableCell>
                      <TableCell sx={{ borderColor: 'divider' }}>
                        {!isCurrentUser && (
                          <Tooltip title={user.isActive ? 'Khóa tài khoản' : 'Kích hoạt tài khoản'}>
                            <span>
                              <IconButton size="small" disabled={isMutating} onClick={() => handleToggleActive(user)} sx={{ color: user.isActive ? '#A23C32' : '#286653' }}>
                                {isMutating ? <CircularProgress size={18} /> : user.isActive ? <PersonOff /> : <PersonOutline />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {pagination.pages > 1 && (
            <Stack alignItems="center" sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
              <Pagination count={pagination.pages} page={pagination.current} onChange={(_, nextPage) => setPage(nextPage)} />
            </Stack>
          )}
        </Box>
      </Stack>

      <Snackbar open={notice.open} autoHideDuration={3500} onClose={() => setNotice((current) => ({ ...current, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert variant="filled" severity={notice.severity} onClose={() => setNotice((current) => ({ ...current, open: false }))}>{notice.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default UserManagementPage;
