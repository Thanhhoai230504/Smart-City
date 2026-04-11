import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { fetchIssues } from '../../store/slices/issueSlice';
import { getProfileThunk } from '../../store/slices/authSlice';
import { authApi } from '../../api/authApi';
import {
  Box, Container, Typography, Grid, Card, CardContent, CardMedia,
  Chip, Stack, TextField, MenuItem, Pagination as MuiPagination,
  InputAdornment, Skeleton, Button, Collapse, IconButton,
} from '@mui/material';
import {
  Search, LocationOn, ThumbUp, FilterList, Close, CalendarMonth,
  NotificationsActive,
} from '@mui/icons-material';
import { CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';
import { timeAgo } from '../../utils/helpers';

const DA_NANG_DISTRICTS = [
  'Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn',
  'Liên Chiểu', 'Cẩm Lệ', 'Hòa Vang', 'Hoàng Sa',
];

const IssuesPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { issues, pagination, loading } = useSelector((s: RootState) => s.issues);
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);

  const [watchedDistricts, setWatchedDistricts] = useState<string[]>([]);
  const [savingWatch, setSavingWatch] = useState(false);

  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState('-createdAt');
  const [page, setPage] = useState(1);

  // Advanced filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [district, setDistrict] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 400);
  }, []);

  const hasAdvancedFilters = district || dateFrom || dateTo;
  const hasAnyFilter = status || category || search || hasAdvancedFilters;

  useEffect(() => {
    if (user) setWatchedDistricts(user.watchedDistricts || []);
  }, [user]);

  const toggleWatchDistrict = async (d: string) => {
    if (!isAuthenticated) return;
    const next = watchedDistricts.includes(d)
      ? watchedDistricts.filter(x => x !== d)
      : [...watchedDistricts, d];
    setWatchedDistricts(next);
    setSavingWatch(true);
    try {
      await authApi.updateProfile({ watchedDistricts: next });
      dispatch(getProfileThunk());
    } catch { /* ignore */ }
    setSavingWatch(false);
  };

  const handleClearAll = () => {
    setStatus(''); setCategory(''); setSortBy('-createdAt');
    setSearch(''); setSearchInput('');
    setDistrict(''); setDateFrom(''); setDateTo('');
    setPage(1);
  };

  useEffect(() => {
    const params: Record<string, string | number> = { page, limit: 9, sort: sortBy };
    if (status) params.status = status;
    if (category) params.category = category;
    if (search) params.search = search;
    if (district) params.district = district;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    dispatch(fetchIssues(params));
  }, [dispatch, page, status, category, sortBy, search, district, dateFrom, dateTo]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} mb={1}>Sự cố đô thị</Typography>
      <Typography color="text.secondary" mb={3}>Danh sách các sự cố được báo cáo tại Đà Nẵng</Typography>

      {/* District Watch Banner */}
      {isAuthenticated && (
        <Box sx={{
          mb: 3, p: 2, borderRadius: '14px',
          bgcolor: 'rgba(59,130,246,0.04)',
          border: '1px solid rgba(59,130,246,0.12)',
        }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
            <NotificationsActive sx={{ fontSize: 18, color: '#3B82F6' }} />
            <Typography variant="body2" fontWeight={600} color="#60A5FA">
              Theo dõi khu vực
            </Typography>
            {savingWatch && (
              <Typography variant="caption" color="primary.main">(đang lưu...)</Typography>
            )}
            {watchedDistricts.length > 0 && !savingWatch && (
              <Chip size="small" label={`🔔 ${watchedDistricts.length} khu vực`}
                sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(59,130,246,0.12)', color: '#60A5FA' }} />
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
            Chọn quận bạn quan tâm — nhận thông báo khi có sự cố mới tại khu vực đó
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {DA_NANG_DISTRICTS.map(d => {
              const active = watchedDistricts.includes(d);
              return (
                <Chip
                  key={d} size="small" label={d}
                  icon={<LocationOn sx={{ fontSize: 14 }} />}
                  onClick={() => toggleWatchDistrict(d)}
                  sx={{
                    fontWeight: active ? 600 : 400, fontSize: '0.75rem',
                    bgcolor: active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                    color: active ? '#60A5FA' : 'text.secondary',
                    border: `1px solid ${active ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer', transition: 'all 0.2s',
                    '&:hover': { bgcolor: active ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.08)' },
                  }}
                />
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Search bar */}
      <TextField
        fullWidth
        size="small"
        placeholder="Tìm kiếm theo tiêu đề hoặc mô tả sự cố..."
        value={searchInput}
        onChange={(e) => handleSearchChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search sx={{ color: 'text.secondary' }} />
            </InputAdornment>
          ),
          endAdornment: searchInput ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}>
                <Close fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
        sx={{
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
            bgcolor: 'rgba(255,255,255,0.04)',
          },
        }}
      />

      {/* Basic filters row */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={1} alignItems="center" flexWrap="wrap">
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

        <Button
          size="small"
          startIcon={<FilterList />}
          onClick={() => setShowAdvanced(!showAdvanced)}
          sx={{
            textTransform: 'none', borderRadius: '10px', px: 2,
            color: hasAdvancedFilters ? '#3B82F6' : 'text.secondary',
            border: '1px solid',
            borderColor: hasAdvancedFilters ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.12)',
            bgcolor: hasAdvancedFilters ? 'rgba(59,130,246,0.08)' : 'transparent',
          }}
        >
          Lọc nâng cao {hasAdvancedFilters && `(${[district, dateFrom, dateTo].filter(Boolean).length})`}
        </Button>

        {hasAnyFilter && (
          <Button size="small" onClick={handleClearAll}
            sx={{ textTransform: 'none', color: '#EF4444', fontSize: '0.8rem' }}>
            ✕ Xóa tất cả bộ lọc
          </Button>
        )}
      </Stack>

      {/* Advanced filters (collapsible) */}
      <Collapse in={showAdvanced}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            mt: 1, mb: 2, p: 2, borderRadius: '12px',
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <TextField
            select label="Quận / Huyện" value={district}
            onChange={(e) => { setDistrict(e.target.value); setPage(1); }}
            size="small" sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Tất cả quận</MenuItem>
            {DA_NANG_DISTRICTS.map((d) => <MenuItem key={d} value={d}>📍 {d}</MenuItem>)}
          </TextField>
          <TextField
            label="Từ ngày" type="date" size="small" value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            InputLabelProps={{ shrink: true }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><CalendarMonth sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
            }}
            sx={{ minWidth: 170 }}
          />
          <TextField
            label="Đến ngày" type="date" size="small" value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            InputLabelProps={{ shrink: true }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><CalendarMonth sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
            }}
            sx={{ minWidth: 170 }}
          />
        </Stack>
      </Collapse>

      {/* Active filters summary */}
      {hasAnyFilter && (
        <Stack direction="row" spacing={1} mb={3} flexWrap="wrap" useFlexGap>
          {search && (
            <Chip size="small" label={`🔍 "${search}"`} onDelete={() => { setSearch(''); setSearchInput(''); }}
              sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#60A5FA' }} />
          )}
          {district && (
            <Chip size="small" label={`📍 ${district}`} onDelete={() => setDistrict('')}
              sx={{ bgcolor: 'rgba(16,185,129,0.12)', color: '#34D399' }} />
          )}
          {dateFrom && (
            <Chip size="small" label={`📅 Từ ${dateFrom}`} onDelete={() => setDateFrom('')}
              sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: '#FBBF24' }} />
          )}
          {dateTo && (
            <Chip size="small" label={`📅 Đến ${dateTo}`} onDelete={() => setDateTo('')}
              sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: '#FBBF24' }} />
          )}
          {pagination && (
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', ml: 1 }}>
              {pagination.total} kết quả
            </Typography>
          )}
        </Stack>
      )}

      {/* List */}
      <Grid container spacing={3} sx={{ mt: hasAnyFilter ? 0 : 2 }}>
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
              <Typography color="text.secondary" mb={2}>Không tìm thấy sự cố nào phù hợp với bộ lọc</Typography>
              {hasAnyFilter && (
                <Button variant="outlined" size="small" onClick={handleClearAll}
                  sx={{ borderRadius: '10px', textTransform: 'none' }}>
                  Xóa bộ lọc và thử lại
                </Button>
              )}
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
