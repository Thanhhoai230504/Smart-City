import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  SelectChangeEvent,
  Skeleton,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AssignmentTurnedIn,
  LinkOff,
  OpenInNew,
  Refresh,
  ThumbUp,
} from '@mui/icons-material';
import { issueApi } from '../../api/issueApi';
import { departmentApi } from '../../api/departmentApi';
import {
  DepartmentStaff,
  DepartmentSuggestion,
  Issue,
  Pagination as PaginationData,
  PriorityLevel,
} from '../../types';
import { CATEGORY_MAP, PRIORITY_MAP } from '../../utils/constants';
import SlaBadge from '../../components/SlaBadge';
import PriorityBadge from '../../components/PriorityBadge';
import { cellSx, GlassCard, headCellSx } from './types';

interface ApiErrorResponse {
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

type SnackState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};

const PAGE_SIZE = 8;
const EMPTY_PAGINATION: PaginationData = {
  current: 1,
  pages: 1,
  total: 0,
  limit: PAGE_SIZE,
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) return fallback;
  return error.response?.data?.errors?.[0]?.message
    || error.response?.data?.message
    || fallback;
};

const getDepartmentLabel = (issue: Issue) => {
  if (!issue.departmentId) return '—';
  if (typeof issue.departmentId === 'string') return issue.departmentId;
  return `${issue.departmentId.code} — ${issue.departmentId.name}`;
};

const getAssigneeName = (issue: Issue) => {
  if (!issue.assigneeId) return 'Chưa chỉ định';
  return typeof issue.assigneeId === 'string'
    ? issue.assigneeId
    : issue.assigneeId.name;
};

