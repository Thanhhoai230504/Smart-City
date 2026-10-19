import React, { useState } from 'react';
import { Alert, Button, Card, CardContent, CircularProgress, Typography } from '@mui/material';
import { AssignmentInd, EditNote } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { issueApi } from '../../api/issueApi';
import { getApiErrorMessage } from '../../utils/apiError';
import type { StaffIssueAction } from '../../utils/assignment';
import type { Issue } from '../../types';

interface Props {
  issue: Issue;
  /** Tính bằng getStaffIssueAction (utils/assignment.ts) — cùng luật với backend. */
  action: StaffIssueAction;
  /** Mở hộp thoại đổi trạng thái dùng chung (UpdateStatusDialog). */
  onOpenStatus: () => void;
  /** Tải lại phiếu sau khi nhận việc (thành công hay thất bại đều tải lại). */
  onChanged: () => void;
}

/**
 * Khung "Xử lý sự cố" của cán bộ trên trang chi tiết: nhận việc hoặc cập nhật trạng
 * thái ngay tại đây, không phải quay lại bàn làm việc. Quản trị viên có khung riêng
 * ở cột bên phải.
 */
const StaffIssueActions: React.FC<Props> = ({ issue, action, onOpenStatus, onChanged }) => {
  const [claiming, setClaiming] = useState(false);

  if (action.kind === 'none') return null;

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      await issueApi.claimIssue(issue._id);
      toast.success('Bạn đã nhận xử lý sự cố này. Phiếu nằm trong tab “Việc của tôi”.');
    } catch (requestError) {
      // Thường là người khác vừa nhận trước hoặc phiếu vừa đổi: tải lại để khung hiện đúng.
      toast.error(getApiErrorMessage(requestError, 'Không thể nhận công việc này.'));
    } finally {
      setClaiming(false);
      onChanged();
    }
  };

  return (
    <Card sx={{ mb: 3, bgcolor: 'rgba(11,94,142,0.05)', border: '1px solid rgba(11,94,142,0.18)' }}>
      <CardContent>
        <Typography fontWeight={600} color="primary.main" mb={1}>
          🛠️ Xử lý sự cố
        </Typography>

        {action.kind === 'claim' && (
          <>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Phiếu thuộc đơn vị bạn và chưa có ai nhận. Nhận việc để bắt đầu xử lý và cập nhật
              trạng thái ngay tại trang này.
            </Typography>
            <Button
              fullWidth
              variant="contained"
              startIcon={claiming ? <CircularProgress size={18} color="inherit" /> : <AssignmentInd />}
              onClick={handleClaim}
              disabled={claiming}
              sx={{ borderRadius: '10px', py: 1 }}
            >
              {claiming ? 'Đang nhận việc...' : 'Nhận việc'}
            </Button>
          </>
        )}

        {action.kind === 'update' && (
          <>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Bạn đang phụ trách phiếu này. Từ chối cần nêu lý do cho người báo cáo; chuyển sang
              “Đã xử lý” cần ảnh minh chứng sau xử lý.
            </Typography>
            <Button
              fullWidth
              variant="contained"
              startIcon={<EditNote />}
              onClick={onOpenStatus}
              sx={{ borderRadius: '10px', py: 1 }}
            >
              Cập nhật trạng thái
            </Button>
          </>
        )}

        {action.kind === 'taken' && (
          <Alert severity="info">
            Phiếu đang do {action.assigneeName ? `cán bộ ${action.assigneeName}` : 'một cán bộ khác'} phụ
            trách. Chỉ người phụ trách mới cập nhật được trạng thái.
          </Alert>
        )}

        {action.kind === 'closed' && (
          <Alert severity="info">
            Sự cố đã đóng. Cần xử lý tiếp thì quản trị viên mở lại sự cố trước.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default StaffIssueActions;
