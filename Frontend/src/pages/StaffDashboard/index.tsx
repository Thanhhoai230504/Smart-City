import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination as MuiPagination,
  Paper,
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
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AssignmentInd,
  EditNote,
  FilterAltOff,
  LocationOn,
  OpenInNew,
  PersonOutline,
  PlayCircleOutline,
  Refresh,
  TaskAlt,
  WarningAmber,
} from '@mui/icons-material';
import { RootState } from '../../store/store';
import { issueApi } from '../../api/issueApi';
import { departmentApi } from '../../api/departmentApi';
import {
  Department,
  Issue,
  IssueStatus,
  Pagination,
  PriorityLevel,
  SlaStatus,
} from '../../types';
import { CATEGORY_MAP, PRIORITY_MAP, STATUS_MAP } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';
import SlaBadge from '../../components/SlaBadge';
import PriorityBadge from '../../components/PriorityBadge';
import UpdateStatusDialog from './UpdateStatusDialog';

interface ApiErrorResponse {
  message?: string;
  errors?: Array<{ message: string }>;
}

type StatusFilter = IssueStatus | '';
type SlaFilter = Extract<SlaStatus, 'overdue' | 'due_soon'> | '';
type PriorityFilter = PriorityLevel | '';
type SnackState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};

const PAGE_SIZE = 10;
const EMPTY_PAGINATION: Pagination = {
  current: 1,
  pages: 1,
  total: 0,
  limit: PAGE_SIZE,
};

const panelSx = {
  bgcolor: 'rgba(20,27,45,0.82)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 3,
  backgroundImage: 'none',
};

const headCellSx = {
  color: 'text.secondary',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  borderColor: 'rgba(255,255,255,0.07)',
};

const cellSx = {
  borderColor: 'rgba(255,255,255,0.05)',
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) return fallback;
  return error.response?.data?.errors?.[0]?.message
    || error.response?.data?.message
    || fallback;
};

const getReferenceId = (
  reference?: string | { _id: string } | null,
) => {
  if (!reference) return '';
  return typeof reference === 'string' ? reference : reference._id;
};

const getAssigneeName = (issue: Issue) => {
  if (!issue.assigneeId) return 'Chưa có người nhận';
  return typeof issue.assigneeId === 'string'
    ? 'Cán bộ đã được chỉ định'
    : issue.assigneeId.name;
};

const isOpenIssue = (issue: Issue) => (
  issue.status === 'reported' || issue.status === 'processing'
);

const StaffDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);

  const [department, setDepartment] = useState<Department | null>(null);
  const [departmentError, setDepartmentError] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [slaFilter, setSlaFilter] = useState<SlaFilter>('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('');
  const [sort, setSort] = useState('-priorityScore');
  const [page, setPage] = useState(1);
  const [claimingId, setClaimingId] = useState('');
  const [statusTarget, setStatusTarget] = useState<Issue | null>(null);
  const [snack, setSnack] = useState<SnackState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const isStaff = user?.role === 'staff';
  const currentUserId = user?._id || user?.id || '';
  const departmentId = getReferenceId(user?.departmentId);
  const missingDepartment = isStaff && !departmentId;

  useEffect(() => {
    let active = true;

    const loadDepartment = async () => {
      setDepartmentError('');
      if (!isStaff || !user?.departmentId) {
        setDepartment(null);
        return;
      }

      if (typeof user.departmentId !== 'string') {
        setDepartment(user.departmentId);
        return;
      }

      try {
        const { data } = await departmentApi.getDepartmentById(user.departmentId);
        if (active) setDepartment(data.data.department);
      } catch (requestError) {
        if (active) {
          setDepartmentError(getErrorMessage(
            requestError,
            'Không thể tải thông tin đơn vị.',
          ));
        }
      }
    };

    loadDepartment();
    return () => {
      active = false;
    };
  }, [isStaff, user?.departmentId]);

  const loadIssues = useCallback(async () => {
    if (!user || missingDepartment) {
      setIssues([]);
      setPagination(EMPTY_PAGINATION);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = {
        page,
        limit: PAGE_SIZE,
        sort,
      };
      if (statusFilter) params.status = statusFilter;
      if (slaFilter) params.slaStatus = slaFilter;
      if (priorityFilter) params.priorityLevel = priorityFilter;

      const { data } = await issueApi.getStaffIssues(params);
      setIssues(data.data.issues);
      setPagination({
        ...data.data.pagination,
        pages: Math.max(1, data.data.pagination.pages),
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Không thể tải danh sách công việc.'));
    } finally {
      setLoading(false);
    }
  }, [missingDepartment, page, priorityFilter, slaFilter, sort, statusFilter, user]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const filterDescription = useMemo(() => {
    const parts: string[] = [];
    if (statusFilter) parts.push(STATUS_MAP[statusFilter]?.label || statusFilter);
    if (slaFilter === 'overdue') parts.push('Quá hạn');
    if (slaFilter === 'due_soon') parts.push('Sắp đến hạn');
    if (priorityFilter) parts.push(`Ưu tiên ${PRIORITY_MAP[priorityFilter].label}`);
    return parts.length > 0 ? parts.join(' · ') : 'Tất cả công việc';
  }, [priorityFilter, slaFilter, statusFilter]);

  const handleStatusFilter = (event: SelectChangeEvent<StatusFilter>) => {
    const value = event.target.value as StatusFilter;
    setStatusFilter(value);
    if (value === 'resolved' || value === 'rejected') setSlaFilter('');
    setPage(1);
  };

  const handleSlaFilter = (event: SelectChangeEvent<SlaFilter>) => {
    const value = event.target.value as SlaFilter;
    setSlaFilter(value);
    if (value && (statusFilter === 'resolved' || statusFilter === 'rejected')) {
      setStatusFilter('');
    }
    setPage(1);
  };

  const clearFilters = () => {
    setStatusFilter('');
    setSlaFilter('');
    setPriorityFilter('');
    setSort('-priorityScore');
    setPage(1);
  };

  const handleClaim = async (issue: Issue) => {
    setClaimingId(issue._id);
    try {
      await issueApi.claimIssue(issue._id);
      setSnack({
        open: true,
        message: `Bạn đã nhận xử lý “${issue.title}”.`,
        severity: 'success',
      });
      await loadIssues();
    } catch (requestError) {
      setSnack({
        open: true,
        message: getErrorMessage(requestError, 'Không thể nhận công việc này.'),
        severity: 'error',
      });
      // Một cán bộ khác có thể vừa nhận trước; tải lại để phản ánh trạng thái mới nhất.
      await loadIssues();
    } finally {
      setClaimingId('');
    }
  };

  const handleStatusCompleted = (message: string) => {
    setStatusTarget(null);
    setSnack({ open: true, message, severity: 'success' });
    loadIssues();
  };

  return (
    <Box
      sx={{
        maxWidth: 1500,
        mx: 'auto',
        px: { xs: 1.5, sm: 2.5, lg: 4 },
        py: { xs: 3, md: 4 },
      }}
    >
      <Stack spacing={2.5}>
        <Paper
          elevation={0}
          sx={{
            ...panelSx,
            p: { xs: 2.5, md: 3.5 },
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.05))',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              width: 240,
              height: 240,
              borderRadius: '50%',
              bgcolor: 'rgba(14,165,233,0.08)',
              top: -145,
              right: -60,
            }}
          />
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
            sx={{ position: 'relative' }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 58,
                  height: 58,
                  borderRadius: 3,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'rgba(14,165,233,0.16)',
                  color: 'primary.main',
                  flexShrink: 0,
                }}
              >
                <AssignmentInd fontSize="large" />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight={750}>
                  Cổng cán bộ xử lý sự cố
                </Typography>
                <Typography color="text.secondary">
                  Xin chào {user?.name}. Theo dõi SLA và cập nhật tiến độ công việc tại đây.
                </Typography>
                <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    color="info"
                    variant="outlined"
                    label={isStaff
                      ? department
                        ? `${department.code} — ${department.name}`
                        : departmentId
                          ? 'Đang tải thông tin đơn vị...'
                          : 'Chưa được gán đơn vị'
                      : 'Chế độ quản trị — toàn hệ thống'}
                  />
                  <Chip
                    size="small"
                    icon={<TaskAlt />}
                    label={`${pagination.total} công việc trong bộ lọc`}
                  />
                </Stack>
              </Box>
            </Stack>

            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadIssues}
              disabled={loading || missingDepartment}
            >
              Làm mới
            </Button>
          </Stack>
        </Paper>

        {missingDepartment && (
          <Alert severity="warning" icon={<WarningAmber />}>
            Tài khoản cán bộ của bạn chưa được gán đơn vị xử lý. Vui lòng liên hệ quản trị viên
            trước khi nhận hoặc cập nhật công việc.
          </Alert>
        )}

        {departmentError && (
          <Alert severity="warning">{departmentError}</Alert>
        )}

        {!missingDepartment && (
          <>
            <Paper elevation={0} sx={{ ...panelSx, p: 2 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography fontWeight={700}>Danh sách công việc</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {filterDescription}
                  </Typography>
                </Box>

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                >
                  <FormControl size="small" sx={{ minWidth: 155 }}>
                    <InputLabel id="staff-status-filter-label">Trạng thái</InputLabel>
                    <Select
                      labelId="staff-status-filter-label"
                      value={statusFilter}
                      label="Trạng thái"
                      onChange={handleStatusFilter}
                    >
                      <MenuItem value="">Tất cả</MenuItem>
                      <MenuItem value="reported">Mới báo cáo</MenuItem>
                      <MenuItem value="processing">Đang xử lý</MenuItem>
                      <MenuItem value="resolved">Đã xử lý</MenuItem>
                      <MenuItem value="rejected">Từ chối</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 145 }}>
                    <InputLabel id="staff-priority-filter-label">Ưu tiên</InputLabel>
                    <Select
                      labelId="staff-priority-filter-label"
                      value={priorityFilter}
                      label="Ưu tiên"
                      onChange={(event: SelectChangeEvent<PriorityFilter>) => {
                        setPriorityFilter(event.target.value as PriorityFilter);
                        setPage(1);
                      }}
                    >
                      <MenuItem value="">Tất cả</MenuItem>
                      {Object.entries(PRIORITY_MAP).map(([value, item]) => (
                        <MenuItem key={value} value={value}>{item.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 155 }}>
                    <InputLabel id="staff-sla-filter-label">Tình trạng SLA</InputLabel>
                    <Select
                      labelId="staff-sla-filter-label"
                      value={slaFilter}
                      label="Tình trạng SLA"
                      onChange={handleSlaFilter}
                    >
                      <MenuItem value="">Tất cả</MenuItem>
                      <MenuItem value="overdue">Quá hạn</MenuItem>
                      <MenuItem value="due_soon">Sắp đến hạn</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 155 }}>
                    <InputLabel id="staff-sort-label">Sắp xếp</InputLabel>
                    <Select
                      labelId="staff-sort-label"
                      value={sort}
                      label="Sắp xếp"
                      onChange={(event: SelectChangeEvent) => {
                        setSort(event.target.value);
                        setPage(1);
                      }}
                    >
                      <MenuItem value="-priorityScore">Ưu tiên cao nhất</MenuItem>
                      <MenuItem value="-createdAt">Mới nhất</MenuItem>
                      <MenuItem value="createdAt">Cũ nhất</MenuItem>
                      <MenuItem value="-voteCount">Nhiều ủng hộ nhất</MenuItem>
                      <MenuItem value="dueAt">Hạn gần nhất</MenuItem>
                    </Select>
                  </FormControl>

                  {(statusFilter || slaFilter || priorityFilter || sort !== '-priorityScore') && (
                    <Tooltip title="Xóa bộ lọc">
                      <IconButton onClick={clearFilters} aria-label="Xóa bộ lọc">
                        <FilterAltOff />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Stack>
            </Paper>

            {error && (
              <Alert
                severity="error"
                action={(
                  <Button color="inherit" size="small" onClick={loadIssues}>
                    Thử lại
                  </Button>
                )}
              >
                {error}
              </Alert>
            )}

            <Paper elevation={0} sx={{ ...panelSx, overflow: 'hidden' }}>
              <TableContainer>
                <Table sx={{ minWidth: 1240 }} aria-label="Danh sách công việc của đơn vị">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={headCellSx}>Sự cố</TableCell>
                      <TableCell sx={headCellSx}>Loại</TableCell>
                      <TableCell sx={headCellSx}>Trạng thái</TableCell>
                      <TableCell sx={headCellSx}>Ưu tiên</TableCell>
                      <TableCell sx={headCellSx}>SLA</TableCell>
                      <TableCell sx={headCellSx}>Cán bộ nhận việc</TableCell>
                      <TableCell sx={headCellSx}>Hạn xử lý</TableCell>
                      <TableCell align="right" sx={headCellSx}>Thao tác</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {Array.from({ length: 8 }).map((__, cellIndex) => (
                            <TableCell key={cellIndex} sx={cellSx}>
                              <Skeleton height={30} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : issues.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ ...cellSx, py: 8 }}>
                          <AssignmentInd sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                          <Typography color="text.secondary">
                            Không có công việc phù hợp với bộ lọc.
                          </Typography>
                          {(statusFilter || slaFilter || priorityFilter) && (
                            <Button
                              size="small"
                              startIcon={<FilterAltOff />}
                              onClick={clearFilters}
                              sx={{ mt: 1 }}
                            >
                              Xóa bộ lọc
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      issues.map((issue) => {
                        const category = CATEGORY_MAP[issue.category];
                        const status = STATUS_MAP[issue.status];
                        const assigneeId = getReferenceId(issue.assigneeId);
                        const isMine = Boolean(assigneeId && assigneeId === currentUserId);
                        const open = isOpenIssue(issue);
                        const canClaim = isStaff && open && !assigneeId;
                        const canUpdate = open && (
                          user?.role === 'admin'
                          || (isStaff && isMine)
                        );

                        return (
                          <TableRow
                            key={issue._id}
                            hover
                            sx={{ '&:hover': { bgcolor: 'rgba(14,165,233,0.035)' } }}
                          >
                            <TableCell sx={{ ...cellSx, maxWidth: 315 }}>
                              <Typography variant="body2" fontWeight={700} noWrap>
                                {issue.title}
                              </Typography>
                              <Stack direction="row" spacing={0.5} alignItems="center" mt={0.35}>
                                <LocationOn sx={{ fontSize: 14, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {issue.location}
                                </Typography>
                              </Stack>
                              <Typography variant="caption" color="text.disabled">
                                Báo lúc {formatDate(issue.createdAt)}
                              </Typography>
                            </TableCell>

                            <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                              <PriorityBadge issue={issue} />
                            </TableCell>

                            <TableCell sx={cellSx}>
                              <Chip
                                size="small"
                                label={`${category?.icon || '📌'} ${category?.label || issue.category}`}
                                sx={{
                                  bgcolor: `${category?.color || '#64748B'}18`,
                                  color: category?.color || 'text.secondary',
                                  border: `1px solid ${category?.color || '#64748B'}38`,
                                }}
                              />
                            </TableCell>

                            <TableCell sx={cellSx}>
                              <Chip
                                size="small"
                                label={status?.label || issue.status}
                                sx={{
                                  bgcolor: `${status?.color || '#64748B'}18`,
                                  color: status?.color || 'text.secondary',
                                  border: `1px solid ${status?.color || '#64748B'}38`,
                                  fontWeight: 650,
                                }}
                              />
                            </TableCell>

                            <TableCell sx={cellSx}>
                              <SlaBadge
                                status={issue.slaStatus}
                                dueAt={issue.dueAt}
                                showRemaining
                              />
                            </TableCell>

                            <TableCell sx={cellSx}>
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <PersonOutline
                                  sx={{
                                    fontSize: 18,
                                    color: isMine ? 'success.main' : 'text.secondary',
                                  }}
                                />
                                <Box>
                                  <Typography
                                    variant="body2"
                                    color={!assigneeId ? 'text.secondary' : 'text.primary'}
                                  >
                                    {getAssigneeName(issue)}
                                  </Typography>
                                  {isMine && (
                                    <Typography variant="caption" color="success.main">
                                      Việc của bạn
                                    </Typography>
                                  )}
                                </Box>
                              </Stack>
                            </TableCell>

                            <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                              <Typography
                                variant="body2"
                                color={issue.slaStatus === 'overdue' ? 'error.main' : 'text.primary'}
                                fontWeight={issue.slaStatus === 'overdue' ? 700 : 400}
                              >
                                {issue.dueAt ? formatDate(issue.dueAt) : 'Chưa có hạn'}
                              </Typography>
                            </TableCell>

                            <TableCell align="right" sx={cellSx}>
                              <Stack
                                direction="row"
                                spacing={0.75}
                                justifyContent="flex-end"
                                alignItems="center"
                              >
                                {canClaim && (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    startIcon={claimingId === issue._id
                                      ? <CircularProgress size={16} color="inherit" />
                                      : <PlayCircleOutline />}
                                    disabled={Boolean(claimingId)}
                                    onClick={() => handleClaim(issue)}
                                  >
                                    Nhận việc
                                  </Button>
                                )}

                                {canUpdate && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<EditNote />}
                                    onClick={() => setStatusTarget(issue)}
                                  >
                                    Cập nhật
                                  </Button>
                                )}

                                <Tooltip title="Xem chi tiết">
                                  <IconButton
                                    size="small"
                                    aria-label={`Xem chi tiết ${issue.title}`}
                                    onClick={() => navigate(`/issues/${issue._id}`)}
                                  >
                                    <OpenInNew fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
                sx={{
                  px: 2.5,
                  py: 2,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Tổng cộng {pagination.total} công việc
                </Typography>
                {pagination.pages > 1 && (
                  <MuiPagination
                    count={pagination.pages}
                    page={Math.min(page, pagination.pages)}
                    onChange={(_, nextPage) => setPage(nextPage)}
                    color="primary"
                    size="small"
                  />
                )}
              </Stack>
            </Paper>
          </>
        )}
      </Stack>

      <UpdateStatusDialog
        issue={statusTarget}
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onCompleted={handleStatusCompleted}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          variant="filled"
          severity={snack.severity}
          onClose={() => setSnack((current) => ({ ...current, open: false }))}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default StaffDashboard;
