import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { getProfileThunk } from '../../store/slices/authSlice';
import { issueApi } from '../../api/issueApi';
import { authApi } from '../../api/authApi';
import { toast } from 'react-toastify';
import {
  Container, Typography, Card, CardContent, Avatar, Box, Stack,
  Chip, Divider, TextField, Button, Grid, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '@mui/material';
import {
  Email, CalendarMonth, VerifiedUser, Shield, Edit, Lock,
  BugReport, CheckCircle, Pending,
} from '@mui/icons-material';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip,
} from 'recharts';
import { formatDate } from '../../utils/helpers';
import { Issue } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';

const STATUS_COLORS: Record<string, string> = {
  reported: '#EF4444',
  processing: '#F59E0B',
  resolved: '#10B981',
  rejected: '#6B7280',
};

const STATUS_LABELS: Record<string, string> = {
  reported: 'Mới báo cáo',
  processing: 'Đang xử lý',
  resolved: 'Đã xử lý',
  rejected: 'Từ chối',
};

const ProfilePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, loading } = useSelector((s: RootState) => s.auth);

  const [editName, setEditName] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pwDialog, setPwDialog] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const [myIssues, setMyIssues] = useState<Issue[]>([]);

  useEffect(() => { dispatch(getProfileThunk()); }, [dispatch]);
  useEffect(() => { if (user) setEditName(user.name); }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await issueApi.getMyIssues({ limit: 100 });
        setMyIssues(data.data.issues);
      } catch { /* ignore */ }
    })();
  }, []);

  const handleUpdateName = async () => {
    if (!editName.trim() || saving) return;
    setSaving(true);
    try {
      await authApi.updateProfile({ name: editName.trim() });
      dispatch(getProfileThunk());
      setEditMode(false);
      toast.success('Cập nhật tên thành công!');
    } catch {
      toast.error('Lỗi cập nhật');
    }
    setSaving(false);
  };

  const handleChangePw = async () => {
    if (!currentPw || !newPw || changingPw) return;
    setChangingPw(true);
    try {
      await authApi.changePassword({ currentPassword: currentPw, newPassword: newPw });
      setPwDialog(false);
      setCurrentPw('');
      setNewPw('');
      toast.success('Đổi mật khẩu thành công!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Đổi mật khẩu thất bại');
    }
    setChangingPw(false);
  };

  if (loading || !user) return <LoadingSpinner />;

  // Issue stats
  const issueStats = myIssues.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(issueStats).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
    color: STATUS_COLORS[status] || '#666',
  }));

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Grid container spacing={4}>
        {/* Profile Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: { xs: 2, md: 4 }, textAlign: 'center' }}>
            <CardContent>
              <Avatar sx={{
                width: 96, height: 96, mx: 'auto', mb: 2.5, fontSize: '2.5rem', fontWeight: 700,
                background: 'linear-gradient(135deg, #6C63FF, #00D9A6)',
              }}>
                {user.name.charAt(0).toUpperCase()}
              </Avatar>

              {editMode ? (
                <Stack direction="row" spacing={1} justifyContent="center" mb={2}>
                  <TextField size="small" value={editName} onChange={(e) => setEditName(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                  <Button variant="contained" size="small" onClick={handleUpdateName} disabled={saving}
                    sx={{ borderRadius: '10px' }}>Lưu</Button>
                  <Button size="small" onClick={() => { setEditMode(false); setEditName(user.name); }}
                    sx={{ borderRadius: '10px' }}>Hủy</Button>
                </Stack>
              ) : (
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={0.5}>
                  <Typography variant="h4" fontWeight={700}>{user.name}</Typography>
                  <Button size="small" onClick={() => setEditMode(true)} sx={{ minWidth: 32 }}>
                    <Edit sx={{ fontSize: 16 }} />
                  </Button>
                </Stack>
              )}

              <Chip
                icon={user.role === 'admin' ? <Shield sx={{ fontSize: 16 }} /> : <VerifiedUser sx={{ fontSize: 16 }} />}
                label={user.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
                sx={{
                  mb: 3,
                  bgcolor: user.role === 'admin' ? 'rgba(108,99,255,0.15)' : 'rgba(0,217,166,0.15)',
                  color: user.role === 'admin' ? 'primary.main' : 'secondary.main',
                  fontWeight: 600,
                }}
              />

              <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.06)' }} />

              <Stack spacing={2.5} textAlign="left">
                <Box display="flex" alignItems="center" gap={2}>
                  <Box sx={{ width: 42, height: 42, borderRadius: '12px', bgcolor: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Email sx={{ color: '#3B82F6' }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Email</Typography>
                    <Typography fontWeight={500}>{user.email}</Typography>
                  </Box>
                </Box>

                <Box display="flex" alignItems="center" gap={2}>
                  <Box sx={{ width: 42, height: 42, borderRadius: '12px', bgcolor: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarMonth sx={{ color: '#10B981' }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Ngày tham gia</Typography>
                    <Typography fontWeight={500}>{formatDate(user.createdAt)}</Typography>
                  </Box>
                </Box>

                <Box display="flex" alignItems="center" gap={2}>
                  <Box sx={{ width: 42, height: 42, borderRadius: '12px', bgcolor: user.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <VerifiedUser sx={{ color: user.isActive ? '#10B981' : '#EF4444' }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Trạng thái</Typography>
                    <Typography fontWeight={500} color={user.isActive ? 'success.main' : 'error.main'}>
                      {user.isActive ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}
                    </Typography>
                  </Box>
                </Box>
              </Stack>

              <Box mt={3}>
                <Button fullWidth variant="outlined" startIcon={<Lock />} onClick={() => setPwDialog(true)}
                  sx={{ borderRadius: '12px', textTransform: 'none' }}>
                  Đổi mật khẩu
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Issue Stats Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: { xs: 2, md: 3 }, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} mb={2}>📊 Sự cố của tôi</Typography>

              <Stack direction="row" spacing={2} mb={2}>
                <Box sx={{ textAlign: 'center', flex: 1, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(108,99,255,0.08)' }}>
                  <BugReport sx={{ color: 'primary.main', mb: 0.5 }} />
                  <Typography variant="h5" fontWeight={700}>{myIssues.length}</Typography>
                  <Typography variant="caption" color="text.secondary">Tổng cộng</Typography>
                </Box>
                <Box sx={{ textAlign: 'center', flex: 1, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(16,185,129,0.08)' }}>
                  <CheckCircle sx={{ color: '#10B981', mb: 0.5 }} />
                  <Typography variant="h5" fontWeight={700}>{issueStats.resolved || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">Đã xử lý</Typography>
                </Box>
                <Box sx={{ textAlign: 'center', flex: 1, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(245,158,11,0.08)' }}>
                  <Pending sx={{ color: '#F59E0B', mb: 0.5 }} />
                  <Typography variant="h5" fontWeight={700}>{issueStats.processing || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">Đang xử lý</Typography>
                </Box>
              </Stack>

              {pieData.length > 0 && (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3} strokeWidth={0}>
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <RTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <Stack spacing={0.5} mt={1}>
                    {pieData.map((p, i) => (
                      <Stack key={i} direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: p.color }} />
                          <Typography variant="caption">{p.name}</Typography>
                        </Stack>
                        <Typography variant="caption" fontWeight={600}>{p.value}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Change Password Dialog */}
      <Dialog open={pwDialog} onClose={() => setPwDialog(false)}
        PaperProps={{ sx: { borderRadius: '16px', bgcolor: 'background.paper', minWidth: 360 } }}>
        <DialogTitle fontWeight={700}>🔐 Đổi mật khẩu</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField fullWidth size="small" type="password" label="Mật khẩu hiện tại"
              value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
            <TextField fullWidth size="small" type="password" label="Mật khẩu mới (tối thiểu 6 ký tự)"
              value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 0 }}>
          <Button onClick={() => setPwDialog(false)} sx={{ borderRadius: '10px' }}>Hủy</Button>
          <Button variant="contained" onClick={handleChangePw} disabled={!currentPw || !newPw || changingPw}
            sx={{ borderRadius: '10px' }}>Đổi mật khẩu</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProfilePage;
