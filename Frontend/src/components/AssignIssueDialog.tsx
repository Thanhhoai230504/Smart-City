import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
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
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ThumbUp } from '@mui/icons-material';
import { issueApi } from '../api/issueApi';
import { departmentApi } from '../api/departmentApi';
import { DepartmentStaff, DepartmentSuggestion, Issue } from '../types';
import { CATEGORY_MAP } from '../utils/constants';
import { getAssignedDepartmentId, getAssigneeId } from '../utils/assignment';
import PriorityBadge from './PriorityBadge';

interface ApiErrorResponse {
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) return fallback;
  return error.response?.data?.errors?.[0]?.message
    || error.response?.data?.message
    || fallback;
};

interface Props {
  /** Sự cố cần phân công; `null` = đóng hộp thoại. */
  issue: Issue | null;
  onClose: () => void;
  /** Gọi sau khi phân công thành công — nơi gọi tự đóng hộp thoại và tải lại dữ liệu. */
  onAssigned: () => void;
}

/**
 * Hộp thoại phân công sự cố — DÙNG CHUNG cho tab "Phân công" của admin và trang
 * chi tiết sự cố. Trước đây hộp thoại chỉ nằm trong tab Phân công, nên admin bấm
 * vào thông báo "có sự cố mới" phải quay lại tab đó, tìm sự cố rồi mới phân công.
 *
 * Gợi ý đơn vị theo loại sự cố (`/departments/suggest/:category`); khi phân công
 * LẠI thì chọn sẵn đơn vị và cán bộ hiện tại.
 */
