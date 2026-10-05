import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import {
  fetchIssueById,
  clearCurrentIssue,
  currentIssueRefreshed,
  IssueRequestFailure,
} from '../../store/slices/issueSlice';
import { SOCKET_RECONNECTED, useSocket } from '../../hooks/useSocket';
import { commentApi } from '../../api/commentApi';
import { issueApi } from '../../api/issueApi';
import {
  Box, Container, Typography, Chip, Card, CardContent, Stack, Button,
  Grid, Divider, Avatar, TextField, Stepper, Step, StepLabel, StepConnector,
  IconButton, Rating, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { BASE_TILE_ATTRIBUTION, BASE_TILE_URL } from '../../utils/mapTiles';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowBack, LocationOn, Person, CalendarMonth, Send,
  FiberManualRecord, CheckCircle, Pending, Cancel,
  Phone, Email, Description, ThumbUp, ThumbUpOffAlt,
  Facebook, ContentCopy, AssignmentInd, EditNote,
  SearchOff, ErrorOutline, Refresh, FormatListBulleted,
} from '@mui/icons-material';
import { CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';
import { getReopenEligibility, getReopenRules, REOPEN_BLOCK_MESSAGES, ReopenBlockReason } from '../../utils/reopen';
import { canRateIssue, MAX_RATING_COMMENT_LENGTH } from '../../utils/rating';
import { formatDate, escapeHtml } from '../../utils/helpers';
import { Comment, Department, Issue, Pagination } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import SlaBadge from '../../components/SlaBadge';
import PriorityBadge from '../../components/PriorityBadge';
import IssuePhotoComparison from './IssuePhotoComparison';
import PreviousRounds from './PreviousRounds';
import NearbyCameras from './NearbyCameras';
import NearbyIssues from './NearbyIssues';
import AssignIssueDialog from '../../components/AssignIssueDialog';
import { canAssignIssue } from '../../utils/assignment';
import { getApiErrorCode, getApiErrorMessage } from '../../utils/apiError';
import UpdateStatusDialog from '../StaffDashboard/UpdateStatusDialog';
import { toast } from 'react-toastify';

const CATEGORY_LABELS_VN: Record<string, string> = {
  pothole: 'Ổ gà / Hư hỏng đường', garbage: 'Rác thải', streetlight: 'Đèn đường hỏng',
  flooding: 'Ngập nước', tree: 'Cây đổ', other: 'Khác',
};

// Timeline connector
const TimelineConnector = styled(StepConnector)(() => ({
  '& .MuiStepConnector-line': {
    borderColor: '#C8D9DE',
    borderLeftWidth: 2,
    minHeight: 28,
  },
}));

const statusStepIcons: Record<string, React.ReactNode> = {
  reported: <FiberManualRecord sx={{ color: '#EF4444', fontSize: 20 }} />,
  processing: <Pending sx={{ color: '#F59E0B', fontSize: 20 }} />,
  resolved: <CheckCircle sx={{ color: '#10B981', fontSize: 20 }} />,
  rejected: <Cancel sx={{ color: '#6B7280', fontSize: 20 }} />,
};

const statusLabels: Record<string, string> = {
  reported: 'Mới báo cáo',
  processing: 'Đang xử lý',
  resolved: 'Đã xử lý',
  rejected: 'Từ chối',
};

/**
 * 404 (phiếu đã xoá) hoặc 400 không kèm mã nghiệp vụ (id sai định dạng — lỗi
 * CastError của Mongoose) đều nghĩa là "không có sự cố này"; thử lại vô ích.
 */
const isNotFoundFailure = (failure: IssueRequestFailure) => (
  failure.status === 404 || (failure.status === 400 && !failure.code)
);

const toLoadFailure = (rejection: unknown): IssueRequestFailure => {
  // Payload của rejectWithValue có `message` nhưng không có `name`; lỗi JS bị
  // serialize (SerializedError) thì có `name` và message tiếng Anh — không hiện ra.
  const candidate = rejection as (Partial<IssueRequestFailure> & { name?: unknown }) | null;
  if (candidate && typeof candidate === 'object' && typeof candidate.message === 'string' && candidate.name === undefined) {
    return { message: candidate.message, status: candidate.status, code: candidate.code };
  }
  return { message: 'Không tải được sự cố. Vui lòng kiểm tra kết nối và thử lại.' };
};

/**
 * Trạng thái lỗi của trang chi tiết.
 *
 * Trước đây trang chỉ có `if (loading || !issue) return <LoadingSpinner />`: id
 * sai, phiếu đã xoá hay mất mạng đều quay vòng "Đang tải..." mãi mãi (thường gặp
 * khi mở link chia sẻ hoặc thông báo của một phiếu đã bị xoá).
 */
const IssueLoadError: React.FC<{ failure: IssueRequestFailure; onRetry: () => void }> = ({ failure, onRetry }) => {
  const notFound = isNotFoundFailure(failure);
  return (
    <Container maxWidth="sm">
      <Stack
        role="alert"
        alignItems="center"
        textAlign="center"
        spacing={2}
        sx={{ minHeight: '55vh', justifyContent: 'center', py: 8 }}
      >
        {notFound
          ? <SearchOff sx={{ fontSize: 56, color: 'text.disabled' }} />
          : <ErrorOutline sx={{ fontSize: 56, color: 'warning.main' }} />}
        <Typography variant="h5" component="h1" fontWeight={700}>
          {notFound ? 'Không tìm thấy sự cố' : 'Không tải được sự cố'}
        </Typography>
        <Typography color="text.secondary" maxWidth={440}>
          {notFound
            ? 'Sự cố này có thể đã bị xoá hoặc đường dẫn không còn đúng. Bạn có thể tìm các phản ánh khác trong danh sách.'
            : failure.message}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} pt={1}>
          {!notFound && (
            <Button variant="contained" startIcon={<Refresh />} onClick={onRetry}>
              Thử lại
            </Button>
          )}
          <Button
            component={RouterLink}
            to="/issues"
            variant={notFound ? 'contained' : 'outlined'}
            startIcon={<FormatListBulleted />}
          >
            Quay lại danh sách
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
};

/**
 * Ai đổi trạng thái gần nhất. `adminId` là tài khoản gọi API đổi trạng thái lần
 * cuối — thường là CÁN BỘ của đơn vị, không phải quản trị viên — nên tiêu đề nói
 * đúng việc đã làm thay vì "Xử lý bởi Admin" như trước. Người dân mở lại phiếu
 * không đổi `adminId`, nên thời điểm lấy từ chính dòng lịch sử của người này chứ
 * không lấy dòng cuối cùng (có thể là lượt mở lại của người dân).
 */
const getLastHandlerSummary = (issue: Issue, handlerId: string) => {
  const entryOf = (entry: NonNullable<Issue['statusHistory']>[number]) => (
    typeof entry.changedBy === 'string' ? entry.changedBy : entry.changedBy?._id
  );
  const handlerEntry = [...(issue.statusHistory || [])].reverse()
    .find((entry) => entryOf(entry) === handlerId) || null;

  if (issue.status === 'resolved') {
    return {
      title: 'Hoàn tất bởi',
      timeLabel: 'Hoàn tất lúc',
      time: issue.resolvedAt || handlerEntry?.changedAt || null,
      titleColor: 'success.main',
      bgcolor: 'rgba(46,125,50,0.06)',
      borderColor: 'rgba(46,125,50,0.22)',
    };
  }
  if (issue.status === 'rejected') {
    return {
      title: 'Từ chối bởi',
      timeLabel: 'Từ chối lúc',
      time: handlerEntry?.status === 'rejected' ? handlerEntry.changedAt : null,
      titleColor: 'text.primary',
      bgcolor: 'rgba(107,114,128,0.06)',
      borderColor: 'rgba(107,114,128,0.22)',
    };
  }
  return {
    title: 'Cập nhật gần nhất bởi',
    timeLabel: handlerEntry
      ? `Chuyển sang “${statusLabels[handlerEntry.status] || handlerEntry.status}” lúc`
      : 'Cập nhật lúc',
    time: handlerEntry?.changedAt || null,
    titleColor: 'primary.main',
    bgcolor: 'rgba(11,94,142,0.05)',
    borderColor: 'rgba(11,94,142,0.18)',
  };
};

const IssueDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  // Không đọc `loading`/`error` dùng chung của slice: chúng phục vụ cả danh sách,
  // chi tiết lẫn tạo mới nên lỗi của trang khác có thể "rò" sang đây.
  const { currentIssue: issue } = useSelector((s: RootState) => s.issues);
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentPagination, setCommentPagination] = useState<Pagination | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Tải chi tiết: lỗi lấy từ kết quả thunk (unwrap) của CHÍNH request này.
  const [loadFailure, setLoadFailure] = useState<IssueRequestFailure | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Đổi trạng thái (quản trị viên) — dùng chung hộp thoại với cổng cán bộ.
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  // Vote
  const [voteCount, setVoteCount] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);

  // Rating
  const [ratingScore, setRatingScore] = useState<number | null>(null);
  const [ratingComment, setRatingComment] = useState('');
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [submittingReopen, setSubmittingReopen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    if (!id) return undefined;
    let active = true;
    setLoadFailure(null);
    const request = dispatch(fetchIssueById(id));
    request.unwrap().catch((rejection: unknown) => {
      // Huỷ vì rời trang / đổi sang phiếu khác thì không phải lỗi.
      if (!active || (rejection as { name?: string } | null)?.name === 'AbortError') return;
      setLoadFailure(toLoadFailure(rejection));
    });
    return () => {
      active = false;
      request.abort();
      dispatch(clearCurrentIssue());
    };
  }, [dispatch, id, reloadToken]);

  // Làm mới tại chỗ (không bật màn chờ): sau khi đổi trạng thái, đánh giá, mở lại,
  // phân công hoặc khi có thông báo realtime về chính phiếu này. Lỗi thì giữ bản
  // đang hiển thị — thao tác kế tiếp sẽ tự báo lỗi nếu phiếu thật sự đã đổi.
  const refreshIssue = useCallback(() => {
    if (!id) return;
    issueApi.getIssueById(id)
      .then(({ data: res }) => dispatch(currentIssueRefreshed(res.data.issue)))
      .catch(() => { /* giữ bản đang hiển thị */ });
  }, [dispatch, id]);

  useEffect(() => {
    if (issue) {
      setVoteCount(issue.voteCount || 0);
      setHasVoted(user ? (issue.hasVoted ?? (issue.votes || []).includes(user._id)) : false);
    }
  }, [issue, user]);

  const loadComments = useCallback(async (page = 1, signal?: AbortSignal) => {
    if (!id) return;
    setCommentsLoading(true);
    try {
      const { data } = await commentApi.getComments(id, page, signal);
      setComments((previous) => page === 1
        ? data.data.comments
        : [...data.data.comments, ...previous]);
      setCommentPagination(data.data.pagination);
    } catch { /* ignore */ }
    setCommentsLoading(false);
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    loadComments(1, controller.signal);
    return () => controller.abort();
  }, [loadComments]);

  // Thông báo realtime về chính phiếu đang mở (đổi trạng thái, được phân công,
  // bình luận mới…) → cập nhật tại chỗ, không bắt người xem tải lại trang.
  useSocket((event, data) => {
    if (!id) return;
    const aboutThisIssue = event === SOCKET_RECONNECTED
      || (event === 'notification:new' && String(data?.issueId) === id);
    if (!aboutThisIssue) return;
    refreshIssue();
    if (event === SOCKET_RECONNECTED || data?.type === 'comment') loadComments(1);
  });

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !id || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await commentApi.addComment(id, newComment.trim());
      setComments((prev) => [...prev, data.data.comment]);
      setCommentPagination((prev) => prev ? { ...prev, total: prev.total + 1 } : prev);
      setNewComment('');
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  const handleStatusCompleted = (message: string) => {
    setStatusDialogOpen(false);
    toast.success(message);
    refreshIssue();
  };

  // 409 STATUS_CONFLICT (người khác vừa đổi trạng thái), phiếu bị gộp/xoá: hiện đúng
  // lý do của server rồi tải lại để trang khớp thực tế.
  const handleStatusStale = (message: string) => {
    setStatusDialogOpen(false);
    toast.warning(message);
    refreshIssue();
  };

  const handleVote = async () => {
    if (!isAuthenticated || !id || voting) return;
    setVoting(true);
    try {
      const { data } = await issueApi.toggleVote(id);
      setVoteCount(data.data.voteCount);
      setHasVoted(data.data.voted);
    } catch { /* ignore */ }
    setVoting(false);
  };

  const shareUrl = window.location.href;
  const handleShare = (platform: string) => {
    const urls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      zalo: `https://zalo.me/share?url=${encodeURIComponent(shareUrl)}`,
    };
    if (platform === 'copy') {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Đã sao chép liên kết!');
      return;
    }
    window.open(urls[platform], '_blank', 'width=600,height=400');
  };

  // Chỉ coi là "đã có dữ liệu" khi đúng phiếu của URL hiện tại.
  if (!issue || issue._id !== id) {
    if (loadFailure) {
      return <IssueLoadError failure={loadFailure} onRetry={() => setReloadToken((token) => token + 1)} />;
    }
    return <LoadingSpinner text="Đang tải sự cố..." />;
  }

  const cat = CATEGORY_MAP[issue.category] || CATEGORY_MAP.other;
  const st = STATUS_MAP[issue.status] || STATUS_MAP.reported;
  const reporter = typeof issue.userId === 'object' ? issue.userId : null;
  const isAdmin = user?.role === 'admin';
  const mergedTarget = issue.mergedInto && typeof issue.mergedInto === 'object'
    ? issue.mergedInto
    : null;
  const canChangeStatus = isAdmin
    && !issue.mergedInto
    && !['resolved', 'rejected'].includes(issue.status);
  // Cùng điều kiện với backend (utils/rating.ts): kể cả phiếu bị TỪ CHỐI, mà
  // trước đây web bỏ sót — người dân có phiếu bị từ chối không có kênh phản hồi.
  const canRate = canRateIssue(issue, user?._id);
  const hasRated = !!issue.rating?.score;
  // Mở lại sự cố (G8): đường quay lại duy nhất của người báo cáo khi không đồng ý
  // kết quả. Điều kiện ở đây chỉ để ẩn/hiện nút — backend mới là nơi phán quyết
  // (đúng người, số lần, cửa sổ 30 ngày) và trả mã lỗi tương ứng.
  // Cùng thứ tự kiểm tra với backend (utils/reopen.ts) — kể cả cửa sổ thời gian,
  // mà trước đây client bỏ qua nên nút vẫn hiện sau 30 ngày rồi mới bị từ chối.
  const reopenRules = getReopenRules();
  const reopen = getReopenEligibility(issue, user?._id);
  const canReopen = reopen.allowed;
  // Người báo cáo đã hết lượt hoặc quá hạn: nói rõ thay vì để thẻ biến mất không lý do.
  const reopenExhausted = reopen.reason === 'REOPEN_LIMIT_REACHED' || reopen.reason === 'REOPEN_WINDOW_EXPIRED';
  // Đơn vị phụ trách lấy từ dữ liệu phân công thật (populate), không còn
  // suy ra từ category bằng danh sách hardcode.
  const dept = typeof issue.departmentId === 'object' ? (issue.departmentId as Department) : null;
  const assignee = typeof issue.assigneeId === 'object' ? issue.assigneeId : null;
  // Admin bấm vào thông báo "có sự cố mới" là phân công được ngay tại đây, không phải
  // quay lại tab Phân công tìm sự cố. Cùng điều kiện với backend (utils/assignment.ts).
  const canAssign = canAssignIssue(issue, user?.role);
  const lastHandler = issue.adminId && typeof issue.adminId === 'object' ? issue.adminId : null;
  const lastHandlerSummary = lastHandler ? getLastHandlerSummary(issue, lastHandler._id) : null;

  const handleReopen = async () => {
    if (!id || reopenReason.trim().length < reopenRules.minReasonLength || submittingReopen) return;
    setSubmittingReopen(true);
    try {
      await issueApi.reopenIssue(id, { reason: reopenReason.trim() });
      toast.success('Đã mở lại sự cố. Đơn vị phụ trách sẽ xem xét lại.');
      refreshIssue();
      setReopenOpen(false);
      setReopenReason('');
    } catch (err: unknown) {
      // Phân nhánh theo mã lỗi, không so chuỗi. Bị từ chối vì một rào chắn thì tải
      // lại phiếu để nút ẩn đi — nếu không người dùng bấm lại vẫn nhận cùng lỗi.
      const code = getApiErrorCode(err) as ReopenBlockReason | undefined;
      const known = code && REOPEN_BLOCK_MESSAGES[code];
      toast.error(known ? known(reopenRules) : getApiErrorMessage(err, 'Mở lại sự cố thất bại.'));
      if (known) {
        setReopenOpen(false);
        refreshIssue();
      }
    }
    setSubmittingReopen(false);
  };

  const handleRating = async () => {
    if (!ratingScore || !id || submittingRating) return;
    setSubmittingRating(true);
    try {
      await issueApi.rateIssue(id, { score: ratingScore, comment: ratingComment.trim() || undefined });
      toast.success('Đánh giá thành công! Cảm ơn bạn.');
      refreshIssue();
      setRatingScore(null);
      setRatingComment('');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Đánh giá thất bại.'));
      // Phiếu đã đổi trạng thái hoặc đã được đánh giá ở tab khác: tải lại để nút ẩn đi.
      const code = getApiErrorCode(err);
      if (code === 'ALREADY_RATED' || code === 'ISSUE_NOT_CLOSED') refreshIssue();
    }
    setSubmittingRating(false);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 3, color: 'text.secondary' }}>
        Quay lại
      </Button>

      <Grid container spacing={4}>
        <Grid item xs={12} md={7}>
          <Stack direction="row" spacing={1} mb={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip label={cat.label} icon={<span>{cat.icon}</span>} sx={{ bgcolor: `${cat.color}20`, color: cat.color, fontWeight: 600 }} />
            <Chip label={st.label} sx={{ bgcolor: st.bg, color: st.text, fontWeight: 600 }} />
            <SlaBadge status={issue.slaStatus} dueAt={issue.dueAt} showRemaining />
            <PriorityBadge issue={issue} />
          </Stack>

          {issue.mergedInto && (
            <Alert
              severity="info"
              sx={{ mb: 2.5 }}
              action={mergedTarget ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => navigate(`/issues/${mergedTarget._id}`)}
                >
                  Xem sự cố gốc
                </Button>
              ) : undefined}
            >
              Báo cáo này đã được xác định là trùng lặp và được gộp
              {mergedTarget ? ` vào “${mergedTarget.title}”` : ' vào một sự cố khác'}.
            </Alert>
          )}

          <Typography variant="h4" fontWeight={700} mb={1}>{issue.title}</Typography>

          {/* Vote + Share */}
          <Stack direction="row" alignItems="center" spacing={1.5} mb={2} flexWrap="wrap">
            <Button
              variant={hasVoted ? 'contained' : 'outlined'}
              size="small"
              startIcon={hasVoted ? <ThumbUp /> : <ThumbUpOffAlt />}
              onClick={handleVote}
              disabled={voting || !isAuthenticated}
              sx={{
                borderRadius: '20px', textTransform: 'none', fontWeight: 600,
                ...(hasVoted && { bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }),
              }}
            >
              {voteCount} Ủng hộ
            </Button>
            <Button size="small" startIcon={<Facebook />} onClick={() => handleShare('facebook')}
              sx={{ borderRadius: '20px', textTransform: 'none', color: '#1877F2', border: '1px solid rgba(24,119,242,0.3)' }}>
              Facebook
            </Button>
            <Button size="small" onClick={() => handleShare('zalo')}
              sx={{ borderRadius: '20px', textTransform: 'none', color: '#0068FF', border: '1px solid rgba(0,104,255,0.3)' }}>
              Zalo
            </Button>
            <IconButton aria-label="Sao chép liên kết" size="small" onClick={() => handleShare('copy')} sx={{ color: 'text.secondary' }}>
              <ContentCopy fontSize="small" />
            </IconButton>
          </Stack>

          <Stack spacing={1.5} mb={3}>
            <Stack direction="row" spacing={1} alignItems="center">
              <LocationOn sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography color="text.secondary">{issue.location}</Typography>
            </Stack>
            {reporter && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Person sx={{ color: 'text.secondary', fontSize: 20 }} />
                <Typography color="text.secondary">Báo cáo bởi: {reporter.name}</Typography>
              </Stack>
            )}
            {issue.phone && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Phone sx={{ color: 'text.secondary', fontSize: 20 }} />
                <Typography color="text.secondary">
                  SĐT liên hệ:{' '}
                  <Box component="a" href={`tel:${issue.phone}`}
                    sx={{ color: '#10B981', textDecoration: 'none', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}>
                    {issue.phone}
                  </Box>
                </Typography>
              </Stack>
            )}
            <Stack direction="row" spacing={1} alignItems="center">
              <CalendarMonth sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography color="text.secondary">{formatDate(issue.createdAt)}</Typography>
            </Stack>
          </Stack>

          <Divider sx={{ mb: 3, borderColor: '#DCE7EB' }} />

          <Typography variant="h6" fontWeight={600} mb={1.5}>Mô tả</Typography>
          <Typography color="text.secondary" lineHeight={1.8} mb={3}>{issue.description}</Typography>

          <IssuePhotoComparison issue={issue} />

          {/* Lượt xử lý cũ (phiếu từng bị mở lại): minh chứng + đánh giá cũ để đối chiếu */}
          <PreviousRounds rounds={issue.previousRounds} />

          {/* STATUS TIMELINE */}
          {issue.statusHistory && issue.statusHistory.length > 0 && (
            <Card sx={{ mb: 3, bgcolor: '#FFFFFF', border: '1px solid #DCE7EB' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} mb={2}>📋 Timeline trạng thái</Typography>
                <Stepper orientation="vertical" connector={<TimelineConnector />}
                  activeStep={issue.statusHistory.length - 1}>
                  {issue.statusHistory.map((entry, idx) => (
                    <Step key={idx} completed>
                      <StepLabel
                        StepIconComponent={() => (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', bgcolor: `${STATUS_MAP[entry.status]?.color || '#666'}20` }}>
                            {statusStepIcons[entry.status] || <FiberManualRecord sx={{ fontSize: 16 }} />}
                          </Box>
                        )}
                      >
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography fontWeight={600} sx={{ color: STATUS_MAP[entry.status]?.text || '#18323F' }}>
                            {statusLabels[entry.status] || entry.status}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            — {formatDate(entry.changedAt)}
                          </Typography>
                          {/* "Ai làm gì": backend populate statusHistory.changedBy.
                              Entry cũ chưa populate sẽ là ObjectId thô — chỉ hiện tên
                              khi nhận được object, tránh in ra chuỗi 24 ký tự vô nghĩa. */}
                          {entry.changedBy && typeof entry.changedBy === 'object' && (
                            <Typography variant="caption" color="text.secondary">
                              · bởi {entry.changedBy.name}
                            </Typography>
                          )}
                        </Stack>
                        {entry.note && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
                            {entry.note}
                          </Typography>
                        )}
                      </StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </CardContent>
            </Card>
          )}

          {/* COMMENTS */}
          <Card sx={{ bgcolor: '#FFFFFF', border: '1px solid #DCE7EB' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>
                💬 Bình luận ({commentPagination?.total ?? comments.length})
              </Typography>

              {commentPagination && commentPagination.current < commentPagination.pages && (
                <Button
                  size="small"
                  variant="text"
                  disabled={commentsLoading}
                  onClick={() => loadComments(commentPagination.current + 1)}
                  sx={{ mb: 2 }}
                >
                  {commentsLoading ? 'Đang tải...' : 'Xem bình luận cũ hơn'}
                </Button>
              )}

              {comments.length === 0 ? (
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Chưa có bình luận nào
                </Typography>
              ) : (
                <Stack spacing={2} mb={3}>
                  {comments.map((c) => (
                    <Box key={c._id} sx={{
                      p: 2, borderRadius: '12px',
                      bgcolor: c.userId.role === 'admin' ? '#EFF7F9' : '#F7FAFA',
                      borderLeft: '3px solid',
                      borderColor: c.userId.role === 'admin' ? 'primary.main' : '#C8D9DE',
                    }}>
                      <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: c.userId.role === 'admin' ? 'primary.main' : 'secondary.main' }}>
                          {c.userId.name?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="body2" fontWeight={600}>{c.userId.name}</Typography>
                        {c.userId.role === 'admin' && (
                          <Chip label="Admin" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(11,94,142,0.12)', color: 'primary.main' }} />
                        )}
                        <Typography variant="caption" color="text.secondary">{formatDate(c.createdAt)}</Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 4.5 }}>{c.content}</Typography>
                    </Box>
                  ))}
                </Stack>
              )}

              {isAuthenticated && (
                <Stack direction="row" spacing={1}>
                  <TextField
                    fullWidth size="small" placeholder="Viết bình luận..."
                    value={newComment} onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitComment()}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#FFFFFF' } }}
                  />
                  <Button variant="contained" onClick={handleSubmitComment} disabled={!newComment.trim() || submitting}
                    sx={{ borderRadius: '12px', minWidth: 44 }}>
                    <Send sx={{ fontSize: 18 }} />
                  </Button>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right side: Mini Map + Admin Controls + Admin info */}
        <Grid item xs={12} md={5}>
          <Card sx={{ overflow: 'hidden', p: 0, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ p: 2, pb: 1 }}>📍 Vị trí trên bản đồ</Typography>
            <Box sx={{ height: 350 }}>
              <MapContainer center={[issue.latitude, issue.longitude]} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer url={BASE_TILE_URL} attribution={BASE_TILE_ATTRIBUTION} />
                <Marker position={[issue.latitude, issue.longitude]}
                  icon={L.divIcon({
                    html: `<div style="background:#EF4444;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${cat.icon}</div>`,
                    className: '', iconSize: [32, 32], iconAnchor: [16, 32],
                  })} />
              </MapContainer>
            </Box>
            <Box sx={{ p: 2, pt: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                Tọa độ: {issue.latitude.toFixed(4)}, {issue.longitude.toFixed(4)}
              </Typography>
            </Box>
          </Card>

          <NearbyIssues issueId={issue._id} latitude={issue.latitude} longitude={issue.longitude} />

          <NearbyCameras latitude={issue.latitude} longitude={issue.longitude} />

          {/* ADMIN CONTROLS — chỉ hiện cho admin khi sự cố chưa xử lý xong. Đổi trạng
              thái đi qua hộp thoại dùng chung: từ chối bắt buộc lý do, báo đã xử lý bắt
              buộc ảnh minh chứng — đúng như backend kiểm tra. */}
          {canChangeStatus && (
            <Card sx={{ mb: 3, bgcolor: 'rgba(11,94,142,0.05)', border: '1px solid rgba(11,94,142,0.18)' }}>
              <CardContent>
                <Typography fontWeight={600} color="primary.main" mb={1}>
                  🛠️ Xử lý sự cố
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                  <Typography variant="body2" color="text.secondary">Trạng thái hiện tại:</Typography>
                  <Chip size="small" label={st.label} sx={{ bgcolor: st.bg, color: st.text, fontWeight: 600 }} />
                </Stack>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Từ chối cần nêu lý do cho người báo cáo; chuyển sang “Đã xử lý” cần ảnh minh chứng sau xử lý.
                </Typography>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<EditNote />}
                  onClick={() => setStatusDialogOpen(true)}
                  sx={{ borderRadius: '10px', py: 1 }}
                >
                  Cập nhật trạng thái
                </Button>
              </CardContent>
            </Card>
          )}

          <UpdateStatusDialog
            issue={canChangeStatus ? issue : null}
            open={statusDialogOpen && canChangeStatus}
            onClose={() => setStatusDialogOpen(false)}
            onCompleted={handleStatusCompleted}
            onStale={handleStatusStale}
          />

          {/* ĐƠN VỊ PHỤ TRÁCH — theo phân công thực tế */}
          {isAdmin && (
            <Card sx={{ mb: 3, bgcolor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <CardContent>
                <Typography fontWeight={600} color="#F59E0B" mb={1.5}>
                  📞 Đơn vị phụ trách
                </Typography>
                {!dept ? (
                  <>
                    <Typography variant="body2" color="text.secondary" mb={canAssign ? 1.5 : 0}>
                      Chưa phân công. Hãy phân công sự cố cho một đơn vị để bắt đầu tính hạn xử lý.
                    </Typography>
                    {canAssign && (
                      <Button fullWidth variant="contained" startIcon={<AssignmentInd />} onClick={() => setAssignOpen(true)}>
                        Phân công ngay
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                      <Typography variant="body2" fontWeight={600}>{dept.name}</Typography>
                      <Chip label={dept.code} size="small"
                        sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(245,158,11,0.15)', color: '#FBBF24' }} />
                    </Stack>
                    {assignee && (
                      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        Cán bộ phụ trách: {assignee.name}
                      </Typography>
                    )}
                    <Stack spacing={1}>
                      {dept.phone && (
                        <Button size="small" startIcon={<Phone />}
                          href={`tel:${dept.phone.replace(/\s/g, '')}`}
                          sx={{ justifyContent: 'flex-start', color: '#10B981', textTransform: 'none' }}>
                          {dept.phone}
                        </Button>
                      )}
                      {dept.email && (
                        <Button size="small" startIcon={<Email />}
                          href={`mailto:${dept.email}?subject=Yêu cầu xử lý sự cố: ${issue.title}&body=Kính gửi ${dept.name},%0A%0ASự cố: ${issue.title}%0AĐịa điểm: ${issue.location}%0AMô tả: ${issue.description}%0ATọa độ: ${issue.latitude}, ${issue.longitude}%0A%0AKính đề nghị quý đơn vị xử lý. Trân trọng.`}
                          sx={{ justifyContent: 'flex-start', color: 'primary.main', textTransform: 'none' }}>
                          {dept.email}
                        </Button>
                      )}
                      {!dept.phone && !dept.email && (
                        <Typography variant="caption" color="text.secondary">
                          Đơn vị chưa khai báo số điện thoại / email liên hệ.
                        </Typography>
                      )}
                    </Stack>
                    {canAssign && (
                      <Button size="small" variant="outlined" startIcon={<AssignmentInd />}
                        onClick={() => setAssignOpen(true)} sx={{ mt: 1.5 }}>
                        Phân công lại
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <AssignIssueDialog
            issue={assignOpen ? issue : null}
            onClose={() => setAssignOpen(false)}
            onAssigned={() => {
              setAssignOpen(false);
              toast.success('Đã phân công sự cố và bắt đầu tính SLA.');
              refreshIssue();
            }}
          />

          {/* XUẤT CÔNG VĂN */}
          {isAdmin && (
            <Card sx={{ mb: 3, bgcolor: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <CardContent>
                <Typography fontWeight={600} color="#10B981" mb={1.5}>
                  📄 Xuất công văn
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {dept
                    ? `Tạo công văn yêu cầu xử lý sự cố gửi đến ${dept.name}`
                    : 'Cần phân công sự cố cho một đơn vị trước khi xuất công văn.'}
                </Typography>
                <Button fullWidth variant="outlined" startIcon={<Description />}
                  disabled={!dept}
                  onClick={() => {
                    if (!dept) return;
                    const catLabel = CATEGORY_LABELS_VN[issue.category] || issue.category;
                    const now = new Date();
                    const dateStr = `ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
                    const soCV = `CV-${issue._id?.slice(-6).toUpperCase() || '000000'}`;

                    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Công văn ${escapeHtml(soCV)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Roboto', 'Times New Roman', serif; color: #1a1a1a; padding: 50px; max-width: 800px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 30px; }
  .header h3 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .header p { font-size: 12px; color: #555; margin-top: 4px; }
  .header hr { border: none; border-top: 2px solid #0B5E8E; margin: 12px 80px 0; }
  .meta { display: flex; justify-content: space-between; margin: 20px 0; font-size: 13px; }
  .title { text-align: center; font-size: 16px; font-weight: 700; text-transform: uppercase; margin: 25px 0; color: #1a1a1a; }
  .recipient { font-size: 14px; font-weight: 500; margin-bottom: 20px; }
  .body-text { font-size: 13px; line-height: 1.8; margin-bottom: 15px; text-align: justify; }
  .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  .info-table td { padding: 8px 12px; font-size: 13px; border: 1px solid #e0e0e0; }
  .info-table td:first-child { width: 140px; font-weight: 500; background: #f8f9fa; }
  .signature { text-align: right; margin-top: 40px; font-size: 13px; }
  .signature .name { font-weight: 700; margin-top: 50px; }
  .footer { text-align: center; font-size: 10px; color: #999; margin-top: 60px; border-top: 1px solid #eee; padding-top: 10px; }
  @media print { body { padding: 30px; } .no-print { display: none; } }
</style></head><body>
  <div class="no-print" style="text-align:center;margin-bottom:20px">
    <button onclick="window.print()" style="padding:10px 30px;font-size:14px;background:#0B5E8E;color:white;border:none;border-radius:8px;cursor:pointer">🖨️ In / Lưu PDF</button>
  </div>
  <div class="header">
    <h3>UBND Thành phố Đà Nẵng</h3>
    <p>Hệ thống Giám sát Đô thị Thông minh</p>
    <hr/>
  </div>
  <div class="meta">
    <span>Số: ${escapeHtml(soCV)}</span>
    <span>Đà Nẵng, ${dateStr}</span>
  </div>
  <div class="title">Công văn yêu cầu xử lý sự cố</div>
  <div class="recipient">Kính gửi: ${escapeHtml(dept.name)}</div>
  <div class="body-text">
    Hệ thống Giám sát Đô thị Thông minh thành phố Đà Nẵng đã tiếp nhận báo cáo sự cố từ người dân với nội dung như sau:
  </div>
  <table class="info-table">
    <tr><td>Tiêu đề</td><td>${escapeHtml(issue.title)}</td></tr>
    <tr><td>Loại sự cố</td><td>${escapeHtml(catLabel)}</td></tr>
    <tr><td>Địa chỉ</td><td>${escapeHtml(issue.location)}</td></tr>
    <tr><td>Tọa độ</td><td>${issue.latitude.toFixed(6)}, ${issue.longitude.toFixed(6)}</td></tr>
    <tr><td>Mô tả</td><td>${escapeHtml(issue.description) || 'Không có'}</td></tr>
    <tr><td>Thời gian báo cáo</td><td>${formatDate(issue.createdAt)}</td></tr>
    <tr><td>Người báo cáo</td><td>${escapeHtml(reporter?.name) || 'Người dân'}${issue.phone ? ` — SĐT: ${escapeHtml(issue.phone)}` : ''}</td></tr>
  </table>
  <div class="body-text">
    Kính đề nghị quý đơn vị cử cán bộ kiểm tra và xử lý sự cố nói trên trong thời gian sớm nhất. Sau khi xử lý, vui lòng phản hồi kết quả về hệ thống hoặc liên hệ:
  </div>
  <div class="body-text">
    <strong>Email:</strong> admin@smartcity.danang.vn &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Điện thoại:</strong> 0236 3822 000
  </div>
  <div class="signature">
    <p>Trân trọng,</p>
    <p style="font-weight:500;margin-top:5px">QUẢN TRỊ VIÊN HỆ THỐNG</p>
    <p class="name">${escapeHtml(user?.name) || 'Admin'}</p>
  </div>
  <div class="footer">Tài liệu này được tạo tự động bởi Hệ thống Giám sát Đô thị Thông minh Đà Nẵng</div>
</body></html>`;

                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(html);
                      printWindow.document.close();
                    }
                    toast.success('Đã mở công văn — nhấn In hoặc Lưu PDF');
                  }}
                  sx={{ borderColor: '#10B981', color: '#10B981', borderRadius: '10px', '&:hover': { bgcolor: 'rgba(16,185,129,0.1)' } }}>
                  Xuất công văn
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Thông tin khi đã xử lý xong */}
          {isAdmin && ['resolved', 'rejected'].includes(issue.status) && (
            <Card sx={{
              mb: 3,
              bgcolor: issue.status === 'resolved' ? 'rgba(16,185,129,0.08)' : 'rgba(107,114,128,0.08)',
              border: `1px solid ${issue.status === 'resolved' ? 'rgba(16,185,129,0.2)' : 'rgba(107,114,128,0.2)'}`,
            }}>
              <CardContent>
                <Typography fontWeight={600} color={issue.status === 'resolved' ? 'success.main' : 'text.secondary'} mb={0.5}>
                  {issue.status === 'resolved' ? '✅ Đã xử lý xong' : '❌ Đã từ chối'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sự cố này đã được xử lý và không thể thay đổi trạng thái.
                </Typography>
              </CardContent>
            </Card>
          )}

          {lastHandler && lastHandlerSummary && (
            <Card sx={{ mb: 3, bgcolor: lastHandlerSummary.bgcolor, border: `1px solid ${lastHandlerSummary.borderColor}` }}>
              <CardContent>
                <Typography fontWeight={600} color={lastHandlerSummary.titleColor} mb={0.5}>
                  {lastHandlerSummary.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {lastHandler.name}{lastHandler.email ? ` (${lastHandler.email})` : ''}
                </Typography>
                {lastHandlerSummary.time && (
                  <Typography variant="body2" color="text.secondary" mt={0.5}>
                    {lastHandlerSummary.timeLabel}: {formatDate(lastHandlerSummary.time)}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}

          {/* MỞ LẠI SỰ CỐ (G8) — đường quay lại duy nhất của người báo cáo khi
              không đồng ý kết quả. Trước đây người dân gửi xong là hết quyền:
              chỉ có vote, chấm sao và xác nhận trùng. */}
          {canReopen && (
            <Card sx={{ mb: 3, bgcolor: 'rgba(11,94,142,0.05)', border: '1px solid rgba(11,94,142,0.18)' }}>
              <CardContent>
                <Typography fontWeight={600} color="primary.main" mb={1}>
                  🔄 Chưa hài lòng với kết quả?
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {issue.status === 'resolved'
                    ? 'Nếu sự cố thực tế vẫn chưa được xử lý xong, bạn có thể mở lại để đơn vị xem xét.'
                    : 'Nếu bạn cho rằng lý do từ chối chưa thoả đáng, bạn có thể mở lại để đơn vị xem xét.'}
                  {' '}Được mở lại tối đa {reopenRules.maxCount} lần, trong {reopenRules.windowDays} ngày kể từ khi đóng phiếu.
                  {(issue.reopenCount || 0) > 0 && ` Bạn đã mở lại ${issue.reopenCount} lần.`}
                  {reopen.daysLeft !== null && (
                    <strong>{reopen.daysLeft > 0 ? ` Còn ${reopen.daysLeft} ngày.` : ' Hôm nay là ngày cuối.'}</strong>
                  )}
                </Typography>
                <Button variant="outlined" onClick={() => setReopenOpen(true)}>
                  Mở lại sự cố
                </Button>
              </CardContent>
            </Card>
          )}
          {reopenExhausted && reopen.reason && (
            <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
              {REOPEN_BLOCK_MESSAGES[reopen.reason](reopenRules)}
            </Alert>
          )}

          <Dialog open={reopenOpen} onClose={() => setReopenOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>Mở lại sự cố</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Hãy nêu rõ vì sao bạn chưa đồng ý với kết quả. Nội dung này được gửi
                tới đơn vị phụ trách và lưu vào lịch sử xử lý.
              </Typography>
              <TextField
                fullWidth multiline rows={4} autoFocus
                label="Lý do mở lại"
                placeholder="VD: Ổ gà mới được lấp tạm, sau một trận mưa đã sụt lại như cũ."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value.slice(0, reopenRules.maxReasonLength))}
                error={reopenReason.length > 0 && reopenReason.trim().length < reopenRules.minReasonLength}
                helperText={`${reopenReason.length}/${reopenRules.maxReasonLength} — tối thiểu ${reopenRules.minReasonLength} ký tự`}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setReopenOpen(false)} color="inherit">Huỷ</Button>
              <Button
                variant="contained"
                onClick={handleReopen}
                disabled={reopenReason.trim().length < reopenRules.minReasonLength || submittingReopen}
              >
                {submittingReopen ? 'Đang gửi...' : 'Gửi yêu cầu mở lại'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* RATING - Form đánh giá cho người báo cáo khi phiếu đã đóng (xử lý xong hoặc bị từ chối) & chưa đánh giá */}
          {canRate && (
            <Card sx={{ mb: 3, bgcolor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <CardContent>
                <Typography fontWeight={600} color="#7D4F05" mb={1.5}>
                  ⭐ Đánh giá chất lượng xử lý
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {issue.status === 'rejected'
                    ? 'Phản ánh của bạn đã bị từ chối. Hãy cho biết bạn đánh giá thế nào về cách đơn vị tiếp nhận và giải thích.'
                    : 'Sự cố của bạn đã được xử lý! Hãy đánh giá chất lượng phục vụ.'}
                </Typography>
                <Box display="flex" justifyContent="center" mb={2}>
                  <Rating
                    value={ratingScore}
                    onChange={(_, v) => setRatingScore(v)}
                    size="large"
                    sx={{
                      '& .MuiRating-iconFilled': { color: '#F59E0B' },
                      '& .MuiRating-iconHover': { color: '#FBBF24' },
                      fontSize: '2.5rem',
                    }}
                  />
                </Box>
                {ratingScore && (
                  <Typography variant="body2" textAlign="center" mb={2} color="#7D4F05" fontWeight={600}>
                    {ratingScore === 1 ? 'Rất không hài lòng' : ratingScore === 2 ? 'Không hài lòng' : ratingScore === 3 ? 'Bình thường' : ratingScore === 4 ? 'Hài lòng' : 'Rất hài lòng'}
                  </Typography>
                )}
                <TextField
                  fullWidth size="small" label="Nhận xét (tùy chọn)" multiline rows={2}
                  placeholder="Chia sẻ trải nghiệm của bạn..."
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value.slice(0, MAX_RATING_COMMENT_LENGTH))}
                  helperText={ratingComment ? `${ratingComment.length}/${MAX_RATING_COMMENT_LENGTH}` : undefined}
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
                <Button
                  fullWidth variant="contained" disabled={!ratingScore || submittingRating}
                  onClick={handleRating}
                  sx={{
                    borderRadius: '10px', py: 1,
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    '&:hover': { background: 'linear-gradient(135deg, #FBBF24, #F59E0B)' },
                  }}
                >
                  {submittingRating ? 'Đang gửi...' : '⭐ Gửi đánh giá'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* RATING - Hiển thị đánh giá đã có (read-only) */}
          {hasRated && (
            <Card sx={{ mb: 3, bgcolor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <CardContent>
                <Typography fontWeight={600} color="#7D4F05" mb={1}>
                  ⭐ Đánh giá chất lượng xử lý
                </Typography>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Rating value={issue.rating?.score || 0} readOnly
                    sx={{ '& .MuiRating-iconFilled': { color: '#F59E0B' } }} />
                  <Typography variant="body2" fontWeight={600} color="#7D4F05">
                    {issue.rating?.score}/5
                  </Typography>
                </Box>
                {issue.rating?.comment && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    "{issue.rating.comment}"
                  </Typography>
                )}
                {issue.rating?.ratedAt && (
                  <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                    Đánh giá lúc {formatDate(issue.rating.ratedAt)}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Container>
  );
};

export default IssueDetailPage;
