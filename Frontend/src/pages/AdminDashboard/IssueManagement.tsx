import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { issueApi } from '../../api/issueApi';
import {
  Typography, Chip, Stack, Select, MenuItem, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Skeleton, Pagination, FormControl, InputLabel, SelectChangeEvent,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Snackbar, Alert,
  CircularProgress, Box, Divider, InputAdornment, TextField,
} from '@mui/material';
import { CallMerge, Delete, Refresh, Search, Visibility, ThumbUp } from '@mui/icons-material';
import {
  GlassCard, STATUS_COLORS, STATUS_LABELS, CATEGORY_LABELS,
  cellSx, headCellSx,
} from './types';
import {
  DuplicateCandidate,
  DuplicateCandidateMeta,
  Issue,
  IssueStatus,
  PriorityLevel,
} from '../../types';
import PriorityBadge from '../../components/PriorityBadge';
import SlaBadge from '../../components/SlaBadge';

interface ApiErrorResponse {
  message?: string;
}

interface Props {
  onDataChange?: () => void;
}

const DISTRICTS = ['Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn', 'Liên Chiểu', 'Cẩm Lệ', 'Hòa Vang', 'Hoàng Sa', 'Khác'];

const getReferenceName = (
  value: Issue['departmentId'] | Issue['assigneeId'],
  emptyLabel: string,
) => {
  if (!value) return emptyLabel;
  if (typeof value === 'string') return 'Đã phân công';
  return 'code' in value ? `${value.code} — ${value.name}` : value.name;
};

