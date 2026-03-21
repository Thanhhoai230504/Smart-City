import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { fetchIssueById, clearCurrentIssue } from '../../store/slices/issueSlice';
import { commentApi } from '../../api/commentApi';
import {
  Box, Container, Typography, Chip, Card, CardContent, Stack, Button,
  Grid, Divider, Avatar, TextField, Stepper, Step, StepLabel, StepConnector,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import * as L from 'leaflet';
import {
  ArrowBack, LocationOn, Person, CalendarMonth, Send,
  FiberManualRecord, CheckCircle, Pending, Cancel,
} from '@mui/icons-material';
import { CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';
import { Comment } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';

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

  useEffect(() => {
    if (id) dispatch(fetchIssueById(id));
    return () => { dispatch(clearCurrentIssue()); };
  }, [dispatch, id]);

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

  if (loading || !issue) return <LoadingSpinner />;

  const cat = CATEGORY_MAP[issue.category] || CATEGORY_MAP.other;
  const st = STATUS_MAP[issue.status] || STATUS_MAP.reported;
  const reporter = typeof issue.userId === 'object' ? issue.userId : null;

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

          <Typography variant="h4" fontWeight={700} mb={2}>{issue.title}</Typography>

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
              <Box component="img"
                src={issue.imageUrl.startsWith('http') ? issue.imageUrl : `http://localhost:5000${issue.imageUrl}`}
                alt={issue.title}
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

        {/* Right side: Mini Map + Admin info */}
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