const AssignmentManagement: React.FC = () => {
  const navigate = useNavigate();
  const [panel, setPanel] = useState(0);
  const [queue, setQueue] = useState<Issue[]>([]);
  const [assignedIssues, setAssignedIssues] = useState<Issue[]>([]);
  const [queuePagination, setQueuePagination] = useState<PaginationData>(EMPTY_PAGINATION);
  const [assignedPagination, setAssignedPagination] = useState<PaginationData>(EMPTY_PAGINATION);
  const [queueLoading, setQueueLoading] = useState(true);
  const [assignedLoading, setAssignedLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | ''>('');
  const [recalculating, setRecalculating] = useState(false);

  const [assignTarget, setAssignTarget] = useState<Issue | null>(null);
  const [suggestions, setSuggestions] = useState<DepartmentSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [staff, setStaff] = useState<DepartmentStaff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [unassignTarget, setUnassignTarget] = useState<Issue | null>(null);
  const [unassignNote, setUnassignNote] = useState('');
  const [unassigning, setUnassigning] = useState(false);

  const [snack, setSnack] = useState<SnackState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadQueue = useCallback(async (page = 1) => {
    setQueueLoading(true);
    try {
      const { data } = await issueApi.getUnassignedQueue({
        page,
        limit: PAGE_SIZE,
        priorityLevel: priorityFilter || undefined,
      });
      setQueue(data.data.issues);
      setQueuePagination(data.data.pagination);
    } catch (error) {
      setSnack({
        open: true,
        message: getErrorMessage(error, 'Không thể tải hàng chờ phân công.'),
        severity: 'error',
      });
    } finally {
      setQueueLoading(false);
    }
  }, [priorityFilter]);

  const loadAssignedIssues = useCallback(async (page = 1) => {
    setAssignedLoading(true);
    try {
      const { data } = await issueApi.getIssues({
        assigned: 'true',
        status: 'processing',
        sort: '-priorityScore',
        page,
        limit: PAGE_SIZE,
      });
      setAssignedIssues(data.data.issues);
      setAssignedPagination(data.data.pagination);
    } catch (error) {
      setSnack({
        open: true,
        message: getErrorMessage(error, 'Không thể tải danh sách đã phân công.'),
        severity: 'error',
      });
    } finally {
      setAssignedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
    loadAssignedIssues();
  }, [loadAssignedIssues, loadQueue]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const { data } = await issueApi.recalculatePriorityBatch();
      setSnack({
        open: true,
        message: `Đã cập nhật ${data.data.updated}/${data.data.scanned} sự cố${data.data.failed ? `, ${data.data.failed} lỗi` : ''}.`,
        severity: data.data.failed ? 'error' : 'success',
      });
      await Promise.all([loadQueue(1), loadAssignedIssues(1)]);
    } catch (error) {
      setSnack({
        open: true,
        message: getErrorMessage(error, 'Không thể tính lại điểm ưu tiên.'),
        severity: 'error',
      });
    } finally {
      setRecalculating(false);
    }
  };

  const loadDepartmentStaff = async (departmentId: string) => {
    setSelectedAssigneeId('');
    setStaff([]);
    if (!departmentId) return;

    setStaffLoading(true);
    try {
      const { data } = await departmentApi.getStaff(departmentId);
      setStaff(data.data.staff);
    } catch (error) {
      setSnack({
        open: true,
        message: getErrorMessage(error, 'Không thể tải cán bộ của đơn vị.'),
        severity: 'error',
      });
    } finally {
      setStaffLoading(false);
    }
  };

  const openAssignmentDialog = async (issue: Issue) => {
    setAssignTarget(issue);
    setSuggestions([]);
    setSuggestionError('');
    setSelectedDepartmentId('');
    setStaff([]);
    setSelectedAssigneeId('');
    setAssignmentNote('');
    setSuggestionsLoading(true);

    try {
      const { data } = await departmentApi.suggestForCategory(issue.category);
      const departments = data.data.departments;
      setSuggestions(departments);

      if (departments.length === 1) {
        setSelectedDepartmentId(departments[0]._id);
        await loadDepartmentStaff(departments[0]._id);
      }
    } catch (error) {
      setSuggestionError(getErrorMessage(error, 'Không thể lấy gợi ý đơn vị.'));
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const closeAssignmentDialog = () => {
    if (assigning) return;
    setAssignTarget(null);
    setSuggestions([]);
    setSelectedDepartmentId('');
    setStaff([]);
    setSelectedAssigneeId('');
    setAssignmentNote('');
    setSuggestionError('');
  };

  const handleDepartmentChange = async (event: SelectChangeEvent) => {
    const departmentId = event.target.value;
    setSelectedDepartmentId(departmentId);
    await loadDepartmentStaff(departmentId);
  };

  const handleAssign = async () => {
    if (!assignTarget || !selectedDepartmentId) return;

    setAssigning(true);
    try {
      await issueApi.assignIssue(assignTarget._id, {
        departmentId: selectedDepartmentId,
        assigneeId: selectedAssigneeId || undefined,
        note: assignmentNote.trim() || undefined,
      });

      const nextQueuePage = queue.length === 1 && queuePagination.current > 1
        ? queuePagination.current - 1
        : queuePagination.current;
      setAssignTarget(null);
      setSnack({
        open: true,
        message: 'Đã phân công sự cố và bắt đầu tính SLA.',
        severity: 'success',
      });
      await Promise.all([
        loadQueue(nextQueuePage),
        loadAssignedIssues(1),
      ]);
    } catch (error) {
      setSnack({
        open: true,
        message: getErrorMessage(error, 'Không thể phân công sự cố.'),
        severity: 'error',
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async () => {
    if (!unassignTarget) return;

    const target = unassignTarget;
    setUnassigning(true);
    try {
      await issueApi.unassignIssue(target._id, unassignNote.trim() || undefined);
      const nextAssignedPage = assignedIssues.length === 1 && assignedPagination.current > 1
        ? assignedPagination.current - 1
        : assignedPagination.current;
      setUnassignTarget(null);
      setUnassignNote('');
      setSnack({
        open: true,
        message: 'Đã thu hồi phân công và đưa sự cố về hàng chờ.',
        severity: 'success',
      });
      await Promise.all([
        loadQueue(1),
        loadAssignedIssues(nextAssignedPage),
      ]);
    } catch (error) {
      setSnack({
        open: true,
        message: getErrorMessage(error, 'Không thể thu hồi phân công.'),
        severity: 'error',
      });
    } finally {
      setUnassigning(false);
    }
  };

  const selectedSuggestion = suggestions.find(
    (department) => department._id === selectedDepartmentId,
  );

  return (
    <>
      <GlassCard>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          gap={1.5}
        >
          <Box>
            <Typography variant="h6" fontWeight={600}>📋 Phân công xử lý sự cố</Typography>
            <Typography variant="body2" color="text.secondary">
              Xếp hàng theo điểm ưu tiên minh bạch và theo dõi hạn xử lý sau phân công.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
            <Button
              variant="contained"
              size="small"
              disabled={recalculating || queueLoading}
              onClick={handleRecalculate}
              startIcon={recalculating ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {recalculating ? 'Đang tính...' : 'Tính lại ưu tiên'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
              disabled={queueLoading || assignedLoading}
              onClick={() => Promise.all([
                loadQueue(queuePagination.current),
                loadAssignedIssues(assignedPagination.current),
              ])}
            >
              Làm mới
            </Button>
          </Stack>
        </Stack>

        <Tabs
          value={panel}
          onChange={(_, value: number) => setPanel(value)}
          sx={{ mt: 2, borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Tab label={`Chờ phân công (${queuePagination.total})`} />
          <Tab label={`Đã phân công (${assignedPagination.total})`} />
        </Tabs>

        {panel === 0 ? (
          <>
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel id="admin-priority-filter-label">Mức ưu tiên</InputLabel>
                <Select
                  labelId="admin-priority-filter-label"
                  value={priorityFilter}
                  label="Mức ưu tiên"
                  onChange={(event: SelectChangeEvent<PriorityLevel | ''>) => {
                    setPriorityFilter(event.target.value as PriorityLevel | '');
                  }}
                >
                  <MenuItem value="">Tất cả</MenuItem>
                  {Object.entries(PRIORITY_MAP).map(([value, item]) => (
                    <MenuItem key={value} value={value}>{item.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TableContainer sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Hạng', 'Điểm ưu tiên', 'Sự cố', 'Loại', 'Vị trí', 'Đồng thuận', 'Ngày báo', 'Thao tác'].map((heading) => (
                      <TableCell key={heading} sx={headCellSx}>{heading}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {queueLoading ? [...Array(4)].map((_, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {[...Array(8)].map((__, cellIndex) => (
                        <TableCell key={cellIndex} sx={cellSx}>
                          <Skeleton
                            variant="rounded"
                            height={cellIndex === 2 ? 22 : 15}
                            width={cellIndex === 1 ? '85%' : '60%'}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  )) : queue.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ ...cellSx, textAlign: 'center', py: 6 }}>
                        <AssignmentTurnedIn sx={{ fontSize: 46, color: '#10B981', mb: 1 }} />
                        <Typography color="text.secondary">
                          Không còn sự cố chờ phân công.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : queue.map((issue, index) => {
                    const priority = (queuePagination.current - 1) * PAGE_SIZE + index + 1;
                    const category = CATEGORY_MAP[issue.category];
                    return (
                      <TableRow
                        key={issue._id}
                        hover
                        sx={{ '&:hover': { bgcolor: 'rgba(14,165,233,0.04)' } }}
                      >
                        <TableCell sx={cellSx}>
                          <Chip
                            size="small"
                            label={`#${priority}`}
                            sx={{
                              height: 23,
                              fontWeight: 700,
                              bgcolor: priority <= 3 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                              color: priority <= 3 ? '#FCA5A5' : 'text.secondary',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                          <PriorityBadge issue={issue} />
                        </TableCell>
                        <TableCell sx={{ ...cellSx, minWidth: 210, maxWidth: 300 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>{issue.title}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {typeof issue.userId === 'string' ? 'Người dân' : issue.userId.name}
                          </Typography>
                        </TableCell>
                        <TableCell sx={cellSx}>
                          <Chip
                            size="small"
                            label={`${category.icon} ${category.label}`}
                            sx={{
                              height: 23,
                              fontSize: '0.7rem',
                              bgcolor: `${category.color}1F`,
                              color: category.color,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ ...cellSx, maxWidth: 250 }}>
                          <Typography variant="caption" noWrap display="block">{issue.location}</Typography>
                        </TableCell>
                        <TableCell sx={cellSx}>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <ThumbUp sx={{ fontSize: 16, color: '#F59E0B' }} />
                            <Typography fontWeight={700} color="#F59E0B">
                              {issue.voteCount || 0}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(issue.createdAt).toLocaleDateString('vi-VN')}
                          </Typography>
                        </TableCell>
                        <TableCell sx={cellSx}>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Xem chi tiết">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/issues/${issue._id}`)}
                                sx={{ color: '#0EA5E9' }}
                              >
                                <OpenInNew fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => openAssignmentDialog(issue)}
                              sx={{ whiteSpace: 'nowrap', textTransform: 'none' }}
                            >
                              Phân công
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {queuePagination.pages > 1 && (
              <Stack alignItems="center" mt={2}>
                <Pagination
                  count={queuePagination.pages}
                  page={queuePagination.current}
                  onChange={(_, page) => loadQueue(page)}
                />
              </Stack>
            )}
          </>
        ) : (
          <>
            <TableContainer sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Sự cố', 'Ưu tiên', 'Đơn vị', 'Cán bộ', 'Phân công lúc', 'SLA', 'Thao tác'].map((heading) => (
                      <TableCell key={heading} sx={headCellSx}>{heading}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assignedLoading ? [...Array(4)].map((_, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {[...Array(7)].map((__, cellIndex) => (
                        <TableCell key={cellIndex} sx={cellSx}>
                          <Skeleton
                            variant="rounded"
                            height={cellIndex === 4 ? 23 : 15}
                            width={cellIndex === 0 ? '85%' : '65%'}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  )) : assignedIssues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ ...cellSx, textAlign: 'center', py: 6 }}>
                        <Typography color="text.secondary">
                          Chưa có sự cố đang được đơn vị xử lý.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : assignedIssues.map((issue) => (
                    <TableRow
                      key={issue._id}
                      hover
                      sx={{ '&:hover': { bgcolor: 'rgba(14,165,233,0.04)' } }}
                    >
                      <TableCell sx={{ ...cellSx, minWidth: 210, maxWidth: 300 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{issue.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {CATEGORY_MAP[issue.category].icon} {CATEGORY_MAP[issue.category].label}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                        <PriorityBadge issue={issue} />
                      </TableCell>
                      <TableCell sx={{ ...cellSx, minWidth: 180 }}>
                        <Typography variant="caption">{getDepartmentLabel(issue)}</Typography>
                      </TableCell>
                      <TableCell sx={{ ...cellSx, minWidth: 140 }}>
                        <Typography variant="caption">{getAssigneeName(issue)}</Typography>
                      </TableCell>
                      <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                        <Typography variant="caption" color="text.secondary">
                          {issue.assignedAt
                            ? new Date(issue.assignedAt).toLocaleString('vi-VN')
                            : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ ...cellSx, minWidth: 155 }}>
                        <SlaBadge
                          status={issue.slaStatus}
                          dueAt={issue.dueAt}
                          showRemaining
                        />
                      </TableCell>
                      <TableCell sx={cellSx}>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Xem chi tiết">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/issues/${issue._id}`)}
                              sx={{ color: '#0EA5E9' }}
                            >
                              <OpenInNew fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Thu hồi phân công">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setUnassignTarget(issue);
                                setUnassignNote('');
                              }}
                              sx={{ color: '#EF4444' }}
                            >
                              <LinkOff fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {assignedPagination.pages > 1 && (
              <Stack alignItems="center" mt={2}>
                <Pagination
                  count={assignedPagination.pages}
                  page={assignedPagination.current}
                  onChange={(_, page) => loadAssignedIssues(page)}
                />
              </Stack>
            )}
          </>
        )}
      </GlassCard>

      <Dialog
        open={!!assignTarget}
        onClose={closeAssignmentDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: '#1A2332',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
          },
        }}
      >
        <DialogTitle>Phân công sự cố</DialogTitle>
        <DialogContent>
          {assignTarget && (
            <Stack spacing={2.25} mt={0.5}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: '10px',
                  bgcolor: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Typography fontWeight={600}>{assignTarget.title}</Typography>
                <Stack direction="row" spacing={1} mt={0.75} flexWrap="wrap">
                  <Chip
                    size="small"
                    label={`${CATEGORY_MAP[assignTarget.category].icon} ${CATEGORY_MAP[assignTarget.category].label}`}
                  />
                  <PriorityBadge issue={assignTarget} />
                  <Chip
                    size="small"
                    icon={<ThumbUp />}
                    label={`${assignTarget.voteCount || 0} lượt đồng thuận`}
                  />
                </Stack>
              </Box>

              {suggestionError && <Alert severity="error">{suggestionError}</Alert>}

              {suggestionsLoading ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={20} />
                  <Typography color="text.secondary">Đang tìm đơn vị phù hợp...</Typography>
                </Stack>
              ) : suggestions.length === 0 && !suggestionError ? (
                <Alert severity="warning">
                  Chưa có đơn vị đang hoạt động phụ trách loại sự cố này.
                  Hãy cấu hình loại phụ trách trong tab “Đơn vị xử lý”.
                </Alert>
              ) : (
                <FormControl fullWidth>
                  <InputLabel id="assignment-department-label">Đơn vị xử lý</InputLabel>
                  <Select
                    labelId="assignment-department-label"
                    value={selectedDepartmentId}
                    label="Đơn vị xử lý"
                    onChange={handleDepartmentChange}
                  >
                    {suggestions.map((department) => (
                      <MenuItem key={department._id} value={department._id}>
                        ⭐ {department.code} — {department.name} · SLA {department.slaHoursEffective} giờ
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {selectedSuggestion && (
                <Alert severity="info">
                  SLA hiệu lực: <strong>{selectedSuggestion.slaHoursEffective} giờ</strong> kể từ lúc phân công
                  {selectedSuggestion.slaHours
                    ? ` (đơn vị ghi đè ${selectedSuggestion.slaHours} giờ).`
                    : ' (theo loại sự cố).'}
                </Alert>
              )}

              <FormControl fullWidth disabled={!selectedDepartmentId || staffLoading}>
                <InputLabel id="assignment-staff-label">Cán bộ phụ trách (tuỳ chọn)</InputLabel>
                <Select
                  labelId="assignment-staff-label"
                  value={selectedAssigneeId}
                  label="Cán bộ phụ trách (tuỳ chọn)"
                  onChange={(event: SelectChangeEvent) => setSelectedAssigneeId(event.target.value)}
                >
                  <MenuItem value="">Không chỉ định — đơn vị tự nhận việc</MenuItem>
                  {staff.map((member) => (
                    <MenuItem key={member._id} value={member._id}>
                      {member.name} — {member.email}
                    </MenuItem>
                  ))}
                </Select>
                {staffLoading && (
                  <Typography variant="caption" color="text.secondary" mt={0.75}>
                    Đang tải cán bộ...
                  </Typography>
                )}
                {!staffLoading && selectedDepartmentId && staff.length === 0 && (
                  <Typography variant="caption" color="warning.main" mt={0.75}>
                    Đơn vị chưa có cán bộ hoạt động; thông báo vẫn được gửi tới email chung của đơn vị.
                  </Typography>
                )}
              </FormControl>

              <TextField
                label="Ghi chú phân công"
                multiline
                minRows={3}
                value={assignmentNote}
                inputProps={{ maxLength: 500 }}
                helperText={`${assignmentNote.length}/500`}
                onChange={(event) => setAssignmentNote(event.target.value)}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={closeAssignmentDialog} disabled={assigning} sx={{ color: 'text.secondary' }}>
            Huỷ
          </Button>
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={!selectedDepartmentId || assigning || suggestionsLoading}
            startIcon={assigning ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {assigning ? 'Đang phân công...' : 'Xác nhận phân công'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!unassignTarget}
        onClose={() => {
          if (!unassigning) setUnassignTarget(null);
        }}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            bgcolor: '#1A2332',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
          },
        }}
      >
        <DialogTitle>Thu hồi phân công?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            <Alert severity="warning">
              Sự cố “{unassignTarget?.title}” sẽ trở lại hàng chờ và hạn SLA hiện tại sẽ bị xoá.
            </Alert>
            <TextField
              label="Lý do thu hồi (tuỳ chọn)"
              multiline
              minRows={3}
              value={unassignNote}
              inputProps={{ maxLength: 500 }}
              helperText={`${unassignNote.length}/500`}
              onChange={(event) => setUnassignNote(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setUnassignTarget(null)}
            disabled={unassigning}
            sx={{ color: 'text.secondary' }}
          >
            Huỷ
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleUnassign}
            disabled={unassigning}
            startIcon={unassigning ? <CircularProgress size={16} color="inherit" /> : <LinkOff />}
          >
            {unassigning ? 'Đang thu hồi...' : 'Thu hồi'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={6000}
        onClose={() => setSnack((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={() => setSnack((current) => ({ ...current, open: false }))}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default AssignmentManagement;