const AssignIssueDialog: React.FC<Props> = ({ issue, onClose, onAssigned }) => {
  const [suggestions, setSuggestions] = useState<DepartmentSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [staff, setStaff] = useState<DepartmentStaff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [note, setNote] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // Đóng/mở nhanh hoặc đổi đơn vị liên tục tạo request chồng nhau: chỉ nhận phản hồi mới nhất.
  const requestSeq = useRef(0);

  const currentDepartmentId = issue ? getAssignedDepartmentId(issue) : null;
  const isReassign = Boolean(currentDepartmentId);

  const loadStaff = async (departmentId: string, preselectAssigneeId: string | null = null) => {
    const seq = ++requestSeq.current;
    setSelectedAssigneeId('');
    setStaff([]);
    setStaffError('');
    if (!departmentId) return;
    setStaffLoading(true);
    try {
      const { data } = await departmentApi.getStaff(departmentId);
      if (seq !== requestSeq.current) return;
      setStaff(data.data.staff);
      if (preselectAssigneeId && data.data.staff.some((m) => m._id === preselectAssigneeId)) {
        setSelectedAssigneeId(preselectAssigneeId);
      }
    } catch (error) {
      if (seq === requestSeq.current) setStaffError(getErrorMessage(error, 'Không thể tải cán bộ của đơn vị.'));
    } finally {
      if (seq === requestSeq.current) setStaffLoading(false);
    }
  };

  useEffect(() => {
    if (!issue) return;
    const seq = ++requestSeq.current;
    setSuggestions([]);
    setSuggestionError('');
    setSelectedDepartmentId('');
    setStaff([]);
    setSelectedAssigneeId('');
    setNote('');
    setSubmitError('');
    setSuggestionsLoading(true);

    (async () => {
      try {
        const { data } = await departmentApi.suggestForCategory(issue.category);
        if (seq !== requestSeq.current) return;
        const departments = data.data.departments;
        setSuggestions(departments);
        // Phân công lại: chọn sẵn đơn vị hiện tại. Phân công mới: chọn sẵn nếu chỉ có một gợi ý.
        const preselect = departments.find((d) => d._id === getAssignedDepartmentId(issue))
          || (departments.length === 1 ? departments[0] : null);
        if (preselect) {
          setSelectedDepartmentId(preselect._id);
          setSuggestionsLoading(false);
          await loadStaff(preselect._id, getAssigneeId(issue));
        }
      } catch (error) {
        if (seq === requestSeq.current) setSuggestionError(getErrorMessage(error, 'Không thể lấy gợi ý đơn vị.'));
      } finally {
        if (seq === requestSeq.current) setSuggestionsLoading(false);
      }
    })();
    // Chỉ chạy lại khi mở cho một sự cố khác.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue?._id]);

  const handleClose = () => {
    if (assigning) return;
    requestSeq.current++; // bỏ mọi phản hồi còn đang chờ
    onClose();
  };

  const handleDepartmentChange = async (event: SelectChangeEvent) => {
    const departmentId = event.target.value;
    setSelectedDepartmentId(departmentId);
    await loadStaff(departmentId);
  };

  const handleAssign = async () => {
    if (!issue || !selectedDepartmentId) return;
    setAssigning(true);
    setSubmitError('');
    try {
      await issueApi.assignIssue(issue._id, {
        departmentId: selectedDepartmentId,
        assigneeId: selectedAssigneeId || undefined,
        note: note.trim() || undefined,
      });
      onAssigned();
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Không thể phân công sự cố.'));
    } finally {
      setAssigning(false);
    }
  };

  const selectedSuggestion = suggestions.find((d) => d._id === selectedDepartmentId);
  const category = issue ? CATEGORY_MAP[issue.category] || CATEGORY_MAP.other : null;
  const currentDepartmentName = issue && typeof issue.departmentId === 'object' && issue.departmentId
    ? (issue.departmentId as { name?: string }).name
    : null;

  return (
    <Dialog
      open={!!issue}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { bgcolor: '#FFFFFF', border: '1px solid #DCE7EB', borderRadius: '16px' } }}
    >
      <DialogTitle>{isReassign ? 'Phân công lại sự cố' : 'Phân công sự cố'}</DialogTitle>
      <DialogContent>
        {issue && category && (
          <Stack spacing={2.25} mt={0.5}>
            <Box sx={{ p: 1.5, borderRadius: '10px', bgcolor: '#F7FAFA', border: '1px solid #DCE7EB' }}>
              <Typography fontWeight={600}>{issue.title}</Typography>
              <Stack direction="row" spacing={1} mt={0.75} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`${category.icon} ${category.label}`} />
                <PriorityBadge issue={issue} />
                <Chip size="small" icon={<ThumbUp />} label={`${issue.voteCount || 0} lượt đồng thuận`} />
              </Stack>
            </Box>

            {isReassign && (
              <Alert severity="info" variant="outlined">
                Đang giao cho <strong>{currentDepartmentName || 'một đơn vị'}</strong>. Phân công lại sẽ{' '}
                <strong>tính lại hạn xử lý từ bây giờ</strong> và báo cho đơn vị mới.
              </Alert>
            )}

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
                <InputLabel id="assign-dialog-department-label">Đơn vị xử lý</InputLabel>
                <Select
                  labelId="assign-dialog-department-label"
                  value={selectedDepartmentId}
                  label="Đơn vị xử lý"
                  onChange={handleDepartmentChange}
                >
                  {suggestions.map((d) => (
                    <MenuItem key={d._id} value={d._id}>
                      ⭐ {d.code} — {d.name} · SLA {d.slaHoursEffective} giờ
                      {d._id === currentDepartmentId ? ' (đang giao)' : ''}
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
              <InputLabel id="assign-dialog-staff-label">Cán bộ phụ trách (tuỳ chọn)</InputLabel>
              <Select
                labelId="assign-dialog-staff-label"
                value={selectedAssigneeId}
                label="Cán bộ phụ trách (tuỳ chọn)"
                onChange={(event: SelectChangeEvent) => setSelectedAssigneeId(event.target.value)}
              >
                <MenuItem value="">Không chỉ định — đơn vị tự nhận việc</MenuItem>
                {staff.map((m) => (
                  <MenuItem key={m._id} value={m._id}>{m.name} — {m.email}</MenuItem>
                ))}
              </Select>
              {staffLoading && (
                <Typography variant="caption" color="text.secondary" mt={0.75}>Đang tải cán bộ...</Typography>
              )}
              {!staffLoading && selectedDepartmentId && staff.length === 0 && !staffError && (
                <Typography variant="caption" color="warning.main" mt={0.75}>
                  Đơn vị chưa có cán bộ hoạt động; thông báo vẫn được gửi tới email chung của đơn vị.
                </Typography>
              )}
            </FormControl>
            {staffError && <Alert severity="error">{staffError}</Alert>}

            <TextField
              label="Ghi chú phân công"
              multiline
              minRows={3}
              value={note}
              inputProps={{ maxLength: 500 }}
              helperText={`${note.length}/500`}
              onChange={(event) => setNote(event.target.value)}
            />

            {submitError && <Alert severity="error">{submitError}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose} disabled={assigning} sx={{ color: 'text.secondary' }}>Huỷ</Button>
        <Button
          variant="contained"
          onClick={handleAssign}
          disabled={!selectedDepartmentId || assigning || suggestionsLoading}
          startIcon={assigning ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {assigning ? 'Đang phân công...' : isReassign ? 'Xác nhận phân công lại' : 'Xác nhận phân công'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignIssueDialog;
