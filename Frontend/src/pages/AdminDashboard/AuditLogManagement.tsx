import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination as MuiPagination,
  Select,
  SelectChangeEvent,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  FilterAltOff,
  History,
  OpenInNew,
  Refresh,
} from '@mui/icons-material';
import { auditApi } from '../../api/auditApi';
import {
  AuditAction,
  AuditEntityType,
  AuditLog,
  Pagination,
} from '../../types';
import { formatDate } from '../../utils/helpers';
import { cellSx, GlassCard, headCellSx } from './types';

interface ApiErrorResponse {
  message?: string;
}

const PAGE_SIZE = 15;
const EMPTY_PAGINATION: Pagination = {
  current: 1,
  pages: 1,
  total: 0,
  limit: PAGE_SIZE,
};

const ACTION_LABELS: Record<AuditAction, string> = {
  'user.role_changed': 'Đổi vai trò',
  'user.active_changed': 'Đổi trạng thái tài khoản',
  'department.staff_changed': 'Đổi đơn vị cán bộ',
  'issue.deleted': 'Xóa sự cố',
  'issue.status_changed': 'Đổi trạng thái sự cố',
  'issue.assigned': 'Phân công',
  'issue.unassigned': 'Thu hồi phân công',
  'issue.claimed': 'Nhận việc',
  'issue.merged': 'Gộp sự cố',
  'issue.priority_recalculated': 'Tính lại điểm ưu tiên',
};

const ACTION_COLORS: Record<AuditAction, string> = {
  'user.role_changed': '#8B5CF6',
  'user.active_changed': '#F59E0B',
  'department.staff_changed': '#06B6D4',
  'issue.deleted': '#EF4444',
  'issue.status_changed': '#3B82F6',
  'issue.assigned': '#10B981',
  'issue.unassigned': '#F97316',
  'issue.claimed': '#14B8A6',
  'issue.merged': '#A855F7',
  'issue.priority_recalculated': '#EAB308',
};

const getErrorMessage = (error: unknown) => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return 'Không thể tải nhật ký hoạt động.';
  }
  return error.response?.data?.message || 'Không thể tải nhật ký hoạt động.';
};

const formatMetadata = (metadata: Record<string, unknown>) => {
  const entries = Object.entries(metadata || {});
  if (entries.length === 0) return '—';
  return entries.map(([key, value]) => {
    if (value === null || value === undefined || value === '') return `${key}: —`;
    if (typeof value === 'object') return `${key}: ${JSON.stringify(value)}`;
    return `${key}: ${String(value)}`;
  }).join(' · ');
};

