import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { issueApi } from '../../api/issueApi';
import {
  Typography, Chip, Stack, Select, MenuItem, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Skeleton, Pagination, FormControl, InputLabel, SelectChangeEvent,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Snackbar, Alert,
  CircularProgress, Box, Divider,
} from '@mui/material';
import { CallMerge, Delete, Visibility, ThumbUp } from '@mui/icons-material';
import {
  GlassCard, IssueItem, STATUS_COLORS, STATUS_LABELS, CATEGORY_LABELS,
  cellSx, headCellSx,
} from './types';
import { DuplicateCandidate, DuplicateCandidateMeta, IssueStatus } from '../../types';

interface ApiErrorResponse {
  message?: string;
}

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
  const [mergeSource, setMergeSource] = useState<IssueItem | null>(null);
  const [mergeCandidates, setMergeCandidates] = useState<DuplicateCandidate[]>([]);
  const [mergeMeta, setMergeMeta] = useState<DuplicateCandidateMeta | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeLoading, setMergeLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState('');

  const loadIssues = useCallback(async (page = 1, status = '') => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 6, sort: sortBy };
      if (status) params.status = status;
      const { data } = await issueApi.getIssues(params);
      setIssues(data.data.issues);
      setPag(data.data.pagination);
    } catch { /* silently ignore */ } finally { setLoading(false); }
  }, [sortBy]);

  useEffect(() => { loadIssues(1, filter); }, [filter, sortBy, loadIssues]);

  const handleStatusChange = async (id: string, status: IssueStatus) => {
    try {
      await issueApi.updateIssueStatus(id, status);
      setSnack({ open: true, msg: `Trạng thái → ${STATUS_LABELS[status]}`, severity: 'success' });
      loadIssues(pag.current, filter);
      onDataChange();
    } catch { /* silently ignore */ setSnack({ open: true, msg: 'Cập nhật thất bại', severity: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await issueApi.deleteIssue(deleteId);
      setDeleteId(null);
      setSnack({ open: true, msg: 'Đã xoá sự cố', severity: 'success' });
      loadIssues(pag.current, filter);
      onDataChange();
    } catch { /* silently ignore */ setSnack({ open: true, msg: 'Xoá thất bại', severity: 'error' }); }
  };

  const openMergeDialog = async (source: IssueItem) => {
    setMergeSource(source);
    setMergeTargetId('');
    setMergeCandidates([]);
    setMergeMeta(null);
    setMergeError('');
    setMergeLoading(true);
    try {
      const { data } = await issueApi.getDuplicateCandidatesForIssue(source._id);
      setMergeCandidates(data.data.candidates);
      setMergeMeta(data.data.meta);
    } catch (error) {
      setMergeError(
        axios.isAxiosError<ApiErrorResponse>(error)
          ? error.response?.data?.message || 'Không thể tải danh sách sự cố gốc.'
          : 'Không thể tải danh sách sự cố gốc.'
      );
    } finally {
      setMergeLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeSource || !mergeTargetId) return;
    setMerging(true);
    setMergeError('');
    try {
      await issueApi.mergeIssue(mergeSource._id, mergeTargetId);
      setSnack({
        open: true,
        msg: `Đã gộp “${mergeSource.title}” vào sự cố gốc.`,
        severity: 'success',
      });
      setMergeSource(null);
      await loadIssues(pag.current, filter);
      onDataChange();
    } catch (error) {
      setMergeError(
        axios.isAxiosError<ApiErrorResponse>(error)
          ? error.response?.data?.message || 'Không thể gộp sự cố.'
          : 'Không thể gộp sự cố.'
      );
    } finally {
      setMerging(false);
    }
  };

  const selectedMergeCandidate = mergeCandidates.find(
    (candidate) => candidate.issue._id === mergeTargetId
  );

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
          <Chip label={`${pag.total} sự cố`} sx={{ bgcolor: 'rgba(14,165,233,0.15)', color: '#A5B4FC', fontWeight: 600 }} />
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
              <TableRow key={issue._id} hover sx={{ '&:hover': { bgcolor: 'rgba(14,165,233,0.04)' } }}>
                <TableCell sx={{ ...cellSx, maxWidth: 200 }}>
                  <Typography variant="body2" fontWeight={500} noWrap>{issue.title}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>📍 {issue.location}</Typography>
                </TableCell>
                <TableCell sx={cellSx}>
                  <Typography variant="caption">{issue.userId && typeof issue.userId === 'object' ? issue.userId.name : '—'}</Typography>
                </TableCell>
                <TableCell sx={cellSx}>
                  <Chip size="small" label={CATEGORY_LABELS[issue.category] || issue.category}
                    sx={{ height: 22, fontSize: '0.7rem', bgcolor: 'rgba(14,165,233,0.15)', color: '#A5B4FC' }} />
                </TableCell>
                <TableCell sx={cellSx}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <ThumbUp sx={{ fontSize: 14, color: (issue.voteCount || 0) > 0 ? '#F59E0B' : 'text.disabled' }} />
                    <Typography variant="body2" fontWeight={(issue.voteCount || 0) > 0 ? 700 : 400}
                      color={(issue.voteCount || 0) > 0 ? '#F59E0B' : 'text.secondary'}>
                      {issue.voteCount || 0}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={cellSx}>
                  <Select size="small" value={issue.status}
                    onChange={(e: SelectChangeEvent) => handleStatusChange(issue._id, e.target.value as IssueStatus)}
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
                    <Tooltip title="Xem"><IconButton size="small" onClick={() => navigate(`/issues/${issue._id}`)} sx={{ color: '#0EA5E9' }}><Visibility fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Gộp vào sự cố gốc">
                      <IconButton size="small" onClick={() => openMergeDialog(issue)} sx={{ color: '#8B5CF6' }}>
                        <CallMerge fontSize="small" />
                      </IconButton>
                    </Tooltip>
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
        PaperProps={{ sx: { bgcolor: '#1A2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' } }}>
        <DialogTitle>⚠️ Xác nhận xoá</DialogTitle>
        <DialogContent><Typography color="text.secondary">Bạn có chắc muốn xoá sự cố này?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)} sx={{ color: 'text.secondary' }}>Huỷ</Button>
          <Button onClick={handleDelete} variant="contained" color="error">Xoá</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(mergeSource)}
        onClose={merging ? undefined : () => setMergeSource(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { bgcolor: '#1A2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' } }}
      >
        <DialogTitle>Gộp báo cáo trùng lặp</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Bản trùng vẫn được giữ trong lịch sử nhưng sẽ ẩn khỏi danh sách. Vote và người
              theo dõi được chuyển sang sự cố gốc. Hệ thống chỉ đề xuất, admin là người quyết định.
            </Alert>

            {mergeMeta?.mode !== 'embedding' && (
              <Alert severity="warning">
                Embedding chưa sẵn sàng; danh sách đang dùng so khớp từ khóa + vị trí.
              </Alert>
            )}

            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">Báo cáo cần gộp</Typography>
              <Typography fontWeight={700}>{mergeSource?.title}</Typography>
              <Typography variant="body2" color="text.secondary">{mergeSource?.location}</Typography>
            </Stack>

            {mergeError && <Alert severity="error">{mergeError}</Alert>}

            <FormControl fullWidth disabled={mergeLoading || merging}>
              <InputLabel id="merge-target-label">Chọn sự cố gốc</InputLabel>
              <Select
                labelId="merge-target-label"
                value={mergeTargetId}
                label="Chọn sự cố gốc"
                onChange={(event: SelectChangeEvent) => setMergeTargetId(event.target.value)}
                startAdornment={mergeLoading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : undefined}
              >
                {mergeCandidates.map((candidate) => (
                  <MenuItem key={candidate.issue._id} value={candidate.issue._id}>
                    <Stack sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{candidate.issue.title}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        Giống {Math.round(candidate.duplicateScore * 100)}%
                        {' · '}
                        {candidate.distanceMeters} m
                        {' · '}
                        {CATEGORY_LABELS[candidate.issue.category] || candidate.issue.category}
                      </Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedMergeCandidate && mergeSource && (
              <Box sx={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, p: 1.5 }}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={1.25}>
                  <Chip
                    size="small"
                    color={selectedMergeCandidate.confidence === 'high' ? 'error' : 'warning'}
                    label={`Độ trùng ${Math.round(selectedMergeCandidate.duplicateScore * 100)}%`}
                  />
                  <Chip size="small" label={`${selectedMergeCandidate.distanceMeters} m`} />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={selectedMergeCandidate.method === 'embedding' ? 'Embedding' : 'Từ khóa dự phòng'}
                  />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} divider={<Divider flexItem orientation="vertical" />}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">Báo cáo cần gộp</Typography>
                    <Typography variant="body2" fontWeight={700}>{mergeSource.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{mergeSource.location}</Typography>
                    <Typography variant="caption" display="block" mt={0.5}>{mergeSource.description}</Typography>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">Sự cố gốc đề xuất</Typography>
                    <Typography variant="body2" fontWeight={700}>{selectedMergeCandidate.issue.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{selectedMergeCandidate.issue.location}</Typography>
                    <Typography variant="caption" display="block" mt={0.5}>{selectedMergeCandidate.issue.description}</Typography>
                  </Box>
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block" mt={1.25}>
                  {selectedMergeCandidate.reasons.join(' · ')}
                </Typography>
              </Box>
            )}

            {!mergeLoading && mergeCandidates.length === 0 && !mergeError && (
              <Typography variant="body2" color="text.secondary">
                Không có sự cố khác phù hợp để chọn làm bản gốc.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeSource(null)} disabled={merging} color="inherit">
            Hủy
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleMerge}
            disabled={!mergeTargetId || merging}
            startIcon={merging ? <CircularProgress size={17} color="inherit" /> : <CallMerge />}
          >
            {merging ? 'Đang gộp...' : 'Xác nhận gộp'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </GlassCard>
  );
};

export default IssueManagement;
