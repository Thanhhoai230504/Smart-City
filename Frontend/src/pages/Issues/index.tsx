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
import { Search, LocationOn } from '@mui/icons-material';
import { CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';
import { timeAgo } from '../../utils/helpers';

const IssuesPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { issues, pagination, loading } = useSelector((s: RootState) => s.issues);

  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params: Record<string, string | number> = { page, limit: 9 };
    if (status) params.status = status;
    if (category) params.category = category;
    dispatch(fetchIssues(params));
  }, [dispatch, page, status, category]);

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
          <Grid item xs={12}><Typography textAlign="center" color="text.secondary" py={6}>Không tìm thấy sự cố nào</Typography></Grid>
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
                    <CardMedia component="img" height={160} image={issue.imageUrl.startsWith('http') ? issue.imageUrl : `http://localhost:5000${issue.imageUrl}`}
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
