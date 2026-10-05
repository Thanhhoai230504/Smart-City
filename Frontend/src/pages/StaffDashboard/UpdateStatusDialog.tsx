import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
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
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AddPhotoAlternate,
  Close,
  DeleteOutline,
  PhotoLibrary,
} from '@mui/icons-material';
import { issueApi } from '../../api/issueApi';
import { getAllowedStatusTargets, STATUS_MAP } from '../../utils/constants';
import { getApiErrorCode, getApiErrorMessage, getApiErrorStatus } from '../../utils/apiError';
import {
  Issue,
  IssueStatus,
  ResolutionImage,
} from '../../types';

interface Props {
  issue: Issue | null;
  open: boolean;
  onClose: () => void;
  onCompleted: (message: string) => void;
  /**
   * Phiếu đã khác dữ liệu đang hiển thị: người khác vừa đổi trạng thái (409
   * STATUS_CONFLICT), phiếu bị gộp hoặc bị xoá. Nơi gọi đóng hộp thoại, báo
   * `message` và tải lại dữ liệu — bấm lại lần nữa cũng chỉ nhận cùng một lỗi.
   * Không truyền thì lỗi hiện ngay trong hộp thoại như mọi lỗi khác.
   */
  onStale?: (message: string) => void;
  /** Trạng thái chọn sẵn khi mở (VD: quản trị viên chọn "Từ chối" ngay trên bảng). Bỏ qua nếu không hợp lệ. */
  initialStatus?: IssueStatus | '';
}

type EditableStatus = Exclude<IssueStatus, 'reported'>;
type TargetStatus = EditableStatus | '';

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const STATUS_OPTIONS: Array<{ value: EditableStatus; label: string; color: string }> = [
  // Màu lấy từ STATUS_MAP — trước đây "Đang xử lý" xanh dương, "Từ chối" đỏ, lệch trang công khai.
  { value: 'processing', label: 'Đang xử lý', color: STATUS_MAP.processing.color },
  { value: 'resolved', label: 'Đã xử lý', color: STATUS_MAP.resolved.color },
  { value: 'rejected', label: 'Từ chối', color: STATUS_MAP.rejected.color },
];

/** Mã lỗi nghĩa là dữ liệu trên màn hình đã cũ: tải lại thay vì để người dùng bấm lại vô ích. */
const STALE_ERROR_CODES = new Set(['STATUS_CONFLICT', 'INVALID_STATUS_TRANSITION', 'MERGED_ISSUE']);

const isEditableTarget = (status: IssueStatus | '' | undefined, from?: IssueStatus): status is EditableStatus => (
  Boolean(status) && status !== 'reported' && getAllowedStatusTargets(from).includes(status as string)
);

/**
 * Hộp thoại đổi trạng thái — DÙNG CHUNG cho cán bộ (bàn điều phối) và quản trị
 * viên (bảng Quản lý sự cố, trang chi tiết).
 *
 * Trước đây quản trị viên đổi trạng thái bằng một ô chọn gửi thẳng API, không có
 * chỗ ghi lý do hay tải ảnh, trong khi backend bắt buộc cả hai (từ chối phải có
 * lý do, báo đã xử lý phải có ảnh minh chứng) — nên "Từ chối"/"Đã xử lý" từ bảng
 * quản trị luôn thất bại với "Cập nhật thất bại". Mọi lối đổi trạng thái giờ đi
 * qua cùng một hộp thoại với cùng các ràng buộc.
 */