const IssueManagement: React.FC<Props> = ({ onDataChange = () => undefined }) => {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pag, setPag] = useState({ current: 1, pages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });
  const [sortBy, setSortBy] = useState('-createdAt');
  const [mergeSource, setMergeSource] = useState<Issue | null>(null);
  const [mergeCandidates, setMergeCandidates] = useState<DuplicateCandidate[]>([]);
  const [mergeMeta, setMergeMeta] = useState<DuplicateCandidateMeta | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeLoading, setMergeLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState('');

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 12, sort: sortBy };
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (districtFilter) params.district = districtFilter;
      if (priorityFilter) params.priorityLevel = priorityFilter;
      if (assignmentFilter === 'assigned') params.assigned = 'true';
      if (assignmentFilter === 'unassigned') params.unassigned = 'true';
      if (search) params.search = search;
      const { data } = await issueApi.getIssues(params);
      setIssues(data.data.issues);
      setPag(data.data.pagination);
    } catch (error) {
      setSnack({
        open: true,
        msg: axios.isAxiosError<ApiErrorResponse>(error)
          ? error.response?.data?.message || 'Không thể tải danh sách sự cố.'
          : 'Không thể tải danh sách sự cố.',
        severity: 'error',
      });
    } finally { setLoading(false); }
  }, [assignmentFilter, categoryFilter, districtFilter, page, priorityFilter, search, sortBy, statusFilter]);

  useEffect(() => { loadIssues(); }, [loadIssues]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const handleStatusChange = async (id: string, status: IssueStatus) => {
    try {
      await issueApi.updateIssueStatus(id, status);
      setSnack({ open: true, msg: `Trạng thái → ${STATUS_LABELS[status]}`, severity: 'success' });
      await loadIssues();
      onDataChange();
    } catch { /* silently ignore */ setSnack({ open: true, msg: 'Cập nhật thất bại', severity: 'error' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await issueApi.deleteIssue(deleteId);
      setDeleteId(null);
      setSnack({ open: true, msg: 'Đã xoá sự cố', severity: 'success' });
      await loadIssues();
      onDataChange();
    } catch { /* silently ignore */ setSnack({ open: true, msg: 'Xoá thất bại', severity: 'error' }); }
  };

  const openMergeDialog = async (source: Issue) => {
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
      await loadIssues();
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

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setDistrictFilter('');
    setAssignmentFilter('');
    setPriorityFilter('');
    setSortBy('-createdAt');
    setPage(1);
  };

  return (
    <GlassCard sx={{ p: 0, overflow: 'hidden' }}>
      <Box sx={{ p: { xs: 2, md: 2.5 }, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
          <Box>
            <Typography fontWeight={700} variant="h6">Danh sách điều hành sự cố</Typography>
            <Typography variant="body2" color="text.secondary">
              Mỗi dòng thể hiện trạng thái, mức ưu tiên, đơn vị chịu trách nhiệm, cán bộ và hạn SLA.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={`${pag.total} sự cố`} sx={{ bgcolor: '#EAF3F4', color: '#176B87', fontWeight: 700 }} />
            <Button variant="outlined" startIcon={<Refresh />} disabled={loading} onClick={loadIssues}>Làm mới</Button>
          </Stack>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'minmax(250px, 1.4fr) repeat(6, minmax(135px, .7fr)) auto' }, gap: 1.15, mt: 2.5 }}>
          <TextField
            size="small"
            label="Tìm tiêu đề hoặc mô tả"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          />
          <FormControl size="small">
            <InputLabel>Trạng thái</InputLabel>
            <Select value={statusFilter} label="Trạng thái" onChange={(event: SelectChangeEvent) => { setStatusFilter(event.target.value); setPage(1); }}>
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="reported">Mới báo cáo</MenuItem>
              <MenuItem value="processing">Đang xử lý</MenuItem>
              <MenuItem value="resolved">Đã xử lý</MenuItem>
              <MenuItem value="rejected">Từ chối</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Danh mục</InputLabel>
            <Select value={categoryFilter} label="Danh mục" onChange={(event: SelectChangeEvent) => { setCategoryFilter(event.target.value); setPage(1); }}>
              <MenuItem value="">Tất cả</MenuItem>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Địa bàn</InputLabel>
            <Select value={districtFilter} label="Địa bàn" onChange={(event: SelectChangeEvent) => { setDistrictFilter(event.target.value); setPage(1); }}>
              <MenuItem value="">Tất cả</MenuItem>
              {DISTRICTS.map((district) => <MenuItem key={district} value={district}>{district}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Phân công</InputLabel>
            <Select value={assignmentFilter} label="Phân công" onChange={(event: SelectChangeEvent) => { setAssignmentFilter(event.target.value); setPage(1); }}>
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="unassigned">Chưa phân công</MenuItem>
              <MenuItem value="assigned">Đã phân công</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Ưu tiên</InputLabel>
            <Select value={priorityFilter} label="Ưu tiên" onChange={(event: SelectChangeEvent<PriorityLevel | ''>) => { setPriorityFilter(event.target.value as PriorityLevel | ''); setPage(1); }}>
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="critical">Khẩn cấp</MenuItem>
              <MenuItem value="high">Cao</MenuItem>
              <MenuItem value="medium">Trung bình</MenuItem>
              <MenuItem value="low">Thấp</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Sắp xếp</InputLabel>
            <Select value={sortBy} label="Sắp xếp" onChange={(event: SelectChangeEvent) => { setSortBy(event.target.value); setPage(1); }}>
              <MenuItem value="-createdAt">Mới nhất</MenuItem>
              <MenuItem value="createdAt">Cũ nhất</MenuItem>
              <MenuItem value="-priorityScore">Ưu tiên cao nhất</MenuItem>
              <MenuItem value="-voteCount">Đồng thuận nhiều nhất</MenuItem>
              <MenuItem value="dueAt">Sắp đến hạn</MenuItem>
            </Select>
          </FormControl>
          <Button onClick={resetFilters} sx={{ whiteSpace: 'nowrap' }}>Xóa lọc</Button>
        </Box>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead><TableRow>
            {['Sự cố', 'Trạng thái', 'Ưu tiên', 'Đơn vị xử lý', 'Cán bộ', 'SLA', 'Đồng thuận', 'Ngày báo', 'Thao tác'].map(h => (
              <TableCell key={h} sx={headCellSx}>{h}</TableCell>
            ))}
          </TableRow></TableHead>
          <TableBody>
            {loading ? [...Array(6)].map((_, i) => (
              <TableRow key={i} sx={{ '@keyframes shimmer': { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } }, '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'translateY(0)' } }, animation: `fadeIn 0.4s ease-out ${i * 0.08}s both` }}>
                {[...Array(9)].map((_, j) => (
                  <TableCell key={j} sx={cellSx}>
                    <Skeleton variant="rounded" height={j === 0 ? 34 : 20} width={j === 0 ? '88%' : '65%'} />
                  </TableCell>
                ))}
              </TableRow>
            )) : issues.length === 0 ? (
              <TableRow><TableCell colSpan={9} sx={{ ...cellSx, textAlign: 'center', py: 7 }}>
                <Typography color="text.secondary">Không tìm thấy sự cố phù hợp với bộ lọc.</Typography>
              </TableCell></TableRow>
            ) : issues.map(issue => (
              <TableRow key={issue._id} hover sx={{ '&:hover': { bgcolor: 'rgba(14,165,233,0.04)' } }}>
                <TableCell sx={{ ...cellSx, minWidth: 260, maxWidth: 360 }}>
                  <Typography variant="body2" fontWeight={650} noWrap>{issue.title}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">{CATEGORY_LABELS[issue.category] || issue.category} · {issue.district || 'Chưa xác định địa bàn'}</Typography>
                  <Typography variant="caption" color="text.disabled" noWrap display="block">{issue.location}</Typography>
                </TableCell>
                <TableCell sx={cellSx}>
                  <Select size="small" value={issue.status} onChange={(event: SelectChangeEvent) => handleStatusChange(issue._id, event.target.value as IssueStatus)}
                    sx={{ height: 30, minWidth: 125, fontSize: '0.74rem', bgcolor: `${STATUS_COLORS[issue.status]}12`, color: STATUS_COLORS[issue.status], '& .MuiOutlinedInput-notchedOutline': { borderColor: `${STATUS_COLORS[issue.status]}35` } }}>
                    <MenuItem value="reported">Mới báo cáo</MenuItem>
                    <MenuItem value="processing">Đang xử lý</MenuItem>
                    <MenuItem value="resolved">Đã xử lý</MenuItem>
                    <MenuItem value="rejected">Từ chối</MenuItem>
                  </Select>
                </TableCell>
                <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}><PriorityBadge issue={issue} /></TableCell>
                <TableCell sx={{ ...cellSx, minWidth: 190 }}>
                  <Typography variant="caption" fontWeight={issue.departmentId ? 600 : 400} color={issue.departmentId ? 'text.primary' : 'warning.main'}>
                    {getReferenceName(issue.departmentId, 'Chưa phân công')}
                  </Typography>
                </TableCell>
                <TableCell sx={{ ...cellSx, minWidth: 145 }}>
                  <Typography variant="caption" color={issue.assigneeId ? 'text.primary' : 'text.secondary'}>
                    {getReferenceName(issue.assigneeId, issue.departmentId ? 'Đơn vị tự nhận' : '—')}
                  </Typography>
                </TableCell>
                <TableCell sx={{ ...cellSx, minWidth: 145 }}><SlaBadge status={issue.slaStatus} dueAt={issue.dueAt} showRemaining /></TableCell>
                <TableCell sx={cellSx}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <ThumbUp sx={{ fontSize: 14, color: (issue.voteCount || 0) > 0 ? '#F59E0B' : 'text.disabled' }} />
                    <Typography variant="body2" fontWeight={700}>{issue.voteCount || 0}</Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(issue.createdAt).toLocaleDateString('vi-VN')}
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
        <Stack alignItems="center" sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Pagination count={pag.pages} page={pag.current} onChange={(_, nextPage) => setPage(nextPage)} />
        </Stack>
      )}

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}
        PaperProps={{ sx: { bgcolor: '#FFFFFF', border: '1px solid #DCE7EB', borderRadius: '14px' } }}>
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
        PaperProps={{ sx: { bgcolor: '#FFFFFF', border: '1px solid #DCE7EB', borderRadius: '14px' } }}
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
              <Box sx={{ border: '1px solid #DCE7EB', bgcolor: '#F7FAFA', borderRadius: 2, p: 1.5 }}>
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
