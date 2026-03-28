import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { fetchIssues } from '../../store/slices/issueSlice';
import {
  Box, Container, Typography, Grid, Card, CardContent, CardMedia,
  Chip, Stack, TextField, MenuItem, Pagination as MuiPagination,
  InputAdornment, Skeleton,
} from '@mui/material';
import { Search, LocationOn, ThumbUp } from '@mui/icons-material';
import { CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';
import { timeAgo } from '../../utils/helpers';

const IssuesPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { issues, pagination, loading } = useSelector((s: RootState) => s.issues);

  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState('-createdAt');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params: Record<string, string | number> = { page, limit: 9, sort: sortBy };
    if (status) params.status = status;
    if (category) params.category = category;
    dispatch(fetchIssues(params));
  }, [dispatch, page, status, category, sortBy]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} mb={1}>Sự cố đô thị</Typography>
      <Typography color="text.secondary" mb={3}>Danh sách các sự cố được báo cáo tại Đà Nẵng</Typography>

      {/* Filters */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={4}>
        <TextField select label="Trạng thái" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          size="small" sx={{ minWidth: 160 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {Object.entries(STATUS_MAP).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
        </TextField>
        <TextField select label="Danh mục" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          size="small" sx={{ minWidth: 180 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {Object.entries(CATEGORY_MAP).map(([k, v]) => <MenuItem key={k} value={k}>{v.icon} {v.label}</MenuItem>)}
        </TextField>
        <TextField select label="Sắp xếp" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          size="small" sx={{ minWidth: 180 }}>
          <MenuItem value="-createdAt">🕐 Mới nhất</MenuItem>
          <MenuItem value="createdAt">🕐 Cũ nhất</MenuItem>
          <MenuItem value="-voteCount">🔥 Ủng hộ nhiều nhất</MenuItem>
        </TextField>
      </Stack>

      {/* List */}
      <Grid container spacing={3}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card><Skeleton variant="rectangular" height={160} /><CardContent><Skeleton /><Skeleton width="60%" /></CardContent></Card>
            </Grid>
          ))
        ) : issues.length === 0 ? (
          <Grid item xs={12}>
            <Box textAlign="center" py={8}>
              <Typography fontSize="3rem" mb={1}>🔍</Typography>
              <Typography color="text.secondary">Không tìm thấy sự cố nào phù hợp với bộ lọc</Typography>
            </Box>
          </Grid>
        ) : (
          issues.map((issue) => {
            const cat = CATEGORY_MAP[issue.category] || CATEGORY_MAP.other;
            const st = STATUS_MAP[issue.status] || STATUS_MAP.reported;
            return (
              <Grid item xs={12} sm={6} md={4} key={issue._id}>
                <Card onClick={() => navigate(`/issues/${issue._id}`)}
                  sx={{
                    cursor: 'pointer', height: '100%', transition: 'all 0.3s',
                    '&:hover': { transform: 'translateY(-4px)', borderColor: `${cat.color}40`, boxShadow: `0 8px 30px ${cat.color}15` },
                  }}>
                  {issue.imageUrl && (
                    <CardMedia component="img" height={160} image={issue.imageUrl}
                      alt={issue.title} sx={{ objectFit: 'cover' }} />
                  )}
                  {!issue.imageUrl && (
                    <Box sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${cat.color}10`, fontSize: '2.5rem' }}>
                      {cat.icon}
                    </Box>
                  )}
                  <CardContent>
                    <Stack direction="row" spacing={0.8} mb={1.5}>
                      <Chip label={cat.label} size="small" sx={{ bgcolor: `${cat.color}20`, color: cat.color, fontWeight: 600, fontSize: '0.7rem' }} />
                      <Chip label={st.label} size="small" sx={{ bgcolor: `${st.color}20`, color: st.color, fontWeight: 600, fontSize: '0.7rem' }} />
                    </Stack>
                    <Typography variant="subtitle1" fontWeight={600} mb={0.5} noWrap>{issue.title}</Typography>
                    <Stack direction="row" alignItems="center" spacing={0.5} mb={0.5}>
                      <LocationOn sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary" noWrap>{issue.location}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{timeAgo(issue.createdAt)}</Typography>
                    {(issue.voteCount || 0) > 0 && (
                      <Stack direction="row" alignItems="center" spacing={0.5} sx={{
                        mt: 1, px: 1, py: 0.3, borderRadius: '8px',
                        bgcolor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
                        width: 'fit-content',
                      }}>
                        <ThumbUp sx={{ fontSize: 13, color: '#F59E0B' }} />
                        <Typography variant="caption" fontWeight={700} color="#F59E0B">
                          {issue.voteCount} người ủng hộ
                        </Typography>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })
        )}
      </Grid>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <Box mt={4} display="flex" justifyContent="center">
          <MuiPagination count={pagination.pages} page={pagination.current} onChange={(_, v) => setPage(v)}
            color="primary" shape="rounded" />
        </Box>
      )}
    </Container>
  );
};

export default IssuesPage;
