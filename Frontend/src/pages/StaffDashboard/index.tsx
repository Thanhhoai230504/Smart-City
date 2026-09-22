import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination as MuiPagination,
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
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AssignmentIndOutlined,
  EditNote,
  FilterAltOff,
  LocationOn,
  OpenInNew,
  PersonOutline,
  PlayCircleOutline,
  Refresh,
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
import PriorityBadge from '../../components/PriorityBadge';
import SlaBadge from '../../components/SlaBadge';
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

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'reported', label: 'Mới báo' },
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Đã xử lý' },
  { value: 'rejected', label: 'Từ chối' },
];

const panelSx = {
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1.5,
  boxShadow: 'none',
  backgroundImage: 'none',
};

const headCellSx = {
  py: 1.5,
  color: 'text.secondary',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  borderColor: 'divider',
  bgcolor: '#F2F5F7',
};

const cellSx = {
  py: 1.6,
  borderColor: 'divider',
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

const CategoryIndicator: React.FC<{ issue: Issue }> = ({ issue }) => {
  const category = CATEGORY_MAP[issue.category] || CATEGORY_MAP.other;

  return (
    <Stack direction="row" spacing={0.8} alignItems="center">
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: category.color, flexShrink: 0 }} />
      <Typography variant="body2" color="text.secondary" whiteSpace="nowrap">
        {category.label}
      </Typography>
    </Stack>
  );
};

const StatusIndicator: React.FC<{ issue: Issue }> = ({ issue }) => {
  const status = STATUS_MAP[issue.status] || STATUS_MAP.reported;

  return (
    <Stack direction="row" spacing={0.8} alignItems="center">
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: status.color, flexShrink: 0 }} />
      <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
        {status.label}
      </Typography>
    </Stack>
  );
};

const WorkActions: React.FC<{
  issue: Issue;
  canClaim: boolean;
  canUpdate: boolean;
  claimingId: string;
  onClaim: (issue: Issue) => void;
  onUpdate: (issue: Issue) => void;
  onView: (issue: Issue) => void;
}> = ({
  issue,
  canClaim,
  canUpdate,
  claimingId,
  onClaim,
  onUpdate,
  onView,
}) => (
  <Stack direction="row" spacing={0.75} justifyContent="flex-end" alignItems="center">
    {canClaim && (
      <Button
        size="small"
        variant="contained"
        color="success"
        startIcon={claimingId === issue._id
          ? <CircularProgress size={15} color="inherit" />
          : <PlayCircleOutline />}
        disabled={Boolean(claimingId)}
        onClick={() => onClaim(issue)}
        sx={{ whiteSpace: 'nowrap' }}
      >
        Nhận việc
      </Button>
    )}

    {canUpdate && (
      <Button
        size="small"
        variant="outlined"
        startIcon={<EditNote />}
        onClick={() => onUpdate(issue)}
        sx={{ whiteSpace: 'nowrap' }}
      >
        Cập nhật
      </Button>
    )}

    <Tooltip title="Xem chi tiết">
      <IconButton
        size="small"
        aria-label={`Xem chi tiết ${issue.title}`}
        onClick={() => onView(issue)}
      >
        <OpenInNew fontSize="small" />
      </IconButton>
    </Tooltip>
  </Stack>
);

interface StaffDashboardProps {
  embedded?: boolean;
}

