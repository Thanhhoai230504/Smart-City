import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Skeleton,
  Snackbar,
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
  Add,
  Block,
  Business,
  Edit,
  Groups,
  Replay,
} from '@mui/icons-material';
import { departmentApi, DepartmentPayload } from '../../api/departmentApi';
import { CATEGORY_MAP } from '../../utils/constants';
import { Department, DepartmentStaff, IssueCategory } from '../../types';
import { cellSx, GlassCard, headCellSx } from './types';

interface DepartmentForm {
  name: string;
  code: string;
  email: string;
  phone: string;
  categories: IssueCategory[];
  slaHours: string;
}

interface ApiErrorResponse {
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

type FormErrors = Partial<Record<keyof DepartmentForm, string>>;
type SnackState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_MAP) as IssueCategory[]).map((value) => ({
  value,
  label: CATEGORY_MAP[value].label,
  icon: CATEGORY_MAP[value].icon,
}));

const createEmptyForm = (): DepartmentForm => ({
  name: '',
  code: '',
  email: '',
  phone: '',
  categories: [],
  slaHours: '',
});

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) return fallback;
  return error.response?.data?.errors?.[0]?.message
    || error.response?.data?.message
    || fallback;
};

const DepartmentManagement: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<DepartmentForm>(createEmptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formApiError, setFormApiError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Department | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [snack, setSnack] = useState<SnackState>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [staffTarget, setStaffTarget] = useState<Department | null>(null);
  const [staff, setStaff] = useState<DepartmentStaff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await departmentApi.getDepartments({ includeInactive: true });
      setDepartments(data.data.departments);
    } catch (error) {
      setSnack({
        open: true,
        message: getErrorMessage(error, 'Không thể tải danh sách đơn vị.'),
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const activeCount = useMemo(
    () => departments.filter((department) => department.isActive).length,
    [departments],
  );

  const openForm = (department?: Department) => {
    setEditing(department || null);
    setForm(department ? {
      name: department.name,
      code: department.code,
      email: department.email || '',
      phone: department.phone || '',
      categories: department.categories,
      slaHours: department.slaHours?.toString() || '',
    } : createEmptyForm());
    setFormErrors({});
    setFormApiError('');
    setDialogOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditing(null);
    setForm(createEmptyForm());
    setFormErrors({});
    setFormApiError('');
  };

  const validateForm = () => {
    const errors: FormErrors = {};
    const name = form.name.trim();
    const code = form.code.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();

    if (!name) errors.name = 'Tên đơn vị là bắt buộc.';
    else if (name.length > 150) errors.name = 'Tên đơn vị không quá 150 ký tự.';

    if (!code) errors.code = 'Mã đơn vị là bắt buộc.';
    else if (code.length > 20) errors.code = 'Mã đơn vị không quá 20 ký tự.';
    else if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      errors.code = 'Chỉ dùng chữ, số, gạch ngang và gạch dưới.';
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Email không hợp lệ.';
    }

    if (phone && !/^(0|\+84)[0-9]{8,10}$/.test(phone)) {
      errors.phone = 'Số điện thoại không hợp lệ.';
    }

    if (form.slaHours) {
      const hours = Number(form.slaHours);
      if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
        errors.slaHours = 'SLA phải là số nguyên từ 1 đến 720 giờ.';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const payload: DepartmentPayload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      categories: form.categories,
      slaHours: form.slaHours ? Number(form.slaHours) : null,
    };

    setSaving(true);
    setFormApiError('');
    try {
      if (editing) {
        await departmentApi.updateDepartment(editing._id, payload);
      } else {
        await departmentApi.createDepartment(payload);
      }

      setSnack({
        open: true,
        message: editing ? 'Đã cập nhật đơn vị.' : 'Đã tạo đơn vị mới.',
        severity: 'success',
      });
      setDialogOpen(false);
      setEditing(null);
      setForm(createEmptyForm());
      await loadDepartments();
    } catch (error) {
      setFormApiError(getErrorMessage(error, 'Không thể lưu đơn vị.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;

    const target = deactivateTarget;
    setMutatingId(target._id);
    try {
      await departmentApi.deactivateDepartment(target._id);
      setSnack({
        open: true,
        message: `Đã vô hiệu hoá ${target.name}.`,
        severity: 'success',
      });
      setDeactivateTarget(null);
      await loadDepartments();
    } catch (error) {
      setDeactivateTarget(null);
      setSnack({
        open: true,
        // Giữ nguyên thông báo backend, bao gồm số sự cố chưa xử lý.
        message: getErrorMessage(error, 'Không thể vô hiệu hoá đơn vị.'),
        severity: 'error',
      });
    } finally {
      setMutatingId(null);
    }
  };

  const handleReactivate = async (department: Department) => {
    setMutatingId(department._id);
    try {
      await departmentApi.updateDepartment(department._id, { isActive: true });
      setSnack({
        open: true,
        message: `Đã kích hoạt lại ${department.name}.`,
        severity: 'success',
      });
      await loadDepartments();
    } catch (error) {
      setSnack({
        open: true,
        message: getErrorMessage(error, 'Không thể kích hoạt lại đơn vị.'),
        severity: 'error',
      });
    } finally {
      setMutatingId(null);
    }
  };

  const openStaffDialog = async (department: Department) => {
    setStaffTarget(department);
    setStaff([]);
    setStaffError('');
    setStaffLoading(true);
    try {
      const { data } = await departmentApi.getStaff(department._id);
      setStaff(data.data.staff);
    } catch (error) {
      setStaffError(getErrorMessage(error, 'Không thể tải danh sách cán bộ.'));
    } finally {
      setStaffLoading(false);
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
          mb={2}
        >
          <Box>
            <Typography fontWeight={600} variant="h6">
              🏢 Quản lý đơn vị xử lý
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Cấu hình đầu mối phụ trách và thời hạn SLA của từng đơn vị.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={`${activeCount}/${departments.length} hoạt động`}
              sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#6EE7B7', fontWeight: 600 }}
            />
            <Button
              variant="contained"
              size="small"
              startIcon={<Add />}
              onClick={() => openForm()}
              sx={{ borderRadius: '10px', textTransform: 'none' }}
            >
              Thêm đơn vị
            </Button>
          </Stack>
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Đơn vị', 'Liên hệ', 'Loại sự cố phụ trách', 'SLA', 'Trạng thái', 'Thao tác'].map((heading) => (
                  <TableCell key={heading} sx={headCellSx}>{heading}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? [...Array(4)].map((_, index) => (
                <TableRow key={index}>
                  {[...Array(6)].map((__, cellIndex) => (
                    <TableCell key={cellIndex} sx={cellSx}>
                      <Skeleton
                        variant="rounded"
                        height={cellIndex === 2 ? 28 : 16}
                        width={cellIndex === 0 ? '80%' : cellIndex === 2 ? '90%' : '65%'}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              )) : departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ ...cellSx, py: 5, textAlign: 'center' }}>
                    <Business sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">Chưa có đơn vị xử lý.</Typography>
                  </TableCell>
                </TableRow>
              ) : departments.map((department) => (
                <TableRow
                  key={department._id}
                  hover
                  sx={{
                    opacity: department.isActive ? 1 : 0.55,
                    '&:hover': { bgcolor: 'rgba(14,165,233,0.04)' },
                  }}
                >
                  <TableCell sx={{ ...cellSx, minWidth: 190 }}>
                    <Typography variant="body2" fontWeight={600}>{department.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{department.code}</Typography>
                  </TableCell>
                  <TableCell sx={{ ...cellSx, minWidth: 180 }}>
                    <Typography variant="caption" display="block">{department.email || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">{department.phone || '—'}</Typography>
                  </TableCell>
                  <TableCell sx={{ ...cellSx, minWidth: 260 }}>
                    {department.categories.length > 0 ? (
                      <Stack direction="row" gap={0.5} flexWrap="wrap">
                        {department.categories.map((category) => (
                          <Chip
                            key={category}
                            size="small"
                            label={`${CATEGORY_MAP[category].icon} ${CATEGORY_MAP[category].label}`}
                            sx={{
                              height: 22,
                              fontSize: '0.68rem',
                              bgcolor: `${CATEGORY_MAP[category].color}1F`,
                              color: CATEGORY_MAP[category].color,
                            }}
                          />
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Chưa cấu hình</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" fontWeight={500}>
                      {department.slaHours ? `${department.slaHours} giờ` : 'Theo loại sự cố'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Chip
                      size="small"
                      label={department.isActive ? 'Hoạt động' : 'Vô hiệu hoá'}
                      sx={{
                        height: 23,
                        fontSize: '0.7rem',
                        bgcolor: department.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.16)',
                        color: department.isActive ? '#10B981' : '#9CA3AF',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Danh sách cán bộ">
                        <IconButton
                          size="small"
                          onClick={() => openStaffDialog(department)}
                          sx={{ color: '#0EA5E9' }}
                        >
                          <Groups fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sửa đơn vị">
                        <IconButton
                          size="small"
                          onClick={() => openForm(department)}
                          sx={{ color: '#F59E0B' }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {department.isActive ? (
                        <Tooltip title="Vô hiệu hoá">
                          <span>
                            <IconButton
                              size="small"
                              disabled={mutatingId === department._id}
                              onClick={() => setDeactivateTarget(department)}
                              sx={{ color: '#EF4444' }}
                            >
                              {mutatingId === department._id
                                ? <CircularProgress size={18} />
                                : <Block fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Kích hoạt lại">
                          <span>
                            <IconButton
                              size="small"
                              disabled={mutatingId === department._id}
                              onClick={() => handleReactivate(department)}
                              sx={{ color: '#10B981' }}
                            >
                              {mutatingId === department._id
                                ? <CircularProgress size={18} />
                                : <Replay fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </GlassCard>

      <Dialog
        open={!!staffTarget}
        onClose={() => setStaffTarget(null)}
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
        <DialogTitle>
          Cán bộ đơn vị {staffTarget?.code}
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {staffTarget?.name}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {staffLoading ? (
            <Stack spacing={1.25} mt={1}>
              {[...Array(3)].map((_, index) => (
                <Stack key={index} direction="row" spacing={1.5} alignItems="center">
                  <Skeleton variant="circular" width={38} height={38} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton width="45%" />
                    <Skeleton width="70%" />
                  </Box>
                </Stack>
              ))}
            </Stack>
          ) : staffError ? (
            <Alert severity="error" sx={{ mt: 1 }}>{staffError}</Alert>
          ) : staff.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <Groups sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">
                Đơn vị chưa có cán bộ đang hoạt động.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1} mt={1}>
              {staff.map((member) => (
                <Stack
                  key={member._id}
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{
                    p: 1.5,
                    borderRadius: '10px',
                    bgcolor: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Avatar sx={{ width: 38, height: 38, bgcolor: '#10B981', fontSize: '0.85rem' }}>
                    {member.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600}>{member.name}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {member.email}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
                    Từ {new Date(member.createdAt).toLocaleDateString('vi-VN')}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setStaffTarget(null)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dialogOpen}
        onClose={closeForm}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            bgcolor: '#1A2332',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
          },
        }}
      >
        <DialogTitle>{editing ? 'Sửa đơn vị xử lý' : 'Thêm đơn vị xử lý'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.25} mt={1}>
            {formApiError && <Alert severity="error">{formApiError}</Alert>}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Tên đơn vị"
                required
                fullWidth
                value={form.name}
                error={!!formErrors.name}
                helperText={formErrors.name}
                inputProps={{ maxLength: 150 }}
                onChange={(event) => {
                  setForm((current) => ({ ...current, name: event.target.value }));
                  setFormErrors((current) => ({ ...current, name: undefined }));
                }}
              />
              <TextField
                label="Mã đơn vị"
                required
                fullWidth
                value={form.code}
                error={!!formErrors.code}
                helperText={formErrors.code || 'Ví dụ: MTDT, HTGT'}
                inputProps={{ maxLength: 20 }}
                onChange={(event) => {
                  setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }));
                  setFormErrors((current) => ({ ...current, code: undefined }));
                }}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Email"
                type="email"
                fullWidth
                value={form.email}
                error={!!formErrors.email}
                helperText={formErrors.email}
                onChange={(event) => {
                  setForm((current) => ({ ...current, email: event.target.value }));
                  setFormErrors((current) => ({ ...current, email: undefined }));
                }}
              />
              <TextField
                label="Số điện thoại"
                fullWidth
                value={form.phone}
                error={!!formErrors.phone}
                helperText={formErrors.phone || 'Bắt đầu bằng 0 hoặc +84'}
                onChange={(event) => {
                  setForm((current) => ({ ...current, phone: event.target.value }));
                  setFormErrors((current) => ({ ...current, phone: undefined }));
                }}
              />
            </Stack>

            <FormControl fullWidth>
              <InputLabel id="department-categories-label">Loại sự cố phụ trách</InputLabel>
              <Select
                labelId="department-categories-label"
                multiple
                value={form.categories}
                label="Loại sự cố phụ trách"
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => ({
                    ...current,
                    categories: typeof value === 'string'
                      ? value.split(',') as IssueCategory[]
                      : value as IssueCategory[],
                  }));
                }}
                renderValue={(selected) => selected
                  .map((category) => CATEGORY_MAP[category].label)
                  .join(', ')}
              >
                {CATEGORY_OPTIONS.map((category) => (
                  <MenuItem key={category.value} value={category.value}>
                    <Checkbox checked={form.categories.includes(category.value)} />
                    <ListItemText primary={`${category.icon} ${category.label}`} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="SLA riêng"
              type="number"
              value={form.slaHours}
              error={!!formErrors.slaHours}
              helperText={formErrors.slaHours || 'Để trống để dùng SLA mặc định theo loại sự cố.'}
              inputProps={{ min: 1, max: 720, step: 1 }}
              InputProps={{ endAdornment: <InputAdornment position="end">giờ</InputAdornment> }}
              onChange={(event) => {
                setForm((current) => ({ ...current, slaHours: event.target.value }));
                setFormErrors((current) => ({ ...current, slaHours: undefined }));
              }}
              sx={{ maxWidth: { sm: 300 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={closeForm} disabled={saving} sx={{ color: 'text.secondary' }}>
            Huỷ
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo đơn vị'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!deactivateTarget}
        onClose={() => {
          if (!deactivateTarget || mutatingId !== deactivateTarget._id) {
            setDeactivateTarget(null);
          }
        }}
        PaperProps={{
          sx: {
            bgcolor: '#1A2332',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
          },
        }}
      >
        <DialogTitle>Vô hiệu hoá đơn vị?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Đơn vị <strong>{deactivateTarget?.name}</strong> sẽ không còn xuất hiện trong danh sách phân công.
            Thao tác sẽ bị chặn nếu đơn vị còn sự cố chưa xử lý xong.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setDeactivateTarget(null)}
            disabled={!!deactivateTarget && mutatingId === deactivateTarget._id}
            sx={{ color: 'text.secondary' }}
          >
            Huỷ
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeactivate}
            disabled={!!deactivateTarget && mutatingId === deactivateTarget._id}
            startIcon={deactivateTarget && mutatingId === deactivateTarget._id
              ? <CircularProgress size={16} color="inherit" />
              : undefined}
          >
            {deactivateTarget && mutatingId === deactivateTarget._id
              ? 'Đang xử lý...'
              : 'Vô hiệu hoá'}
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

export default DepartmentManagement;
