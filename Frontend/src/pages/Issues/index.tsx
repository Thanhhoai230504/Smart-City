import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Collapse,
  Container,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination as MuiPagination,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccessTime,
  AddCircleOutline,
  ArrowForward,
  BrokenImageOutlined,
  BusinessOutlined,
  CalendarMonth,
  Close,
  FilterList,
  LocationOn,
  NotificationsActive,
  Search,
  ThumbUp,
} from '@mui/icons-material';
import { AppDispatch, RootState } from '../../store/store';
import { fetchIssues } from '../../store/slices/issueSlice';
import { getProfileThunk } from '../../store/slices/authSlice';
import { authApi } from '../../api/authApi';
import { CATEGORY_MAP, DA_NANG_DISTRICTS, STATUS_MAP } from '../../utils/constants';
import { timeAgo } from '../../utils/helpers';
import { Issue } from '../../types';
import SlaBadge from '../../components/SlaBadge';

const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'reported', label: 'Mới báo' },
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Đã xử lý' },
  { value: 'rejected', label: 'Từ chối' },
];

const IssueThumbnail: React.FC<{
  issue: Issue;
  category: { label: string; color: string; icon: string };
}> = ({ issue, category }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [issue.imageUrl]);

  if (issue.imageUrl && !failed) {
    return (
      <CardMedia
        component="img"
        image={issue.imageUrl}
        loading="lazy"
        decoding="async"
        alt={issue.title}
        onError={() => setFailed(true)}
        sx={{
          width: { xs: '100%', sm: 224 },
          minWidth: { sm: 224 },
          height: { xs: 176, sm: 168 },
          objectFit: 'cover',
          borderRight: { xs: 0, sm: '1px solid #D8E1E7' },
          borderBottom: { xs: '1px solid #D8E1E7', sm: 0 },
        }}
      />
    );
  }

  return (
    <Box
      sx={{
        width: { xs: '100%', sm: 224 },
        minWidth: { sm: 224 },
        height: { xs: 150, sm: 168 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.75,
        bgcolor: '#EEF3F5',
        color: 'text.secondary',
        borderRight: { xs: 0, sm: '1px solid #D8E1E7' },
        borderBottom: { xs: '1px solid #D8E1E7', sm: 0 },
      }}
    >
      <BrokenImageOutlined sx={{ fontSize: 30, color: category.color }} />
      <Typography variant="caption" fontWeight={650}>{category.label}</Typography>
      <Typography variant="caption" color="text.disabled">Chưa có ảnh hiện trường</Typography>
    </Box>
  );
};

const getDepartmentName = (issue: Issue) => {
  if (!issue.departmentId || typeof issue.departmentId === 'string') return 'Chưa phân công';
  return issue.departmentId.name;
};

const IssuesPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { issues, pagination, loading } = useSelector((state: RootState) => state.issues);
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);

  const [watchedDistricts, setWatchedDistricts] = useState<string[]>([]);
  const [savingWatch, setSavingWatch] = useState(false);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState('-createdAt');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [district, setDistrict] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 400);
  }, []);

  const hasAdvancedFilters = Boolean(dateFrom || dateTo);
  const hasAnyFilter = Boolean(status || category || search || district || hasAdvancedFilters);

  useEffect(() => {
    if (user) setWatchedDistricts(user.watchedDistricts || []);
  }, [user]);

  const toggleWatchDistrict = async (selectedDistrict: string) => {
    if (!isAuthenticated || savingWatch) return;

    const next = watchedDistricts.includes(selectedDistrict)
      ? watchedDistricts.filter((item) => item !== selectedDistrict)
      : [...watchedDistricts, selectedDistrict];

    setWatchedDistricts(next);
    setSavingWatch(true);
    try {
      await authApi.updateProfile({ watchedDistricts: next });
      dispatch(getProfileThunk());
    } catch {
      setWatchedDistricts(watchedDistricts);
    } finally {
      setSavingWatch(false);
    }
  };

  const handleClearAll = () => {
    setStatus('');
    setCategory('');
    setSortBy('-createdAt');
    setSearch('');
    setSearchInput('');
    setDistrict('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  useEffect(() => {
    const params: Record<string, string | number> = { page, limit: 10, sort: sortBy };
    if (status) params.status = status;
    if (category) params.category = category;
    if (search) params.search = search;
    if (district) params.district = district;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    const request = dispatch(fetchIssues(params));
    return () => request.abort();
  }, [dispatch, page, status, category, sortBy, search, district, dateFrom, dateTo]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 } }}>
      <Box
        component="header"
        sx={{
          pb: { xs: 2.5, md: 3 },
          mb: 0,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'flex-end' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Typography variant="body2" color="primary.main" fontWeight={700} mb={0.75}>
              Cổng phản ánh cộng đồng
            </Typography>
            <Typography variant="h3" component="h1" mb={0.75}>
              Sự cố đô thị
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 620 }}>
              Theo dõi phản ánh, tiến độ xử lý và kết quả từ các đơn vị phụ trách trên toàn thành phố.
            </Typography>
          </Box>

          <Stack direction="row" spacing={2.5} alignItems="center">
            <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
              <Typography variant="h5" component="p" color="text.primary">
                {pagination?.total ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                phản ánh phù hợp
              </Typography>
            </Box>
            {!isAuthenticated && (
              <Button
                variant="contained"
                startIcon={<AddCircleOutline />}
                onClick={() => navigate('/report')}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Báo cáo sự cố
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>

      <Box
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          mb: 2.5,
        }}
      >
        <Tabs
          value={status}
          onChange={(_, nextStatus: string) => {
            setStatus(nextStatus);
            setPage(1);
          }}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Lọc sự cố theo trạng thái"
        >
          {STATUS_TABS.map((item) => (
            <Tab key={item.value || 'all'} value={item.value} label={item.label} />
          ))}
        </Tabs>
      </Box>

      {isAuthenticated && (
        <Box
          sx={{
            mb: 2.5,
            px: { xs: 1.5, sm: 2 },
            py: 1.5,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ md: 'center' }}
            spacing={{ xs: 1.25, md: 2 }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 205 }}>
              <NotificationsActive sx={{ fontSize: 19, color: 'primary.main' }} />
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  Khu vực đang theo dõi
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {savingWatch ? 'Đang lưu thay đổi...' : 'Chọn quận để nhận thông báo'}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {DA_NANG_DISTRICTS.map((item) => {
                const active = watchedDistricts.includes(item);
                return (
                  <Chip
                    key={item}
                    size="small"
                    label={item}
                    onClick={() => toggleWatchDistrict(item)}
                    disabled={savingWatch}
                    variant={active ? 'filled' : 'outlined'}
                    sx={{
                      bgcolor: active ? 'primary.main' : 'transparent',
                      color: active ? 'primary.contrastText' : 'text.secondary',
                      borderColor: active ? 'primary.main' : 'divider',
                      '&:hover': {
                        bgcolor: active ? 'primary.dark' : '#F2F6F8',
                      },
                    }}
                  />
                );
              })}
            </Stack>
          </Stack>
        </Box>
      )}

      <Box
        component="section"
        aria-label="Công cụ tìm kiếm và lọc sự cố"
        sx={{
          mb: 2.5,
          p: { xs: 1.5, md: 2 },
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'minmax(280px, 1fr) 180px',
              md: 'minmax(320px, 1fr) 170px 170px 165px auto',
            },
            gap: 1.25,
            alignItems: 'center',
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder="Tìm theo tiêu đề, mô tả hoặc địa điểm..."
            value={searchInput}
            onChange={(event) => handleSearchChange(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 21, color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: searchInput ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label="Xóa từ khóa tìm kiếm"
                    onClick={() => {
                      setSearchInput('');
                      setSearch('');
                      setPage(1);
                    }}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />

          <TextField
            select
            label="Danh mục"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
            size="small"
          >
            <MenuItem value="">Tất cả danh mục</MenuItem>
            {Object.entries(CATEGORY_MAP).map(([key, value]) => (
              <MenuItem key={key} value={key}>{value.label}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Quận / Huyện"
            value={district}
            onChange={(event) => {
              setDistrict(event.target.value);
              setPage(1);
            }}
            size="small"
          >
            <MenuItem value="">Toàn thành phố</MenuItem>
            {DA_NANG_DISTRICTS.map((item) => (
              <MenuItem key={item} value={item}>{item}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Sắp xếp"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value);
              setPage(1);
            }}
            size="small"
          >
            <MenuItem value="-createdAt">Mới nhất</MenuItem>
            <MenuItem value="createdAt">Cũ nhất</MenuItem>
            <MenuItem value="-voteCount">Nhiều ủng hộ nhất</MenuItem>
          </TextField>

          <Button
            variant={hasAdvancedFilters ? 'outlined' : 'text'}
            startIcon={<FilterList />}
            onClick={() => setShowAdvanced((current) => !current)}
            sx={{
              minHeight: 40,
              px: 1.5,
              whiteSpace: 'nowrap',
              color: hasAdvancedFilters ? 'primary.main' : 'text.secondary',
            }}
          >
            Thời gian
            {hasAdvancedFilters && ` (${[dateFrom, dateTo].filter(Boolean).length})`}
          </Button>
        </Box>

        <Collapse in={showAdvanced}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            alignItems={{ sm: 'center' }}
            sx={{
              mt: 1.5,
              pt: 1.5,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" fontWeight={650} sx={{ minWidth: 110 }}>
              Khoảng thời gian
            </Typography>
            <TextField
              label="Từ ngày"
              type="date"
              size="small"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarMonth sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 190 }}
            />
            <TextField
              label="Đến ngày"
              type="date"
              size="small"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarMonth sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 190 }}
            />
          </Stack>
        </Collapse>

        {hasAnyFilter && (
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ mt: 1.5 }}
          >
            <Typography variant="caption" color="text.secondary" mr={0.25}>
              Đang lọc:
            </Typography>
            {search && (
              <Chip
                size="small"
                label={`Từ khóa: ${search}`}
                onDelete={() => {
                  setSearch('');
                  setSearchInput('');
                  setPage(1);
                }}
              />
            )}
            {category && (
              <Chip
                size="small"
                label={CATEGORY_MAP[category]?.label || category}
                onDelete={() => {
                  setCategory('');
                  setPage(1);
                }}
              />
            )}
            {district && (
              <Chip
                size="small"
                label={district}
                onDelete={() => {
                  setDistrict('');
                  setPage(1);
                }}
              />
            )}
            {dateFrom && (
              <Chip
                size="small"
                label={`Từ ${dateFrom}`}
                onDelete={() => {
                  setDateFrom('');
                  setPage(1);
                }}
              />
            )}
            {dateTo && (
              <Chip
                size="small"
                label={`Đến ${dateTo}`}
                onDelete={() => {
                  setDateTo('');
                  setPage(1);
                }}
              />
            )}
            <Button
              size="small"
              color="error"
              onClick={handleClearAll}
              sx={{ ml: { sm: 'auto' }, minHeight: 30, py: 0.25 }}
            >
              Xóa bộ lọc
            </Button>
          </Stack>
        )}
      </Box>

      <Stack
        direction="row"
        alignItems="baseline"
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Typography variant="h6" component="h2">
          Danh sách phản ánh
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {loading ? 'Đang cập nhật...' : `${pagination?.total ?? issues.length} kết quả`}
        </Typography>
      </Stack>

      <Stack component="section" aria-label="Danh sách sự cố đô thị" spacing={1.25}>
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <Card key={index} sx={{ display: 'flex', boxShadow: 'none' }}>
              <Skeleton
                variant="rectangular"
                sx={{ width: { xs: 120, sm: 224 }, minWidth: { xs: 120, sm: 224 }, height: 168 }}
              />
              <CardContent sx={{ flex: 1 }}>
                <Skeleton width="30%" />
                <Skeleton height={34} width="78%" />
                <Skeleton width="92%" />
                <Skeleton width="55%" />
              </CardContent>
            </Card>
          ))
        ) : issues.length === 0 ? (
          <Box
            sx={{
              py: 8,
              px: 2,
              textAlign: 'center',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
            }}
          >
            <Search sx={{ fontSize: 40, mb: 1, color: 'text.disabled' }} />
            <Typography fontWeight={650} mb={0.5}>Không tìm thấy phản ánh phù hợp</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Hãy thử thay đổi từ khóa, khu vực hoặc khoảng thời gian.
            </Typography>
            {hasAnyFilter && (
              <Button variant="outlined" size="small" onClick={handleClearAll}>
                Xóa bộ lọc
              </Button>
            )}
          </Box>
        ) : (
          issues.map((issue) => {
            const issueCategory = CATEGORY_MAP[issue.category] || CATEGORY_MAP.other;
            const issueStatus = STATUS_MAP[issue.status] || STATUS_MAP.reported;
            const departmentName = getDepartmentName(issue);

            return (
              <Card
                key={issue._id}
                component="article"
                role="button"
                tabIndex={0}
                aria-label={`Xem chi tiết sự cố ${issue.title}`}
                onClick={() => navigate(`/issues/${issue._id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/issues/${issue._id}`);
                  }
                }}
                sx={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  minHeight: { sm: 168 },
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: 'none',
                  borderRadius: 1.5,
                  contentVisibility: 'auto',
                  containIntrinsicSize: '168px',
                  transition: 'border-color 160ms ease, background-color 160ms ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: '#FBFCFD',
                  },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: 2,
                  },
                }}
              >
                <IssueThumbnail issue={issue} category={issueCategory} />

                <CardContent
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    p: { xs: 2, sm: 2.25 },
                    pr: { sm: 6 },
                    '&:last-child': { pb: { xs: 2, sm: 2.25 } },
                  }}
                >
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap mb={0.9}>
                    <Chip
                      label={issueCategory.label}
                      size="small"
                      variant="outlined"
                      sx={{
                        height: 24,
                        color: issueCategory.color,
                        borderColor: `${issueCategory.color}70`,
                        bgcolor: `${issueCategory.color}0A`,
                        fontSize: '0.72rem',
                      }}
                    />
                    <Chip
                      label={issueStatus.label}
                      size="small"
                      sx={{
                        height: 24,
                        bgcolor: `${issueStatus.color}14`,
                        color: issueStatus.color,
                        fontSize: '0.72rem',
                      }}
                    />
                    <SlaBadge status={issue.slaStatus} dueAt={issue.dueAt} />
                  </Stack>

                  <Typography
                    variant="subtitle1"
                    component="h3"
                    fontWeight={700}
                    sx={{
                      mb: 0.45,
                      pr: { sm: 1 },
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 1,
                      overflow: 'hidden',
                    }}
                  >
                    {issue.title}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 1,
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 1,
                      overflow: 'hidden',
                    }}
                  >
                    {issue.description}
                  </Typography>

                  <Stack
                    direction="row"
                    spacing={1.75}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ color: 'text.secondary' }}
                  >
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                      <LocationOn sx={{ fontSize: 16 }} />
                      <Typography
                        variant="caption"
                        sx={{
                          maxWidth: { xs: 240, md: 360 },
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {issue.location}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <AccessTime sx={{ fontSize: 15 }} />
                      <Typography variant="caption">{timeAgo(issue.createdAt)}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <ThumbUp sx={{ fontSize: 15 }} />
                      <Typography variant="caption">{issue.voteCount || 0} lượt ủng hộ</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <BusinessOutlined sx={{ fontSize: 15 }} />
                      <Typography
                        variant="caption"
                        color={departmentName === 'Chưa phân công' ? 'text.disabled' : 'text.secondary'}
                      >
                        {departmentName}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>

                <ArrowForward
                  aria-hidden="true"
                  sx={{
                    display: { xs: 'none', sm: 'block' },
                    position: 'absolute',
                    right: 18,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 20,
                    color: 'text.disabled',
                  }}
                />
              </Card>
            );
          })
        )}
      </Stack>

      {pagination && pagination.pages > 1 && (
        <Box mt={4} display="flex" justifyContent="center">
          <MuiPagination
            count={pagination.pages}
            page={pagination.current}
            onChange={(_, nextPage) => setPage(nextPage)}
            color="primary"
            shape="rounded"
          />
        </Box>
      )}
    </Container>
  );
};

export default IssuesPage;