const UpdateStatusDialog: React.FC<Props> = ({
  issue,
  open,
  onClose,
  onCompleted,
  onStale,
  initialStatus = '',
}) => {
  const [targetStatus, setTargetStatus] = useState<TargetStatus>('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [evidenceImages, setEvidenceImages] = useState<ResolutionImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  // Ref thay vì phụ thuộc effect: nơi gọi thường truyền hàm viết tại chỗ (mỗi lần
  // render một hàm mới), và `issue` ở trang chi tiết được thay object khi socket
  // làm mới — không được vì thế mà xoá lý do người dùng đang gõ dở.
  const onStaleRef = useRef(onStale);
  onStaleRef.current = onStale;
  const issueRef = useRef(issue);
  issueRef.current = issue;

  const issueId = issue?._id;
  const currentStatus = issue?.status;

  useEffect(() => {
    const current = issueRef.current;
    if (!open || !issueId || !current) return undefined;

    setTargetStatus(isEditableTarget(initialStatus, currentStatus) ? initialStatus : '');
    setNote('');
    setFiles([]);
    setEvidenceImages(current.resolutionImages || []);
    setError('');

    const reportStale = (message: string) => {
      if (onStaleRef.current) onStaleRef.current(message);
      else setError(message);
    };

    // Đọc lại phiếu trước khi cho đổi: dữ liệu ở bảng danh sách có thể đã cũ, và
    // API danh sách không trả ảnh minh chứng nên trước đây cán bộ phải tải lại ảnh
    // dù phiếu đã có sẵn.
    let active = true;
    setChecking(true);
    issueApi.getIssueById(issueId)
      .then(({ data }) => {
        if (!active) return;
        const latest = data.data.issue;
        if (latest.mergedInto) {
          reportStale('Sự cố này vừa được gộp vào một sự cố khác. Dữ liệu đã được tải lại.');
          return;
        }
        if (latest.status !== currentStatus) {
          const label = STATUS_MAP[latest.status]?.label || latest.status;
          reportStale(`Sự cố vừa được cập nhật sang “${label}”. Dữ liệu đã được tải lại.`);
          return;
        }
        setEvidenceImages(latest.resolutionImages || []);
      })
      .catch((requestError) => {
        if (!active) return;
        if (getApiErrorStatus(requestError) === 404) {
          reportStale('Sự cố không còn tồn tại (có thể đã bị xoá). Dữ liệu đã được tải lại.');
        }
        // Lỗi mạng: vẫn cho thao tác với dữ liệu đang có — server là nơi phán quyết cuối.
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [open, issueId, currentStatus, initialStatus]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  // Trước đây chỉ loại trạng thái hiện tại nên vẫn cho phép 'resolved' ->
  // 'rejected' và ngược lại; backend giờ chặn cả hai (phải quay về 'processing'
  // trước). Lọc theo cùng bảng luật để cán bộ không bấm phải lựa chọn bị từ chối.
  const availableOptions = useMemo(
    () => {
      const targets = getAllowedStatusTargets(currentStatus);
      return STATUS_OPTIONS.filter((option) => targets.includes(option.value));
    },
    [currentStatus],
  );

  const totalEvidenceCount = evidenceImages.length + files.length;
  const needsEvidence = targetStatus === 'resolved';
  // Backend trả REJECT_REASON_REQUIRED nếu từ chối không có lý do — chặn sớm ở đây.
  const needsReason = targetStatus === 'rejected';
  const reasonMissing = needsReason && note.trim().length === 0;
  const canSubmit = Boolean(
    issue
    && targetStatus
    && targetStatus !== currentStatus
    && (!needsEvidence || totalEvidenceCount > 0)
    && !reasonMissing
    && !submitting
    && !checking,
  );

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files || []);
    event.target.value = '';
    setError('');
    if (incoming.length === 0) return;

    const nonImage = incoming.find((file) => !file.type.startsWith('image/'));
    if (nonImage) {
      setError(`"${nonImage.name}" không phải là tệp ảnh.`);
      return;
    }

    const oversized = incoming.find((file) => file.size > MAX_IMAGE_BYTES);
    if (oversized) {
      setError(`"${oversized.name}" vượt quá giới hạn 5 MB.`);
      return;
    }

    if (totalEvidenceCount + incoming.length > MAX_IMAGES) {
      setError(`Mỗi sự cố được tối đa ${MAX_IMAGES} ảnh minh chứng.`);
      return;
    }

    setFiles((current) => [...current, ...incoming]);
  };

  const handleSubmit = async () => {
    if (!issue || !targetStatus || !canSubmit) return;

    setSubmitting(true);
    setError('');
    let evidenceUploaded = false;

    try {
      if (targetStatus === 'resolved' && files.length > 0) {
        const formData = new FormData();
        files.forEach((file) => formData.append('images', file));

        const uploadResponse = await issueApi.uploadResolutionImages(issue._id, formData);
        setEvidenceImages(uploadResponse.data.data.resolutionImages);
        setFiles([]);
        evidenceUploaded = true;
      }

      await issueApi.updateIssueStatus(issue._id, targetStatus, note.trim() || undefined);
      const statusLabel = STATUS_OPTIONS.find((option) => option.value === targetStatus)?.label;
      onCompleted(`Đã chuyển sự cố sang “${statusLabel}”.`);
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, 'Không thể cập nhật trạng thái sự cố.');
      const fullMessage = evidenceUploaded
        ? `Ảnh minh chứng đã được lưu nhưng chưa đổi được trạng thái. ${message}`
        : message;
      const code = getApiErrorCode(requestError);
      const status = getApiErrorStatus(requestError);
      // 409: người khác vừa đổi trạng thái trong lúc hộp thoại đang mở; 404: phiếu đã
      // bị xoá. Báo lý do của server rồi để nơi gọi tải lại dữ liệu.
      const stale = (code !== undefined && STALE_ERROR_CODES.has(code)) || status === 409 || status === 404;
      if (stale && onStaleRef.current) onStaleRef.current(fullMessage);
      else setError(fullMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const currentStatusStyle = currentStatus ? STATUS_MAP[currentStatus] : null;

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: '#FFFFFF',
          border: '1px solid #DCE7EB',
        },
      }}
    >
      <DialogTitle sx={{ pr: 7 }}>
        <Typography variant="h6" fontWeight={700}>
          Cập nhật trạng thái
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {issue?.title}
        </Typography>
        <IconButton
          aria-label="Đóng"
          onClick={onClose}
          disabled={submitting}
          sx={{ position: 'absolute', top: 12, right: 12 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Trạng thái hiện tại:
            </Typography>
            <Chip
              size="small"
              label={currentStatusStyle?.label || '—'}
              sx={currentStatusStyle
                ? { bgcolor: currentStatusStyle.bg, color: currentStatusStyle.text, fontWeight: 600 }
                : undefined}
            />
            {checking && (
              <Stack direction="row" spacing={0.75} alignItems="center" role="status">
                <CircularProgress size={14} />
                <Typography variant="caption" color="text.secondary">
                  Đang kiểm tra dữ liệu mới nhất...
                </Typography>
              </Stack>
            )}
          </Stack>

          <FormControl fullWidth>
            <InputLabel id="staff-target-status-label">Trạng thái mới</InputLabel>
            <Select
              labelId="staff-target-status-label"
              value={targetStatus}
              label="Trạng thái mới"
              onChange={(event: SelectChangeEvent<TargetStatus>) => {
                setTargetStatus(event.target.value as TargetStatus);
                setError('');
              }}
            >
              <MenuItem value="" disabled>Chọn trạng thái</MenuItem>
              {availableOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: option.color,
                      }}
                    />
                    <span>{option.label}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label={needsReason ? 'Lý do từ chối' : 'Ghi chú xử lý'}
            required={needsReason}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            multiline
            minRows={3}
            inputProps={{ maxLength: 500 }}
            helperText={needsReason
              ? `Bắt buộc — người báo cáo sẽ đọc được lý do này · ${note.length}/500 ký tự`
              : `${note.length}/500 ký tự`}
            placeholder={needsReason
              ? 'VD: Vị trí thuộc phạm vi quản lý của đơn vị khác; đã chuyển thông tin cho...'
              : 'Mô tả công việc đã thực hiện hoặc lý do thay đổi trạng thái...'}
          />

          {needsEvidence && (
            <Box
              sx={{
                p: 2,
                borderRadius: 2.5,
                border: '1px dashed rgba(11,94,142,0.35)',
                bgcolor: 'rgba(11,94,142,0.05)',
              }}
            >
              <Stack spacing={1.5}>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PhotoLibrary color="primary" />
                    <Typography fontWeight={700}>Ảnh minh chứng sau xử lý</Typography>
                    <Chip
                      size="small"
                      label={`${totalEvidenceCount}/${MAX_IMAGES}`}
                      color={totalEvidenceCount > 0 ? 'success' : 'warning'}
                      variant="outlined"
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Bắt buộc ít nhất 1 ảnh; JPG, PNG, GIF hoặc WEBP, tối đa 5 MB mỗi ảnh.
                  </Typography>
                </Box>

                {evidenceImages.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Ảnh đã tải lên
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))',
                        gap: 1,
                        mt: 0.75,
                      }}
                    >
                      {evidenceImages.map((image, index) => (
                        <Box
                          component="img"
                          key={`${image.url}-${index}`}
                          src={image.url}
                          alt={`Ảnh minh chứng ${index + 1}`}
                          sx={{
                            width: '100%',
                            height: 88,
                            objectFit: 'cover',
                            borderRadius: 1.5,
                            border: '1px solid #DCE7EB',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {files.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Ảnh sẽ tải lên
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))',
                        gap: 1,
                        mt: 0.75,
                      }}
                    >
                      {files.map((file, index) => (
                        <Box key={`${file.name}-${file.lastModified}`} sx={{ position: 'relative' }}>
                          <Box
                            component="img"
                            src={previewUrls[index]}
                            alt={file.name}
                            sx={{
                              width: '100%',
                              height: 88,
                              objectFit: 'cover',
                              borderRadius: 1.5,
                              border: '1px solid #DCE7EB',
                            }}
                          />
                          <Tooltip title="Bỏ ảnh">
                            <IconButton
                              size="small"
                              onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                              sx={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                bgcolor: 'rgba(24,50,63,0.82)',
                                color: '#FFFFFF',
                                '&:hover': { bgcolor: '#C95757' },
                              }}
                            >
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<AddPhotoAlternate />}
                  disabled={totalEvidenceCount >= MAX_IMAGES || submitting}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Chọn ảnh
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    onChange={handleFilesSelected}
                  />
                </Button>

                {totalEvidenceCount === 0 && (
                  <Alert severity="warning">
                    Cần chọn ít nhất một ảnh trước khi có thể hoàn tất sự cố.
                  </Alert>
                )}
              </Stack>
            </Box>
          )}

          {needsReason && (
            <Alert severity="warning">
              Người báo cáo sẽ nhận thông báo sự cố bị từ chối kèm lý do bạn ghi ở trên.
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={submitting} color="inherit">
          Hủy
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit}
          startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          {submitting
            ? needsEvidence && files.length > 0
              ? 'Đang tải ảnh...'
              : 'Đang cập nhật...'
            : 'Lưu trạng thái'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpdateStatusDialog;
