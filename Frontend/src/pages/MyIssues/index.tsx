import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { fetchMyIssues } from '../../store/slices/issueSlice';
import {
  Container, Typography, Box, Card, CardContent, Chip, Stack,
  MenuItem, TextField, Pagination as MuiPagination,
} from '@mui/material';
import { LocationOn, AccessTime } from '@mui/icons-material';
import { CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';
import { timeAgo } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';

const MyIssuesPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { myIssues, myPagination, loading } = useSelector((s: RootState) => s.issues);

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params: Record<string, string | number> = { page, limit: 10 };
    if (status) params.status = status;
    dispatch(fetchMyIssues(params));
  }, [dispatch, page, status]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} mb={1}>📋 Sự cố của tôi</Typography>
      <Typography color="text.secondary" mb={3}>Các sự cố bạn đã báo cáo</Typography>

      <TextField select label="Lọc trạng thái" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        size="small" sx={{ mb: 3, minWidth: 180 }}>
        <MenuItem value="">Tất cả</MenuItem>
        {Object.entries(STATUS_MAP).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
      </TextField>

      {loading ? <LoadingSpinner /> : myIssues.length === 0 ? (
        <Typography textAlign="center" color="text.secondary" py={8}>Bạn chưa báo cáo sự cố nào</Typography>
      ) : (
        <Stack spacing={2}>
          {myIssues.map((issue) => {
            const cat = CATEGORY_MAP[issue.category] || CATEGORY_MAP.other;
            const st = STATUS_MAP[issue.status] || STATUS_MAP.reported;
            return (
              <Card key={issue._id} onClick={() => navigate(`/issues/${issue._id}`)}
                sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main', transform: 'translateX(4px)' } }}>
                <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                  <Box>
                    <Typography fontWeight={600} mb={0.5}>{cat.icon} {issue.title}</Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <LocationOn sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">{issue.location}</Typography>
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                    <Chip label={st.label} size="small" sx={{ bgcolor: `${st.color}20`, color: st.color, fontWeight: 600 }} />
                    <Stack direction="row" spacing={0.3} alignItems="center">
                      <AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">{timeAgo(issue.createdAt)}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      {myPagination && myPagination.pages > 1 && (
        <Box mt={3} display="flex" justifyContent="center">
          <MuiPagination count={myPagination.pages} page={myPagination.current} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" />
        </Box>
      )}
    </Container>
  );
};

export default MyIssuesPage;
