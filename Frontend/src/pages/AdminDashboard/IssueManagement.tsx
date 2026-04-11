import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { issueApi } from '../../api/issueApi';
import {
  Typography, Chip, Stack, Select, MenuItem, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Skeleton, Pagination, FormControl, InputLabel, SelectChangeEvent,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Snackbar, Alert,
} from '@mui/material';
import { Delete, Visibility, ThumbUp } from '@mui/icons-material';
import {
  GlassCard, IssueItem, STATUS_COLORS, STATUS_LABELS, CATEGORY_LABELS,
  cellSx, headCellSx,
} from './types';

interface Props {
  onDataChange: () => void;
}

const IssueManagement: React.FC<Props> = ({ onDataChange }) => {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [pag, setPag] = useState({ current: 1, pages: 1, total: 0 });
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });
  const [sortBy, setSortBy] = useState('-createdAt');

  const loadIssues = useCallback(async (page = 1, status = '') => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 6, sort: sortBy };
      if (status) params.status = status;
      const { data } = await issueApi.getIssues(params);
      setIssues(data.data.issues);
      setPag(data.data.pagination);
    } catch { } finally { setLoading(false); }
  }, [sortBy]);

  useEffect(() => { loadIssues(1, filter); }, [filter, sortBy, loadIssues]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await issueApi.updateIssueStatus(id, status);
      setSnack({ open: true, msg: `Trạng thái → ${STATUS_LABELS[status]}`, severity: 'success' });
      loadIssues(pag.current, filter);
      onDataChange();
    } catch { setSnack({ open: true, msg: 'Cập nhật thất bại', severity: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await issueApi.deleteIssue(deleteId);
      setDeleteId(null);
      setSnack({ open: true, msg: 'Đã xoá sự cố', severity: 'success' });
      loadIssues(pag.current, filter);
      onDataChange();
    } catch { setSnack({ open: true, msg: 'Xoá thất bại', severity: 'error' }); }
  };

  return (
    <GlassCard>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <Typography fontWeight={600} variant="h6">📋 Quản lý sự cố</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: 'text.secondary' }}>Trạng thái</InputLabel>
            <Select value={filter} label="Trạng thái" onChange={(e: SelectChangeEvent) => setFilter(e.target.value)}
              sx={{ borderRadius: '10px', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}>
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="reported">🟡 Mới</MenuItem>
              <MenuItem value="processing">🔵 Đang xử lý</MenuItem>
              <MenuItem value="resolved">🟢 Đã xử lý</MenuItem>
              <MenuItem value="rejected">🔴 Từ chối</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: 'text.secondary' }}>Sắp xếp</InputLabel>
            <Select value={sortBy} label="Sắp xếp" onChange={(e: SelectChangeEvent) => setSortBy(e.target.value)}
              sx={{ borderRadius: '10px', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}>
              <MenuItem value="-createdAt">🕐 Mới nhất</MenuItem>
              <MenuItem value="createdAt">🕐 Cũ nhất</MenuItem>
              <MenuItem value="-voteCount">🔥 Ủng hộ nhiều nhất</MenuItem>
            </Select>
          </FormControl>
          <Chip label={`${pag.total} sự cố`} sx={{ bgcolor: 'rgba(108,99,255,0.15)', color: '#A5B4FC', fontWeight: 600 }} />
        </Stack>
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead><TableRow>
            {['Tiêu đề', 'Người báo cáo', 'Loại', '👍 Ủng hộ', 'Trạng thái', 'Thời gian', 'Thao tác'].map(h => (
              <TableCell key={h} sx={headCellSx}>{h}</TableCell>
            ))}
          </TableRow></TableHead>
          <TableBody>
            {loading ? [...Array(4)].map((_, i) => (
              <TableRow key={i} sx={{ '@keyframes shimmer': { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } }, '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'translateY(0)' } }, animation: `fadeIn 0.4s ease-out ${i * 0.08}s both` }}>
                {[...Array(7)].map((_, j) => (
                  <TableCell key={j} sx={cellSx}>
                    <Skeleton variant="rounded" height={j === 0 ? 32 : j === 2 || j === 4 ? 22 : 14}
                      width={j === 0 ? '85%' : j === 1 ? '60%' : j === 5 ? '70%' : '50%'}
                      sx={{ bgcolor: 'transparent', background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0.03) 80%)', backgroundSize: '800px 100%', animation: `shimmer 1.8s ease-in-out infinite`, animationDelay: `${j * 0.1}s`, borderRadius: j === 2 || j === 4 ? '10px' : '6px' }} />
                  </TableCell>
                ))}
              </TableRow>
            )) : issues.length === 0 ? (
              <TableRow><TableCell colSpan={7} sx={{ ...cellSx, textAlign: 'center', py: 3 }}>
                <Typography color="text.secondary">Không có sự cố</Typography>
              </TableCell></TableRow>
            ) : issues.map(issue => (
              <TableRow key={issue._id} hover sx={{ '&:hover': { bgcolor: 'rgba(108,99,255,0.04)' } }}>
                <TableCell sx={{ ...cellSx, maxWidth: 200 }}>
                  <Typography variant="body2" fontWeight={500} noWrap>{issue.title}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>📍 {issue.location}</Typography>
                </TableCell>
                <TableCell sx={cellSx}>
                  <Typography variant="caption">{issue.userId && typeof issue.userId === 'object' ? issue.userId.name : '—'}</Typography>
                </TableCell>
                <TableCell sx={cellSx}>
                  <Chip size="small" label={CATEGORY_LABELS[issue.category] || issue.category}
                    sx={{ height: 22, fontSize: '0.7rem', bgcolor: 'rgba(108,99,255,0.15)', color: '#A5B4FC' }} />
                </TableCell>
                <TableCell sx={cellSx}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <ThumbUp sx={{ fontSize: 14, color: (issue as any).voteCount > 0 ? '#F59E0B' : 'text.disabled' }} />
                    <Typography variant="body2" fontWeight={(issue as any).voteCount > 0 ? 700 : 400}
                      color={(issue as any).voteCount > 0 ? '#F59E0B' : 'text.secondary'}>
                      {(issue as any).voteCount || 0}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={cellSx}>
                  <Select size="small" value={issue.status}
                    onChange={(e: SelectChangeEvent) => handleStatusChange(issue._id, e.target.value)}
                    sx={{
                      height: 28, fontSize: '0.75rem', borderRadius: '8px',
                      bgcolor: `${STATUS_COLORS[issue.status]}15`, color: STATUS_COLORS[issue.status],
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: `${STATUS_COLORS[issue.status]}40` },
                      '& .MuiSvgIcon-root': { color: STATUS_COLORS[issue.status] },
                    }}>
                    <MenuItem value="reported">🟡 Mới</MenuItem>
                    <MenuItem value="processing">🔵 Xử lý</MenuItem>
                    <MenuItem value="resolved">🟢 Xong</MenuItem>
                    <MenuItem value="rejected">🔴 Từ chối</MenuItem>
                  </Select>
                </TableCell>
                <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(issue.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </TableCell>
                <TableCell sx={cellSx}>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Xem"><IconButton size="small" onClick={() => navigate(`/issues/${issue._id}`)} sx={{ color: '#6C63FF' }}><Visibility fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Xoá"><IconButton size="small" onClick={() => setDeleteId(issue._id)} sx={{ color: '#EF4444' }}><Delete fontSize="small" /></IconButton></Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {pag.pages > 1 && (
        <Stack alignItems="center" mt={2}>
          <Pagination count={pag.pages} page={pag.current} onChange={(_, p) => loadIssues(p, filter)}
            sx={{ '& .MuiPaginationItem-root': { color: 'text.secondary' } }} />
        </Stack>
      )}

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}
        PaperProps={{ sx: { bgcolor: '#1F2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' } }}>
        <DialogTitle>⚠️ Xác nhận xoá</DialogTitle>
        <DialogContent><Typography color="text.secondary">Bạn có chắc muốn xoá sự cố này?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)} sx={{ color: 'text.secondary' }}>Huỷ</Button>
          <Button onClick={handleDelete} variant="contained" color="error">Xoá</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </GlassCard>
  );
};

export default IssueManagement;
