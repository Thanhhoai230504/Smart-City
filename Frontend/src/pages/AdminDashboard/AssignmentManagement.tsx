import React, { useCallback, useEffect, useState } from 'react';
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
  LocationOn,
  OpenInNew,
  Refresh,
  ThumbUp,
} from '@mui/icons-material';
import { issueApi } from '../../api/issueApi';
import {
  Issue,
  Pagination as PaginationData,
  PriorityLevel,
} from '../../types';
import { CATEGORY_MAP, PRIORITY_MAP, STATUS_MAP } from '../../utils/constants';
import SlaBadge from '../../components/SlaBadge';
import PriorityBadge from '../../components/PriorityBadge';
import AssignIssueDialog from '../../components/AssignIssueDialog';
import { cellSx, GlassCard, headCellSx } from './types';
import { getApiErrorMessage } from '../../utils/apiError';
import { stickyActionCellSx, stickyActionHeadSx } from '../../utils/tableSx';

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

/**
 * Hai bảng dùng `table-layout: fixed`: cột "Sự cố" lấy phần còn lại, các cột khác
 * cố định. Trước đây hàng chờ có 8 cột tự co giãn (rộng ~1400 px) nên ở 1440 px
 * với thanh điều hướng, nút "Phân công" nằm ngoài vùng nhìn thấy. "Hạng" gộp với
 * "Điểm ưu tiên"; "Loại", người báo và "Vị trí" xếp dưới tiêu đề.
 */
const QUEUE_COLUMNS = { priority: 180, votes: 110, reportedAt: 104, actions: 160 } as const;
const ASSIGNED_COLUMNS = { priority: 180, department: 210, sla: 216, actions: 104 } as const;
const minTableWidth = (columns: Record<string, number>, titleMin: number) => (
  Object.values(columns).reduce((sum, width) => sum + width, 0) + titleMin
);