const StaffDashboard: React.FC<StaffDashboardProps> = ({ embedded = false }) => {
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

  const pageSummary = useMemo(() => ({
    unassigned: issues.filter((issue) => isOpenIssue(issue) && !issue.assigneeId).length,
    overdue: issues.filter((issue) => issue.slaStatus === 'overdue').length,
    dueSoon: issues.filter((issue) => issue.slaStatus === 'due_soon').length,
  }), [issues]);

  const departmentLabel = isStaff
    ? department
      ? `${department.code} — ${department.name}`
      : departmentId
        ? 'Đang tải thông tin đơn vị...'
        : 'Chưa được gán đơn vị'
    : 'Quản trị viên · Toàn hệ thống';

  const handleStatusFilter = (nextStatus: StatusFilter) => {
    setStatusFilter(nextStatus);
    if (nextStatus === 'resolved' || nextStatus === 'rejected') setSlaFilter('');
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

  const getPermissions = (issue: Issue) => {
    const assigneeId = getReferenceId(issue.assigneeId);
    const isMine = Boolean(assigneeId && assigneeId === currentUserId);
    const open = isOpenIssue(issue);
    return {
      assigneeId,
      isMine,
      canClaim: isStaff && open && !assigneeId,
      canUpdate: open && (
        user?.role === 'admin'
        || (isStaff && isMine)
      ),
    };
  };

  return (
    <Box
      sx={{
        maxWidth: embedded ? 'none' : 1500,
        mx: 'auto',
        px: embedded ? 0 : { xs: 1.5, sm: 2.5, lg: 4 },
        py: embedded ? 0 : { xs: 2.5, md: 4 },
      }}
    >
      <Stack spacing={2.5}>
        {!embedded && (
          <Box
            component="header"
            sx={{
              pb: 3,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ sm: 'flex-end' }}
              justifyContent="space-between"
            >
              <Box>
                <Typography variant="body2" color="primary.main" fontWeight={700} mb={0.75}>
                  Bàn điều phối công việc
                </Typography>
                <Typography variant="h3" component="h1" mb={0.65}>
                  Công việc của đơn vị
                </Typography>
                <Typography color="text.secondary" mb={0.75}>
                  {user?.name}, theo dõi thứ tự ưu tiên, SLA và tiến độ xử lý tại đây.
                </Typography>
                <Typography variant="body2" fontWeight={650} color="text.primary">
                  {departmentLabel}
                </Typography>
              </Box>

              <Stack direction="row" spacing={2.5} alignItems="center">
                <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                  <Typography variant="h5" component="p">
                    {loading ? '—' : pagination.total}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    công việc phù hợp
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadIssues}
                  disabled={loading || missingDepartment}
                >
                  Làm mới
                </Button>
              </Stack>
            </Stack>
          </Box>
        )}

        {missingDepartment && (
          <Alert severity="warning" icon={<WarningAmber />}>
            Tài khoản cán bộ của bạn chưa được gán đơn vị xử lý. Vui lòng liên hệ quản trị viên trước khi nhận hoặc cập nhật công việc.
          </Alert>
        )}

        {departmentError && (
          <Alert severity="warning">{departmentError}</Alert>
        )}

        {!missingDepartment && (
          <>
            <Box
              component="section"
              aria-label="Tổng quan hàng đợi công việc"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
                bgcolor: 'background.paper',
                borderLeft: '1px solid',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              {[
                {
                  label: 'Trong bộ lọc',
                  value: loading ? '—' : pagination.total,
                  note: 'tổng số công việc',
                  color: '#172B3A',
                },
                {
                  label: 'Chưa có người nhận',
                  value: loading ? '—' : pageSummary.unassigned,
                  note: 'trên trang hiện tại',
                  color: pageSummary.unassigned > 0 ? '#B26A00' : '#172B3A',
                },
                {
                  label: 'Đã quá hạn',
                  value: loading ? '—' : pageSummary.overdue,
                  note: 'trên trang hiện tại',
                  color: pageSummary.overdue > 0 ? '#C62828' : '#172B3A',
                },
                {
                  label: 'Sắp đến hạn',
                  value: loading ? '—' : pageSummary.dueSoon,
                  note: 'trên trang hiện tại',
                  color: pageSummary.dueSoon > 0 ? '#B26A00' : '#172B3A',
                },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    p: { xs: 1.75, md: 2.25 },
                    borderTop: '1px solid',
                    borderRight: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                  <Typography variant="h5" component="p" color={item.color} my={0.25}>
                    {item.value}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">{item.note}</Typography>
                </Box>
              ))}
            </Box>

            <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              <Tabs
                value={statusFilter}
                onChange={(_, nextStatus: StatusFilter) => handleStatusFilter(nextStatus)}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="Lọc công việc theo trạng thái"
              >
                {STATUS_TABS.map((item) => (
                  <Tab key={item.value || 'all'} value={item.value} label={item.label} />
                ))}
              </Tabs>
            </Box>

            <Box component="section" aria-label="Bộ lọc công việc" sx={{ ...panelSx, p: 2 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'minmax(220px, 1fr) 160px 170px',
                    lg: 'minmax(240px, 1fr) 160px 170px 205px auto',
                  },
                  gap: 1.25,
                  alignItems: 'center',
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Box minWidth={0}>
                      <Typography fontWeight={700}>Danh sách nhiệm vụ</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {filterDescription}
                      </Typography>
                    </Box>
                    {embedded && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={loadIssues}
                        disabled={loading || missingDepartment}
                        sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        Làm mới
                      </Button>
                    )}
                  </Stack>
                </Box>

                <FormControl size="small">
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
                    <MenuItem value="">Tất cả mức</MenuItem>
                    {Object.entries(PRIORITY_MAP).map(([value, item]) => (
                      <MenuItem key={value} value={value}>{item.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small">
                  <InputLabel id="staff-sla-filter-label">Tình trạng SLA</InputLabel>
                  <Select
                    labelId="staff-sla-filter-label"
                    value={slaFilter}
                    label="Tình trạng SLA"
                    onChange={handleSlaFilter}
                  >
                    <MenuItem value="">Tất cả SLA</MenuItem>
                    <MenuItem value="overdue">Quá hạn</MenuItem>
                    <MenuItem value="due_soon">Sắp đến hạn</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small">
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
                  <Button
                    size="small"
                    startIcon={<FilterAltOff />}
                    onClick={clearFilters}
                    color="inherit"
                    sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}
                  >
                    Xóa bộ lọc
                  </Button>
                )}
              </Box>
            </Box>

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

            <Box sx={{ ...panelSx, overflow: 'hidden' }}>
              <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
                <Table sx={{ minWidth: 1120 }} aria-label="Danh sách công việc của đơn vị">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={headCellSx}>Công việc</TableCell>
                      <TableCell sx={headCellSx}>Phân loại</TableCell>
                      <TableCell sx={headCellSx}>Ưu tiên</TableCell>
                      <TableCell sx={headCellSx}>Trạng thái</TableCell>
                      <TableCell sx={headCellSx}>SLA và hạn xử lý</TableCell>
                      <TableCell sx={headCellSx}>Phụ trách</TableCell>
                      <TableCell align="right" sx={headCellSx}>Thao tác</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {Array.from({ length: 7 }).map((__, cellIndex) => (
                            <TableCell key={cellIndex} sx={cellSx}>
                              <Skeleton height={30} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : issues.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ ...cellSx, py: 8 }}>
                          <AssignmentIndOutlined sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
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
                        const permissions = getPermissions(issue);
                        const priorityColor = issue.priorityLevel
                          ? PRIORITY_MAP[issue.priorityLevel]?.color
                          : '#94A3B8';

                        return (
                          <TableRow
                            key={issue._id}
                            hover
                            sx={{
                              '& td:first-of-type': {
                                borderLeft: `3px solid ${priorityColor}`,
                              },
                              '&:hover': { bgcolor: '#F8FAFB' },
                            }}
                          >
                            <TableCell sx={{ ...cellSx, width: '32%', maxWidth: 370 }}>
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

                            <TableCell sx={cellSx}>
                              <CategoryIndicator issue={issue} />
                            </TableCell>

                            <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                              <PriorityBadge issue={issue} />
                            </TableCell>

                            <TableCell sx={cellSx}>
                              <StatusIndicator issue={issue} />
                            </TableCell>

                            <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                              <SlaBadge
                                status={issue.slaStatus}
                                dueAt={issue.dueAt}
                                showRemaining
                              />
                              <Typography
                                variant="caption"
                                display="block"
                                mt={0.55}
                                color={issue.slaStatus === 'overdue' ? 'error.main' : 'text.secondary'}
                                fontWeight={issue.slaStatus === 'overdue' ? 700 : 400}
                              >
                                {issue.dueAt ? formatDate(issue.dueAt) : 'Chưa có hạn xử lý'}
                              </Typography>
                            </TableCell>

                            <TableCell sx={cellSx}>
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <PersonOutline
                                  sx={{
                                    fontSize: 18,
                                    color: permissions.isMine ? 'success.main' : 'text.secondary',
                                  }}
                                />
                                <Box>
                                  <Typography
                                    variant="body2"
                                    color={!permissions.assigneeId ? 'text.secondary' : 'text.primary'}
                                  >
                                    {getAssigneeName(issue)}
                                  </Typography>
                                  {permissions.isMine && (
                                    <Typography variant="caption" color="success.main">
                                      Việc của bạn
                                    </Typography>
                                  )}
                                </Box>
                              </Stack>
                            </TableCell>

                            <TableCell align="right" sx={cellSx}>
                              <WorkActions
                                issue={issue}
                                canClaim={permissions.canClaim}
                                canUpdate={permissions.canUpdate}
                                claimingId={claimingId}
                                onClaim={handleClaim}
                                onUpdate={setStatusTarget}
                                onView={(selectedIssue) => navigate(`/issues/${selectedIssue._id}`)}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                {loading ? (
                  <Stack spacing={0} divider={<Box sx={{ borderTop: '1px solid #E2E8EC' }} />}>
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Box key={index} sx={{ p: 2 }}>
                        <Skeleton width="75%" height={28} />
                        <Skeleton width="92%" />
                        <Skeleton width="58%" />
                      </Box>
                    ))}
                  </Stack>
                ) : issues.length === 0 ? (
                  <Box sx={{ py: 7, px: 2, textAlign: 'center' }}>
                    <AssignmentIndOutlined sx={{ fontSize: 42, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">
                      Không có công việc phù hợp với bộ lọc.
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={0} divider={<Box sx={{ borderTop: '1px solid #E2E8EC' }} />}>
                    {issues.map((issue) => {
                      const permissions = getPermissions(issue);
                      const priorityColor = issue.priorityLevel
                        ? PRIORITY_MAP[issue.priorityLevel]?.color
                        : '#94A3B8';

                      return (
                        <Box
                          key={issue._id}
                          component="article"
                          sx={{ position: 'relative', p: 2, borderLeft: `3px solid ${priorityColor}` }}
                        >
                          <Stack direction="row" justifyContent="space-between" spacing={1} mb={0.5}>
                            <Typography variant="body2" fontWeight={700}>
                              {issue.title}
                            </Typography>
                            <PriorityBadge issue={issue} />
                          </Stack>

                          <Stack direction="row" spacing={0.5} alignItems="center" mb={1.25}>
                            <LocationOn sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {issue.location}
                            </Typography>
                          </Stack>

                          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap mb={1.5}>
                            <CategoryIndicator issue={issue} />
                            <StatusIndicator issue={issue} />
                          </Stack>

                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: 1.25,
                              p: 1.25,
                              mb: 1.5,
                              bgcolor: '#F5F7F9',
                              borderRadius: 1,
                            }}
                          >
                            <Box>
                              <Typography variant="caption" color="text.disabled">SLA và hạn</Typography>
                              <Box mt={0.35}>
                                <SlaBadge status={issue.slaStatus} dueAt={issue.dueAt} showRemaining />
                              </Box>
                              <Typography variant="caption" color="text.secondary" display="block" mt={0.45}>
                                {issue.dueAt ? formatDate(issue.dueAt) : 'Chưa có hạn'}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.disabled">Phụ trách</Typography>
                              <Typography variant="body2" mt={0.35}>
                                {getAssigneeName(issue)}
                              </Typography>
                            </Box>
                          </Box>

                          <WorkActions
                            issue={issue}
                            canClaim={permissions.canClaim}
                            canUpdate={permissions.canUpdate}
                            claimingId={claimingId}
                            onClaim={handleClaim}
                            onUpdate={setStatusTarget}
                            onView={(selectedIssue) => navigate(`/issues/${selectedIssue._id}`)}
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Box>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
                sx={{
                  px: 2.5,
                  py: 1.75,
                  borderTop: '1px solid',
                  borderColor: 'divider',
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
            </Box>
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