const AuditLogManagement: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<AuditAction | ''>('');
  const [entityType, setEntityType] = useState<AuditEntityType | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await auditApi.getLogs({
        page,
        limit: PAGE_SIZE,
        action: action || undefined,
        entityType: entityType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setLogs(data.data.logs);
      setPagination({
        ...data.data.pagination,
        pages: Math.max(1, data.data.pagination.pages),
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [action, dateFrom, dateTo, entityType, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const hasFilters = Boolean(action || entityType || dateFrom || dateTo);
  const filterLabel = useMemo(() => {
    const labels: string[] = [];
    if (action) labels.push(ACTION_LABELS[action]);
    if (entityType) labels.push(entityType);
    if (dateFrom || dateTo) labels.push(`${dateFrom || '...'} → ${dateTo || '...'}`);
    return labels.join(' · ') || 'Tất cả hoạt động';
  }, [action, dateFrom, dateTo, entityType]);

  const clearFilters = () => {
    setAction('');
    setEntityType('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
      >
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <History color="primary" />
            <Typography variant="h5" fontWeight={700}>Nhật ký hoạt động</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Theo dõi các thao tác quản trị và xử lý sự cố quan trọng.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadLogs}
          disabled={loading}
        >
          Làm mới
        </Button>
      </Stack>

      <GlassCard sx={{ p: 2 }}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.25}
          alignItems={{ xs: 'stretch', lg: 'center' }}
        >
          <FormControl size="small" sx={{ minWidth: 205 }}>
            <InputLabel id="audit-action-label">Hành động</InputLabel>
            <Select
              labelId="audit-action-label"
              value={action}
              label="Hành động"
              onChange={(event: SelectChangeEvent) => {
                setAction(event.target.value as AuditAction | '');
                setPage(1);
              }}
            >
              <MenuItem value="">Tất cả</MenuItem>
              {(Object.entries(ACTION_LABELS) as Array<[AuditAction, string]>)
                .map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="audit-entity-label">Đối tượng</InputLabel>
            <Select
              labelId="audit-entity-label"
              value={entityType}
              label="Đối tượng"
              onChange={(event: SelectChangeEvent) => {
                setEntityType(event.target.value as AuditEntityType | '');
                setPage(1);
              }}
            >
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="Issue">Sự cố</MenuItem>
              <MenuItem value="User">Người dùng</MenuItem>
              <MenuItem value="Department">Đơn vị</MenuItem>
            </Select>
          </FormControl>

          <TextField
            type="date"
            size="small"
            label="Từ ngày"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            InputLabelProps={{ shrink: true }}
            inputProps={{ max: dateTo || undefined }}
          />
          <TextField
            type="date"
            size="small"
            label="Đến ngày"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: dateFrom || undefined }}
          />

          {hasFilters && (
            <Button
              color="inherit"
              startIcon={<FilterAltOff />}
              onClick={clearFilters}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Xóa bộ lọc
            </Button>
          )}

          <Chip
            label={`${pagination.total} bản ghi`}
            color="info"
            variant="outlined"
            sx={{ ml: { lg: 'auto' } }}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
          {filterLabel}
        </Typography>
      </GlassCard>

      {error && (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={loadLogs}>Thử lại</Button>}
        >
          {error}
        </Alert>
      )}

      <GlassCard sx={{ p: 0, overflow: 'hidden' }}>
        <TableContainer>
          <Table sx={{ minWidth: 1180 }} aria-label="Nhật ký hoạt động">
            <TableHead>
              <TableRow>
                <TableCell sx={headCellSx}>Thời gian</TableCell>
                <TableCell sx={headCellSx}>Người thực hiện</TableCell>
                <TableCell sx={headCellSx}>Hành động</TableCell>
                <TableCell sx={headCellSx}>Mô tả</TableCell>
                <TableCell sx={headCellSx}>Chi tiết thay đổi</TableCell>
                <TableCell sx={headCellSx}>IP</TableCell>
                <TableCell align="right" sx={headCellSx}>Đối tượng</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {Array.from({ length: 7 }).map((__, cellIndex) => (
                      <TableCell key={cellIndex} sx={cellSx}>
                        <Skeleton height={28} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ ...cellSx, py: 8 }}>
                    <History sx={{ fontSize: 46, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">
                      Chưa có hoạt động phù hợp với bộ lọc.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const actor = typeof log.actorId === 'string' ? null : log.actorId;
                  const color = ACTION_COLORS[log.action];
                  const metadataText = formatMetadata(log.metadata);
                  return (
                    <TableRow key={log._id} hover>
                      <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                        <Typography variant="body2">{formatDate(log.createdAt)}</Typography>
                      </TableCell>
                      <TableCell sx={cellSx}>
                        <Typography variant="body2" fontWeight={650}>
                          {actor?.name || 'Tài khoản không còn tồn tại'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {actor?.email || log.actorRole}
                        </Typography>
                      </TableCell>
                      <TableCell sx={cellSx}>
                        <Chip
                          size="small"
                          label={ACTION_LABELS[log.action]}
                          sx={{
                            bgcolor: `${color}18`,
                            color,
                            border: `1px solid ${color}38`,
                            fontWeight: 650,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...cellSx, maxWidth: 300 }}>
                        <Typography variant="body2">{log.description}</Typography>
                      </TableCell>
                      <TableCell sx={{ ...cellSx, maxWidth: 300 }}>
                        <Tooltip title={metadataText}>
                          <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {metadataText}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={cellSx}>
                        <Typography variant="caption" color="text.secondary">
                          {log.ipAddress || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={cellSx}>
                        <Stack direction="row" justifyContent="flex-end" spacing={0.5} alignItems="center">
                          <Chip size="small" variant="outlined" label={log.entityType} />
                          {log.entityType === 'Issue' && (
                            <Tooltip title="Mở sự cố">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/issues/${log.entityId}`)}
                              >
                                <OpenInNew fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
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
          justifyContent="space-between"
          alignItems="center"
          sx={{ px: 2.5, py: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Typography variant="caption" color="text.secondary">
            Tổng cộng {pagination.total} bản ghi
          </Typography>
          {pagination.pages > 1 && (
            <MuiPagination
              page={Math.min(page, pagination.pages)}
              count={pagination.pages}
              onChange={(_, nextPage) => setPage(nextPage)}
              color="primary"
              size="small"
            />
          )}
        </Stack>
      </GlassCard>
    </Stack>
  );
};

export default AuditLogManagement;
