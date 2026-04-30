import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { getProfileThunk } from '../../store/slices/authSlice';
import { issueApi } from '../../api/issueApi';
import { authApi } from '../../api/authApi';
import { badgeApi } from '../../api/badgeApi';
import { toast } from 'react-toastify';
import {
  Container, Typography, Card, CardContent, Avatar, Box, Stack,
  Chip, Divider, TextField, Button, Grid, Dialog, DialogTitle,
  DialogContent, DialogActions, LinearProgress, Tooltip,
} from '@mui/material';
import {
  Email, CalendarMonth, VerifiedUser, Shield, Edit, Lock,
  BugReport, CheckCircle, Pending, EmojiEvents, LocationOn,
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
  const [badgeData, setBadgeData] = useState<any>(null);
  const [watchedDistricts, setWatchedDistricts] = useState<string[]>([]);
  const [savingDistricts, setSavingDistricts] = useState(false);

  useEffect(() => { dispatch(getProfileThunk()); }, [dispatch]);
  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setWatchedDistricts(user.watchedDistricts || []);
    }
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await issueApi.getMyIssues({ limit: 100 });
        setMyIssues(data.data.issues);
      } catch { /* ignore */ }
    })();
    (async () => {
      try {
        const { data } = await badgeApi.getMyBadges();
        setBadgeData(data.data);
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
                background: 'linear-gradient(135deg, #0EA5E9, #10B981)',
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
                  bgcolor: user.role === 'admin' ? 'rgba(14,165,233,0.15)' : 'rgba(16,185,129,0.15)',
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
                <Box sx={{ textAlign: 'center', flex: 1, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(14,165,233,0.08)' }}>
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

        {/* Badges Card */}
        {badgeData && (
          <Grid item xs={12}>
            <Card sx={{ p: { xs: 2, md: 3 } }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <EmojiEvents sx={{ color: '#F59E0B' }} />
                  <Typography variant="h6" fontWeight={700}>Huy hiệu đóng góp</Typography>
                  <Chip size="small" label={`${badgeData.badges.length}/${badgeData.allBadges.length}`}
                    sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: '#FBBF24', fontWeight: 600 }} />
                </Stack>

                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap mb={2}>
                  {badgeData.allBadges.map((b: any) => (
                    <Tooltip key={b.id} title={`${b.description} (≥ ${b.threshold} báo cáo)`}>
                      <Box sx={{
                        textAlign: 'center', p: 1.5, borderRadius: '14px', minWidth: 90,
                        bgcolor: b.earned ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${b.earned ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.06)'}`,
                        opacity: b.earned ? 1 : 0.4,
                        transition: 'all 0.3s',
                        '&:hover': { transform: b.earned ? 'scale(1.05)' : 'none' },
                      }}>
                        <Typography fontSize="2rem">{b.icon}</Typography>
                        <Typography variant="caption" fontWeight={b.earned ? 600 : 400}
                          color={b.earned ? '#FBBF24' : 'text.secondary'}>
                          {b.label}
                        </Typography>
                      </Box>
                    </Tooltip>
                  ))}
                </Stack>

                {badgeData.nextBadge && (
                  <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        Tiếp theo: {badgeData.nextBadge.icon} {badgeData.nextBadge.label}
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="#FBBF24">
                        {badgeData.issueCount}/{badgeData.nextBadge.threshold}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(badgeData.issueCount / badgeData.nextBadge.threshold) * 100}
                      sx={{
                        height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.06)',
                        '& .MuiLinearProgress-bar': { borderRadius: 4, background: 'linear-gradient(90deg, #F59E0B, #FBBF24)' },
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" mt={0.5}>
                      Còn {badgeData.nextBadge.remaining} báo cáo nữa
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Watched Districts Card */}
        <Grid item xs={12}>
          <Card sx={{ p: { xs: 2, md: 3 } }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <LocationOn sx={{ color: '#3B82F6' }} />
                <Typography variant="h6" fontWeight={700}>Theo dõi khu vực</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Chọn quận/huyện bạn muốn theo dõi. Khi có sự cố mới tại khu vực đó, bạn sẽ nhận thông báo.
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {['Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn', 'Liên Chiểu', 'Cẩm Lệ', 'Hòa Vang', 'Hoàng Sa'].map(d => {
                  const active = watchedDistricts.includes(d);
                  return (
                    <Chip
                      key={d}
                      label={d}
                      icon={<LocationOn sx={{ fontSize: 16 }} />}
                      onClick={async () => {
                        const next = active
                          ? watchedDistricts.filter(x => x !== d)
                          : [...watchedDistricts, d];
                        setWatchedDistricts(next);
                        setSavingDistricts(true);
                        try {
                          await authApi.updateProfile({ watchedDistricts: next });
                          dispatch(getProfileThunk());
                        } catch { /* ignore */ }
                        setSavingDistricts(false);
                      }}
                      sx={{
                        fontWeight: active ? 600 : 400,
                        bgcolor: active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                        color: active ? '#60A5FA' : 'text.secondary',
                        border: `1px solid ${active ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: active ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.08)' },
                      }}
                    />
                  );
                })}
              </Stack>
              {savingDistricts && (
                <Typography variant="caption" color="primary.main" mt={1}>
                  Đang lưu...
                </Typography>
              )}
              {watchedDistricts.length > 0 && !savingDistricts && (
                <Typography variant="caption" color="text.secondary" mt={1} display="block">
                  🔔 Đang theo dõi {watchedDistricts.length} khu vực
                </Typography>
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
