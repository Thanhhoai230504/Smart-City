import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { fetchMyIssues } from '../../store/slices/issueSlice';
import { issueApi } from '../../api/issueApi';
import {
  Container, Typography, Box, Card, CardContent, Chip, Stack,
  MenuItem, TextField, Pagination as MuiPagination,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material';
import { LocationOn, AccessTime, Delete, Edit } from '@mui/icons-material';
import { CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';
import { timeAgo } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';

const MyIssuesPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { myIssues, myPagination, loading } = useSelector((s: RootState) => s.issues);

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const loadIssues = () => {
    const params: Record<string, string | number> = { page, limit: 10 };
    if (status) params.status = status;
    dispatch(fetchMyIssues(params));
  };

  useEffect(() => { loadIssues(); }, [dispatch, page, status]);

  const handleDelete = async (e: React.MouseEvent, issueId: string) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc muốn xóa sự cố này?')) return;
    try {
      await issueApi.deleteMyIssue(issueId);
      toast.success('Đã xóa sự cố');
      loadIssues();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể xóa');
    }
  };

  const handleEditOpen = (e: React.MouseEvent, issue: any) => {
    e.stopPropagation();
    setEditId(issue._id);
    setEditTitle(issue.title);
    setEditDesc(issue.description || '');
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      await issueApi.updateMyIssue(editId, { title: editTitle.trim(), description: editDesc.trim() });
      toast.success('Đã cập nhật sự cố');
      setEditOpen(false);
      loadIssues();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể cập nhật');
    }
    setSaving(false);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} mb={1}>📋 Sự cố của tôi</Typography>
      <Typography color="text.secondary" mb={3}>Các sự cố bạn đã báo cáo</Typography>

      <TextField select label="Lọc trạng thái" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        size="small" sx={{ mb: 3, minWidth: 180 }}>
        <MenuItem value="">Tất cả</MenuItem>
        {Object.entries(STATUS_MAP).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
      </TextField>

      {loading ? <LoadingSpinner /> : myIssues.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography fontSize="3rem" mb={1}>📭</Typography>
          <Typography color="text.secondary" mb={2}>Bạn chưa báo cáo sự cố nào</Typography>
          <Button variant="contained" onClick={() => navigate('/report')}>Báo cáo sự cố</Button>
        </Box>
      ) : (
        <Stack spacing={2}>
          {myIssues.map((issue) => {
            const cat = CATEGORY_MAP[issue.category] || CATEGORY_MAP.other;
            const st = STATUS_MAP[issue.status] || STATUS_MAP.reported;
            const canModify = issue.status === 'reported';
            return (
              <Card key={issue._id} onClick={() => navigate(`/issues/${issue._id}`)}
                sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main', transform: 'translateX(4px)' } }}>
                <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                  <Box>
                    <Typography fontWeight={600} mb={0.5}>{cat.icon} {issue.title}</Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <LocationOn sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">{issue.location}</Typography>
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                    <Chip label={st.label} size="small" sx={{ bgcolor: `${st.color}20`, color: st.color, fontWeight: 600 }} />
                    <Stack direction="row" spacing={0.3} alignItems="center">
                      <AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">{timeAgo(issue.createdAt)}</Typography>
                    </Stack>
                    {canModify && (
                      <>
                        <Tooltip title="Chỉnh sửa">
                          <IconButton size="small" onClick={(e) => handleEditOpen(e, issue)}
                            sx={{ color: '#F59E0B', '&:hover': { bgcolor: 'rgba(245,158,11,0.1)' } }}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Xóa">
                          <IconButton size="small" onClick={(e) => handleDelete(e, issue._id)}
                            sx={{ color: '#EF4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      {myPagination && myPagination.pages > 1 && (
        <Box mt={3} display="flex" justifyContent="center">
          <MuiPagination count={myPagination.pages} page={myPagination.current} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" />
        </Box>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#1F2937', backgroundImage: 'none' } }}>
        <DialogTitle>✏️ Chỉnh sửa sự cố</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Tiêu đề" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
            sx={{ mt: 1, mb: 2 }} />
          <TextField fullWidth label="Mô tả" value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
            multiline rows={4} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOpen(false)} color="inherit">Hủy</Button>
          <Button onClick={handleEditSave} variant="contained" disabled={saving || !editTitle.trim()}>
            {saving ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MyIssuesPage;