const bodyCellSx = { ...cellSx, px: 1.5 };
const headSx = { ...headCellSx, px: 1.5 };
// Nền đặc (kể cả khi hover) để cột thao tác dính phải không lộ chữ cuộn bên dưới.
const rowSx = { bgcolor: 'background.paper', '&:hover': { bgcolor: '#F5F8FA' } };

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
        message: getApiErrorMessage(error, 'Không thể tải hàng chờ phân công.'),
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
        message: getApiErrorMessage(error, 'Không thể tải danh sách đã phân công.'),
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
        message: getApiErrorMessage(error, 'Không thể tính lại điểm ưu tiên.'),
        severity: 'error',
      });
    } finally {
      setRecalculating(false);
    }
  };

  const openAssignmentDialog = (issue: Issue) => setAssignTarget(issue);

  // Hộp thoại dùng chung (components/AssignIssueDialog) tự lo gợi ý đơn vị, cán bộ và
  // lỗi; ở đây chỉ tải lại hai bảng sau khi phân công xong.
  const handleAssigned = async () => {
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
        message: getApiErrorMessage(error, 'Không thể thu hồi phân công.'),
        severity: 'error',
      });
    } finally {
      setUnassigning(false);
    }
  };

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
          sx={{ mt: 2, borderBottom: '1px solid #DCE7EB' }}
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
              <Table size="small" sx={{ tableLayout: 'fixed', minWidth: minTableWidth(QUEUE_COLUMNS, 260) }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...headSx, width: QUEUE_COLUMNS.priority }}>Hạng · Ưu tiên</TableCell>
                    <TableCell sx={headSx}>Sự cố</TableCell>
                    <TableCell sx={{ ...headSx, width: QUEUE_COLUMNS.votes }}>Đồng thuận</TableCell>
                    <TableCell sx={{ ...headSx, width: QUEUE_COLUMNS.reportedAt }}>Ngày báo</TableCell>
                    <TableCell align="right" sx={{ ...headSx, ...stickyActionHeadSx, width: QUEUE_COLUMNS.actions }}>
                      Thao tác
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {queueLoading ? [...Array(4)].map((_, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {[...Array(5)].map((__, cellIndex) => (
                        <TableCell key={cellIndex} sx={bodyCellSx}>
                          <Skeleton
                            variant="rounded"
                            height={cellIndex === 1 ? 22 : 15}
                            width={cellIndex === 0 ? '85%' : '60%'}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  )) : queue.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ ...bodyCellSx, textAlign: 'center', py: 6 }}>
                        <AssignmentTurnedIn sx={{ fontSize: 46, color: '#10B981', mb: 1 }} />
                        <Typography color="text.secondary">
                          Không còn sự cố chờ phân công.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : queue.map((issue, index) => {
                    const priority = (queuePagination.current - 1) * PAGE_SIZE + index + 1;
                    const category = CATEGORY_MAP[issue.category] || CATEGORY_MAP.other;
                    const reporterName = typeof issue.userId === 'string' ? 'Người dân' : issue.userId.name;
                    return (
                      <TableRow key={issue._id} hover sx={rowSx}>
                        <TableCell sx={bodyCellSx}>
                          <Stack spacing={0.75} alignItems="flex-start">
                            <Chip
                              size="small"
                              label={`#${priority}`}
                              aria-label={`Hạng ${priority} trong hàng chờ`}
                              sx={{
                                height: 22,
                                fontWeight: 700,
                                bgcolor: priority <= 3 ? STATUS_MAP.reported.bg : '#EAF2F4',
                                color: priority <= 3 ? STATUS_MAP.reported.text : 'text.secondary',
                              }}
                            />
                            <PriorityBadge issue={issue} />
                          </Stack>
                        </TableCell>
                        <TableCell sx={bodyCellSx}>
                          <Tooltip title={issue.title} placement="top-start" enterDelay={500}>
                            <Typography variant="body2" fontWeight={600} noWrap>{issue.title}</Typography>
                          </Tooltip>
                          <Stack direction="row" spacing={0.75} alignItems="center" mt={0.35} minWidth={0}>
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: category.color, flexShrink: 0 }} />
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {category.label} · {reporterName}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center" mt={0.25} minWidth={0}>
                            <LocationOn sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
                            <Typography variant="caption" color="text.secondary" noWrap>{issue.location}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={bodyCellSx}>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <ThumbUp sx={{ fontSize: 16, color: '#F59E0B' }} />
                            <Typography fontWeight={700} color="#F59E0B">
                              {issue.voteCount || 0}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ ...bodyCellSx, whiteSpace: 'nowrap' }}>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(issue.createdAt).toLocaleDateString('vi-VN')}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ ...bodyCellSx, ...stickyActionCellSx }}>
                          <Stack direction="row" spacing={0.75} justifyContent="flex-end" alignItems="center">
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => openAssignmentDialog(issue)}
                              sx={{ whiteSpace: 'nowrap', textTransform: 'none' }}
                            >
                              Phân công
                            </Button>
                            <Tooltip title="Xem chi tiết">
                              <IconButton
                                size="small"
                                aria-label={`Xem chi tiết ${issue.title}`}
                                onClick={() => navigate(`/issues/${issue._id}`)}
                                sx={{ color: 'primary.main' }}
                              >
                                <OpenInNew fontSize="small" />
                              </IconButton>
                            </Tooltip>
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
              <Table size="small" sx={{ tableLayout: 'fixed', minWidth: minTableWidth(ASSIGNED_COLUMNS, 240) }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={headSx}>Sự cố</TableCell>
                    <TableCell sx={{ ...headSx, width: ASSIGNED_COLUMNS.priority }}>Ưu tiên</TableCell>
                    <TableCell sx={{ ...headSx, width: ASSIGNED_COLUMNS.department }}>Đơn vị · Cán bộ</TableCell>
                    <TableCell sx={{ ...headSx, width: ASSIGNED_COLUMNS.sla }}>SLA</TableCell>
                    <TableCell align="right" sx={{ ...headSx, ...stickyActionHeadSx, width: ASSIGNED_COLUMNS.actions }}>
                      Thao tác
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assignedLoading ? [...Array(4)].map((_, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {[...Array(5)].map((__, cellIndex) => (
                        <TableCell key={cellIndex} sx={bodyCellSx}>
                          <Skeleton
                            variant="rounded"
                            height={cellIndex === 3 ? 23 : 15}
                            width={cellIndex === 0 ? '85%' : '65%'}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  )) : assignedIssues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ ...bodyCellSx, textAlign: 'center', py: 6 }}>
                        <Typography color="text.secondary">
                          Chưa có sự cố đang được đơn vị xử lý.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : assignedIssues.map((issue) => {
                    const category = CATEGORY_MAP[issue.category] || CATEGORY_MAP.other;
                    return (
                      <TableRow key={issue._id} hover sx={rowSx}>
                        <TableCell sx={bodyCellSx}>
                          <Tooltip title={issue.title} placement="top-start" enterDelay={500}>
                            <Typography variant="body2" fontWeight={600} noWrap>{issue.title}</Typography>
                          </Tooltip>
                          <Stack direction="row" spacing={0.75} alignItems="center" mt={0.35} minWidth={0}>
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: category.color, flexShrink: 0 }} />
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {category.label} · {issue.location}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={bodyCellSx}>
                          <Stack alignItems="flex-start">
                            <PriorityBadge issue={issue} />
                          </Stack>
                        </TableCell>
                        <TableCell sx={bodyCellSx}>
                          <Typography variant="caption" display="block" sx={{ overflowWrap: 'anywhere' }}>
                            {getDepartmentLabel(issue)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ overflowWrap: 'anywhere' }}>
                            Cán bộ: {getAssigneeName(issue)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={bodyCellSx}>
                          <Stack alignItems="flex-start">
                            <SlaBadge
                              status={issue.slaStatus}
                              dueAt={issue.dueAt}
                              showRemaining
                            />
                          </Stack>
                          <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                            Phân công {issue.assignedAt
                              ? new Date(issue.assignedAt).toLocaleString('vi-VN')
                              : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ ...bodyCellSx, ...stickyActionCellSx }}>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                            <Tooltip title="Xem chi tiết">
                              <IconButton
                                size="small"
                                aria-label={`Xem chi tiết ${issue.title}`}
                                onClick={() => navigate(`/issues/${issue._id}`)}
                                sx={{ color: 'primary.main' }}
                              >
                                <OpenInNew fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Thu hồi phân công">
                              <IconButton
                                size="small"
                                aria-label={`Thu hồi phân công ${issue.title}`}
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
                    );
                  })}
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

      <AssignIssueDialog
        issue={assignTarget}
        onClose={() => setAssignTarget(null)}
        onAssigned={handleAssigned}
      />

      <Dialog
        open={!!unassignTarget}
        onClose={() => {
          if (!unassigning) setUnassignTarget(null);
        }}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            bgcolor: '#FFFFFF',
            border: '1px solid #DCE7EB',
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
