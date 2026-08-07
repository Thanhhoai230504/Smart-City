import React, { ChangeEvent, useEffect, useMemo, useState } from 'react';
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
import {
  Issue,
  IssueStatus,
  ResolutionImage,
} from '../../types';

interface ApiErrorResponse {
  message?: string;
  errors?: Array<{ message: string }>;
}

interface Props {
  issue: Issue | null;
  open: boolean;
  onClose: () => void;
  onCompleted: (message: string) => void;
}

type EditableStatus = Exclude<IssueStatus, 'reported'>;
type TargetStatus = EditableStatus | '';

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const STATUS_OPTIONS: Array<{ value: EditableStatus; label: string; color: string }> = [
  { value: 'processing', label: 'Đang xử lý', color: '#3B82F6' },
  { value: 'resolved', label: 'Đã xử lý', color: '#10B981' },
  { value: 'rejected', label: 'Từ chối', color: '#EF4444' },
];

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) return fallback;
  return error.response?.data?.errors?.[0]?.message
    || error.response?.data?.message
    || fallback;
};

const UpdateStatusDialog: React.FC<Props> = ({
  issue,
  open,
  onClose,
  onCompleted,
}) => {
  const [targetStatus, setTargetStatus] = useState<TargetStatus>('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [evidenceImages, setEvidenceImages] = useState<ResolutionImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTargetStatus('');
    setNote('');
    setFiles([]);
    setEvidenceImages(issue?.resolutionImages || []);
    setError('');
  }, [issue, open]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const availableOptions = useMemo(
    () => STATUS_OPTIONS.filter((option) => option.value !== issue?.status),
    [issue?.status],
  );

  const totalEvidenceCount = evidenceImages.length + files.length;
  const needsEvidence = targetStatus === 'resolved';
  const canSubmit = Boolean(
    issue
    && targetStatus
    && targetStatus !== issue.status
    && (!needsEvidence || totalEvidenceCount > 0)
    && !submitting,
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
      const message = getErrorMessage(requestError, 'Không thể cập nhật trạng thái sự cố.');
      setError(evidenceUploaded
        ? `Ảnh minh chứng đã được lưu nhưng chưa đổi được trạng thái. ${message}`
        : message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: '#141B2D',
          border: '1px solid rgba(255,255,255,0.08)',
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
              label={issue?.status === 'reported'
                ? 'Mới báo cáo'
                : issue?.status === 'processing'
                  ? 'Đang xử lý'
                  : issue?.status === 'resolved'
                    ? 'Đã xử lý'
                    : 'Từ chối'}
            />
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
            label="Ghi chú xử lý"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            multiline
            minRows={3}
            inputProps={{ maxLength: 500 }}
            helperText={`${note.length}/500 ký tự`}
            placeholder="Mô tả công việc đã thực hiện hoặc lý do thay đổi trạng thái..."
          />

          {needsEvidence && (
            <Box
              sx={{
                p: 2,
                borderRadius: 2.5,
                border: '1px dashed rgba(14,165,233,0.35)',
                bgcolor: 'rgba(14,165,233,0.05)',
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
                            border: '1px solid rgba(255,255,255,0.08)',
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
                              border: '1px solid rgba(255,255,255,0.08)',
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
                                bgcolor: 'rgba(12,18,34,0.85)',
                                '&:hover': { bgcolor: 'rgba(239,68,68,0.9)' },
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

          {targetStatus === 'rejected' && (
            <Alert severity="warning">
              Người báo cáo sẽ nhận thông báo sự cố bị từ chối. Hãy ghi rõ lý do.
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
