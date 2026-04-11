import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { fetchIssueById, clearCurrentIssue } from '../../store/slices/issueSlice';
import { commentApi } from '../../api/commentApi';
import { issueApi } from '../../api/issueApi';
import {
  Box, Container, Typography, Chip, Card, CardContent, Stack, Button,
  Grid, Divider, Avatar, TextField, Stepper, Step, StepLabel, StepConnector,
  MenuItem, Select, FormControl, InputLabel, SelectChangeEvent, IconButton,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import * as L from 'leaflet';
import {
  ArrowBack, LocationOn, Person, CalendarMonth, Send,
  FiberManualRecord, CheckCircle, Pending, Cancel,
  Phone, Email, Description, ThumbUp, ThumbUpOffAlt,
  Share, Facebook, ContentCopy, Link as LinkIcon,
} from '@mui/icons-material';
import { CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';
import { Comment } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';

// Đơn vị phụ trách theo loại sự cố
const DEPARTMENT_CONTACTS: Record<string, { name: string; phone: string; email: string }> = {
  pothole: { name: 'Phòng Quản lý Hạ tầng Giao thông', phone: '0236 3821 234', email: 'hatang.gt@danang.gov.vn' },
  garbage: { name: 'Công ty Môi trường Đô thị Đà Nẵng', phone: '0236 3847 777', email: 'moitruong@danang.gov.vn' },
  streetlight: { name: 'Công ty Chiếu sáng & Tín hiệu Đà Nẵng', phone: '0236 3891 555', email: 'chieusang@danang.gov.vn' },
  flooding: { name: 'Phòng Quản lý Thoát nước', phone: '0236 3822 333', email: 'thoatnuoc@danang.gov.vn' },
  tree: { name: 'Công ty Cây xanh Đà Nẵng', phone: '0236 3836 666', email: 'cayxanh@danang.gov.vn' },
  other: { name: 'UBND Thành phố Đà Nẵng', phone: '0236 3822 111', email: 'ubnd@danang.gov.vn' },
};

const CATEGORY_LABELS_VN: Record<string, string> = {
  pothole: 'Ổ gà / Hư hỏng đường', garbage: 'Rác thải', streetlight: 'Đèn đường hỏng',
  flooding: 'Ngập nước', tree: 'Cây đổ', other: 'Khác',
};

// Timeline connector
const TimelineConnector = styled(StepConnector)(() => ({
  '& .MuiStepConnector-line': {
    borderColor: 'rgba(255,255,255,0.12)',
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

const IssueDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { currentIssue: issue, loading } = useSelector((s: RootState) => s.issues);
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Admin status update
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Vote
  const [voteCount, setVoteCount] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    if (id) dispatch(fetchIssueById(id));
    return () => { dispatch(clearCurrentIssue()); };
  }, [dispatch, id]);

  useEffect(() => {
    if (issue) {
      setVoteCount(issue.voteCount || 0);
      setHasVoted(user ? (issue.votes || []).includes(user._id) : false);
    }
  }, [issue, user]);

  const loadComments = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await commentApi.getComments(id);
      setComments(data.data.comments);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !id || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await commentApi.addComment(id, newComment.trim());
      setComments((prev) => [...prev, data.data.comment]);
      setNewComment('');
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  const handleStatusUpdate = async () => {
    if (!newStatus || !id) return;
    setUpdatingStatus(true);
    try {
      await issueApi.updateIssueStatus(id, newStatus, statusNote.trim());
      toast.success(`Trạng thái → ${statusLabels[newStatus]}`);
      dispatch(fetchIssueById(id));
      setNewStatus('');
      setStatusNote('');
    } catch {
      toast.error('Cập nhật thất bại');
    }
    setUpdatingStatus(false);
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
  const shareTitle = issue ? `Sự cố: ${issue.title}` : '';
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

  if (loading || !issue) return <LoadingSpinner />;

  const cat = CATEGORY_MAP[issue.category] || CATEGORY_MAP.other;
  const st = STATUS_MAP[issue.status] || STATUS_MAP.reported;
  const reporter = typeof issue.userId === 'object' ? issue.userId : null;
  const isAdmin = user?.role === 'admin';
  const canChangeStatus = isAdmin && !['resolved', 'rejected'].includes(issue.status);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 3, color: 'text.secondary' }}>
        Quay lại
      </Button>

      <Grid container spacing={4}>
        <Grid item xs={12} md={7}>
          <Stack direction="row" spacing={1} mb={2}>
            <Chip label={cat.label} icon={<span>{cat.icon}</span>} sx={{ bgcolor: `${cat.color}20`, color: cat.color, fontWeight: 600 }} />
            <Chip label={st.label} sx={{ bgcolor: `${st.color}20`, color: st.color, fontWeight: 600 }} />
          </Stack>

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
                ...(hasVoted && { bgcolor: '#6C63FF', '&:hover': { bgcolor: '#5A52D5' } }),
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
            <IconButton size="small" onClick={() => handleShare('copy')} sx={{ color: 'text.secondary' }}>
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

          <Divider sx={{ mb: 3, borderColor: 'rgba(255,255,255,0.06)' }} />

          <Typography variant="h6" fontWeight={600} mb={1.5}>Mô tả</Typography>
          <Typography color="text.secondary" lineHeight={1.8} mb={3}>{issue.description}</Typography>

          {issue.imageUrl && (
            <>
              <Typography variant="h6" fontWeight={600} mb={1.5}>Hình ảnh</Typography>
              <Box component="img" src={issue.imageUrl} alt={issue.title}
                sx={{ width: '100%', maxHeight: 400, objectFit: 'cover', borderRadius: 2, mb: 3 }} />
            </>
          )}

          {/* STATUS TIMELINE */}
          {issue.statusHistory && issue.statusHistory.length > 0 && (
            <Card sx={{ mb: 3, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
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
                          <Typography fontWeight={600} sx={{ color: STATUS_MAP[entry.status]?.color || '#fff' }}>
                            {statusLabels[entry.status] || entry.status}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            — {formatDate(entry.changedAt)}
                          </Typography>
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
          <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>
                💬 Bình luận ({comments.length})
              </Typography>

              {comments.length === 0 ? (
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Chưa có bình luận nào
                </Typography>
              ) : (
                <Stack spacing={2} mb={3}>
                  {comments.map((c) => (
                    <Box key={c._id} sx={{
                      p: 2, borderRadius: '12px',
                      bgcolor: c.userId.role === 'admin' ? 'rgba(108,99,255,0.06)' : 'rgba(255,255,255,0.03)',
                      borderLeft: '3px solid',
                      borderColor: c.userId.role === 'admin' ? 'primary.main' : 'rgba(255,255,255,0.1)',
                    }}>
                      <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: c.userId.role === 'admin' ? 'primary.main' : 'secondary.main' }}>
                          {c.userId.name?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="body2" fontWeight={600}>{c.userId.name}</Typography>
                        {c.userId.role === 'admin' && (
                          <Chip label="Admin" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(108,99,255,0.15)', color: 'primary.main' }} />
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
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.05)' } }}
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
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
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

          {/* ADMIN CONTROLS — chỉ hiện cho admin khi sự cố chưa xử lý xong */}
          {canChangeStatus && (
            <Card sx={{ mb: 3, bgcolor: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.2)' }}>
              <CardContent>
                <Typography fontWeight={600} color="primary.main" mb={2}>
                  🛠️ Xử lý sự cố
                </Typography>

                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Chuyển trạng thái</InputLabel>
                  <Select value={newStatus} label="Chuyển trạng thái"
                    onChange={(e: SelectChangeEvent) => setNewStatus(e.target.value)}
                    sx={{ borderRadius: '10px' }}>
                    {issue.status === 'reported' && <MenuItem value="processing">🔵 Đang xử lý</MenuItem>}
                    <MenuItem value="resolved">🟢 Đã xử lý</MenuItem>
                    <MenuItem value="rejected">🔴 Từ chối</MenuItem>
                  </Select>
                </FormControl>

                <TextField fullWidth size="small" label="Ghi chú (tùy chọn)"
                  placeholder="VD: Đã cử đội ngũ đến kiểm tra..."
                  value={statusNote} onChange={(e) => setStatusNote(e.target.value)}
                  multiline rows={2}
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />

                <Button fullWidth variant="contained" disabled={!newStatus || updatingStatus}
                  onClick={handleStatusUpdate}
                  sx={{ borderRadius: '10px', py: 1 }}>
                  {updatingStatus ? 'Đang cập nhật...' : '✅ Cập nhật trạng thái'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* LIÊN HỆ ĐƠN VỊ PHỤ TRÁCH */}
          {isAdmin && (() => {
            const dept = DEPARTMENT_CONTACTS[issue.category] || DEPARTMENT_CONTACTS.other;
            return (
              <Card sx={{ mb: 3, bgcolor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <CardContent>
                  <Typography fontWeight={600} color="#F59E0B" mb={1.5}>
                    📞 Đơn vị phụ trách
                  </Typography>
                  <Typography variant="body2" fontWeight={600} mb={1}>{dept.name}</Typography>
                  <Stack spacing={1}>
                    <Button size="small" startIcon={<Phone />}
                      href={`tel:${dept.phone.replace(/\s/g, '')}`}
                      sx={{ justifyContent: 'flex-start', color: '#10B981', textTransform: 'none' }}>
                      {dept.phone}
                    </Button>
                    <Button size="small" startIcon={<Email />}
                      href={`mailto:${dept.email}?subject=Yêu cầu xử lý sự cố: ${issue.title}&body=Kính gửi ${dept.name},%0A%0ASự cố: ${issue.title}%0AĐịa điểm: ${issue.location}%0AMô tả: ${issue.description}%0ATọa độ: ${issue.latitude}, ${issue.longitude}%0A%0AKính đề nghị quý đơn vị xử lý. Trân trọng.`}
                      sx={{ justifyContent: 'flex-start', color: '#6C63FF', textTransform: 'none' }}>
                      {dept.email}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            );
          })()}

          {/* XUẤT CÔNG VĂN */}
          {isAdmin && (
            <Card sx={{ mb: 3, bgcolor: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <CardContent>
                <Typography fontWeight={600} color="#10B981" mb={1.5}>
                  📄 Xuất công văn
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Tạo công văn yêu cầu xử lý sự cố gửi đến đơn vị phụ trách
                </Typography>
                <Button fullWidth variant="outlined" startIcon={<Description />}
                  onClick={() => {
                    const dept = DEPARTMENT_CONTACTS[issue.category] || DEPARTMENT_CONTACTS.other;
                    const catLabel = CATEGORY_LABELS_VN[issue.category] || issue.category;
                    const now = new Date();
                    const dateStr = `ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
                    const soCV = `CV-${issue._id?.slice(-6).toUpperCase() || '000000'}`;

                    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Công văn ${soCV}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Roboto', 'Times New Roman', serif; color: #1a1a1a; padding: 50px; max-width: 800px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 30px; }
  .header h3 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .header p { font-size: 12px; color: #555; margin-top: 4px; }
  .header hr { border: none; border-top: 2px solid #6C63FF; margin: 12px 80px 0; }
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
    <button onclick="window.print()" style="padding:10px 30px;font-size:14px;background:#6C63FF;color:white;border:none;border-radius:8px;cursor:pointer">🖨️ In / Lưu PDF</button>
  </div>
  <div class="header">
    <h3>UBND Thành phố Đà Nẵng</h3>
    <p>Hệ thống Giám sát Đô thị Thông minh</p>
    <hr/>
  </div>
  <div class="meta">
    <span>Số: ${soCV}</span>
    <span>Đà Nẵng, ${dateStr}</span>
  </div>
  <div class="title">Công văn yêu cầu xử lý sự cố</div>
  <div class="recipient">Kính gửi: ${dept.name}</div>
  <div class="body-text">
    Hệ thống Giám sát Đô thị Thông minh thành phố Đà Nẵng đã tiếp nhận báo cáo sự cố từ người dân với nội dung như sau:
  </div>
  <table class="info-table">
    <tr><td>Tiêu đề</td><td>${issue.title}</td></tr>
    <tr><td>Loại sự cố</td><td>${catLabel}</td></tr>
    <tr><td>Địa chỉ</td><td>${issue.location}</td></tr>
    <tr><td>Tọa độ</td><td>${issue.latitude.toFixed(6)}, ${issue.longitude.toFixed(6)}</td></tr>
    <tr><td>Mô tả</td><td>${issue.description || 'Không có'}</td></tr>
    <tr><td>Thời gian báo cáo</td><td>${formatDate(issue.createdAt)}</td></tr>
    <tr><td>Người báo cáo</td><td>${reporter?.name || 'Người dân'}${issue.phone ? ` — SĐT: ${issue.phone}` : ''}</td></tr>
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
    <p class="name">${user?.name || 'Admin'}</p>
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

          {issue.adminId && typeof issue.adminId === 'object' && (
            <Card sx={{ bgcolor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <CardContent>
                <Typography fontWeight={600} color="success.main" mb={0.5}>Xử lý bởi Admin</Typography>
                <Typography variant="body2" color="text.secondary">{issue.adminId.name} ({issue.adminId.email})</Typography>
                {issue.resolvedAt && <Typography variant="body2" color="text.secondary" mt={0.5}>Hoàn thành: {formatDate(issue.resolvedAt)}</Typography>}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Container>
  );
};

export default IssueDetailPage;
