import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  Collapse,
  Container,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination as MuiPagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CalendarMonth,
  CheckRounded,
  Close,
  EventRounded,
  GridViewRounded,
  NotificationsActiveRounded,
  Search,
  SearchOffRounded,
  ViewAgendaRounded,
} from '@mui/icons-material';
import { AppDispatch, RootState } from '../../store/store';
import { fetchIssues } from '../../store/slices/issueSlice';
import { getProfileThunk } from '../../store/slices/authSlice';
import { authApi } from '../../api/authApi';
import { CATEGORY_MAP, DA_NANG_DISTRICTS, STATUS_MAP } from '../../utils/constants';
import { C, FONT_MONO, mix, prefersReducedMotion } from '../Home/homeStyle';
import { categoryColor, categoryIcon } from '../Home/categoryIcons';
import IssuesHero from './IssuesHero';
import IssueCard, { IssueCardSkeleton, IssueView } from './IssueCard';
import { pillRowSx, pillSx, softFieldSx as fieldSx } from '../../components/filterStyles';

/** 12 thẻ mỗi trang: chia đều cho lưới 2 và 3 cột. */
const PAGE_SIZE = 12;
const VIEW_KEY = 'issues-view';

const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'reported', label: 'Mới báo' },
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Đã xử lý' },
  { value: 'rejected', label: 'Từ chối' },
];

const readView = (): IssueView => {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
};

const RowLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography component="span" sx={{
    width: { md: 112 }, flexShrink: 0, pt: { md: 1.25 },
    fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, letterSpacing: '.12em', color: C.muted,
  }}>
    {children}
  </Typography>
);

/**
 * Trang danh sách sự cố công khai. Phần đầu nền xanh biển (`IssuesHero`), thanh tìm kiếm nổi
 * đè lên mép dưới phần đầu, hai hàng lọc nhanh (trạng thái, loại sự cố) dạng viên thuốc, khu
 * vực theo dõi (khi đã đăng nhập), rồi danh sách dạng lưới hoặc danh sách (nhớ lựa chọn).
 */
const IssuesPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
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
  const [view, setView] = useState<IssueView>(readView);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* chế độ riêng tư chặn localStorage — chỉ không nhớ được lựa chọn */
    }
  }, [view]);

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

  const pickStatus = (next: string) => {
    setStatus(next);
    setPage(1);
  };

  const pickCategory = (next: string) => {
    setCategory(next);
    setPage(1);
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
    const params: Record<string, string | number> = { page, limit: PAGE_SIZE, sort: sortBy };
    if (status) params.status = status;
    if (category) params.category = category;
    if (search) params.search = search;
    if (district) params.district = district;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    const request = dispatch(fetchIssues(params));
    return () => request.abort();
  }, [dispatch, page, status, category, sortBy, search, district, dateFrom, dateTo]);

  const total = pagination?.total ?? issues.length;

  return (
    <Box sx={{ bgcolor: C.bg, pb: { xs: 6, md: 9 } }}>
      <IssuesHero showReportCta={!isAuthenticated} activeStatus={status} onPickStatus={pickStatus} />

      <Container maxWidth="lg" sx={{ position: 'relative', mt: { xs: -7, md: -8 } }}>
        {/* Thanh tìm kiếm nổi đè lên mép dưới phần đầu */}
        <Box
          component="section"
          aria-label="Công cụ tìm kiếm và lọc sự cố"
          sx={{
            p: { xs: 1.5, md: 2 }, borderRadius: '20px', bgcolor: C.white,
            border: `1px solid ${C.line}`, boxShadow: '0 28px 56px -34px rgba(8,40,60,.6)',
          }}
        >
          <Box sx={{
            display: 'grid', gap: 1.25, alignItems: 'center',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'minmax(0, 1fr) 200px 200px auto' },
          }}>
            <TextField
              fullWidth
              placeholder="Tìm theo tiêu đề, mô tả hoặc địa điểm..."
              value={searchInput}
              onChange={(event) => handleSearchChange(event.target.value)}
              inputProps={{ 'aria-label': 'Tìm sự cố' }}
              sx={{ ...fieldSx, gridColumn: { xs: '1 / -1', md: 'auto' } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ fontSize: 22, color: C.muted }} />
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
              label="Quận / Huyện"
              value={district}
              onChange={(event) => {
                setDistrict(event.target.value);
                setPage(1);
              }}
              sx={fieldSx}
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
              sx={fieldSx}
            >
              <MenuItem value="-createdAt">Mới nhất</MenuItem>
              <MenuItem value="createdAt">Cũ nhất</MenuItem>
              <MenuItem value="-voteCount">Nhiều ủng hộ nhất</MenuItem>
            </TextField>

            <Button
              startIcon={<EventRounded />}
              onClick={() => setShowAdvanced((current) => !current)}
              aria-expanded={showAdvanced}
              sx={{
                gridColumn: { xs: '1 / -1', md: 'auto' }, height: 56, px: 2, borderRadius: '12px', whiteSpace: 'nowrap',
                fontWeight: 700, border: '1px solid',
                borderColor: hasAdvancedFilters || showAdvanced ? C.blue : '#DCE6EB',
                color: hasAdvancedFilters || showAdvanced ? C.blue : C.body,
                bgcolor: hasAdvancedFilters ? 'rgba(11,94,142,.06)' : C.white,
                '&:hover': { bgcolor: '#EEF4F7' },
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
              sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${C.line}` }}
            >
              <Typography sx={{ minWidth: 120, fontSize: 14, fontWeight: 700, color: C.ink }}>
                Khoảng thời gian
              </Typography>
              {[
                { label: 'Từ ngày', value: dateFrom, set: setDateFrom },
                { label: 'Đến ngày', value: dateTo, set: setDateTo },
              ].map((item) => (
                <TextField
                  key={item.label}
                  label={item.label}
                  type="date"
                  size="small"
                  value={item.value}
                  onChange={(event) => {
                    item.set(event.target.value);
                    setPage(1);
                  }}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarMonth sx={{ fontSize: 18, color: C.muted }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ ...fieldSx, minWidth: 200 }}
                />
              ))}
            </Stack>
          </Collapse>
        </Box>

        {/* Lọc nhanh: trạng thái + loại sự cố */}
        <Stack spacing={1.5} sx={{ mt: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1, md: 0 }}>
            <RowLabel>TRẠNG THÁI</RowLabel>
            <Box role="group" aria-label="Lọc theo trạng thái" sx={pillRowSx}>
              {STATUS_TABS.map((item) => {
                const active = status === item.value;
                const dot = item.value ? STATUS_MAP[item.value]?.color : null;
                return (
                  <ButtonBase key={item.value || 'all'} aria-pressed={active} onClick={() => pickStatus(item.value)} sx={pillSx(active)}>
                    {dot && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dot, boxShadow: active ? '0 0 0 2px rgba(255,255,255,.25)' : 'none' }} />}
                    {item.label}
                  </ButtonBase>
                );
              })}
            </Box>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1, md: 0 }}>
            <RowLabel>LOẠI SỰ CỐ</RowLabel>
            <Box role="group" aria-label="Lọc theo loại sự cố" sx={pillRowSx}>
              <ButtonBase aria-pressed={!category} onClick={() => pickCategory('')} sx={pillSx(!category)}>
                Mọi loại
              </ButtonBase>
              {Object.entries(CATEGORY_MAP).map(([key, value]) => {
                const active = category === key;
                const Icon = categoryIcon(key);
                const color = categoryColor(key);
                return (
                  <ButtonBase
                    key={key}
                    aria-pressed={active}
                    onClick={() => pickCategory(active ? '' : key)}
                    sx={{
                      ...pillSx(active),
                      ...(active ? {} : { '& svg': { color } }),
                      // nền đang chọn: màu loại trộn 45% màu chữ chính — chữ trắng ≥ 5:1 với mọi loại
                      ...(active ? { bgcolor: mix(color, '#0F2233', 0.45), borderColor: mix(color, '#0F2233', 0.45), '&:hover': { bgcolor: mix(color, '#0F2233', 0.55) } } : {}),
                    }}
                  >
                    <Icon sx={{ fontSize: 18 }} />
                    {value.label}
                  </ButtonBase>
                );
              })}
            </Box>
          </Stack>
        </Stack>

        {(search || district || hasAdvancedFilters) && (
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            <Typography sx={{ fontSize: 13, color: C.muted, mr: 0.25 }}>Đang lọc:</Typography>
            {search && (
              <Chip size="small" label={`Từ khóa: ${search}`} onDelete={() => { setSearch(''); setSearchInput(''); setPage(1); }} />
            )}
            {district && (
              <Chip size="small" label={district} onDelete={() => { setDistrict(''); setPage(1); }} />
            )}
            {dateFrom && (
              <Chip size="small" label={`Từ ${dateFrom}`} onDelete={() => { setDateFrom(''); setPage(1); }} />
            )}
            {dateTo && (
              <Chip size="small" label={`Đến ${dateTo}`} onDelete={() => { setDateTo(''); setPage(1); }} />
            )}
          </Stack>
        )}

        {isAuthenticated && (
          <Box sx={{
            mt: 2.5, p: { xs: 1.75, md: 2 }, borderRadius: '18px', bgcolor: C.white, border: `1px solid ${C.line}`,
            display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { md: 'center' }, gap: { xs: 1.5, md: 2.5 },
          }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: { md: 250 } }}>
              <Box sx={{
                width: 40, height: 40, flexShrink: 0, borderRadius: '12px', display: 'grid', placeItems: 'center',
                color: C.blue, bgcolor: 'rgba(11,94,142,.08)',
              }}>
                <NotificationsActiveRounded sx={{ fontSize: 21 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>Khu vực đang theo dõi</Typography>
                <Typography sx={{ fontSize: 12.5, color: C.muted }}>
                  {savingWatch ? 'Đang lưu thay đổi...' : 'Chọn quận, huyện để nhận thông báo'}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {DA_NANG_DISTRICTS.map((item) => {
                const active = watchedDistricts.includes(item);
                return (
                  <ButtonBase
                    key={item}
                    aria-pressed={active}
                    disabled={savingWatch}
                    onClick={() => toggleWatchDistrict(item)}
                    sx={{
                      height: 32, px: 1.25, gap: 0.5, borderRadius: 999, fontSize: 13, fontWeight: 650,
                      border: '1px solid', borderColor: active ? C.teal : '#D5E1E7',
                      bgcolor: active ? 'rgba(12,110,116,.1)' : C.white, color: active ? C.teal : C.body,
                      '&:hover': { bgcolor: active ? 'rgba(12,110,116,.16)' : '#EEF4F7' },
                      '&.Mui-disabled': { opacity: 0.6 },
                      '&:focus-visible': { outline: `2px solid ${C.blue}`, outlineOffset: 2 },
                    }}
                  >
                    {active && <CheckRounded sx={{ fontSize: 16 }} />}
                    {item}
                  </ButtonBase>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* Danh sách */}
        <Stack
          ref={resultsRef}
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{ mt: 4, mb: 2, scrollMarginTop: 88 }}
        >
          <Typography component="h2" sx={{ fontSize: { xs: 19, md: 21 }, fontWeight: 800, letterSpacing: '-0.015em', color: C.ink }}>
            Danh sách phản ánh
          </Typography>
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 14, color: C.muted }}>
              {loading ? 'Đang cập nhật...' : `${total.toLocaleString('vi-VN')} phản ánh phù hợp`}
            </Typography>
            {hasAnyFilter && (
              <Button size="small" color="error" startIcon={<Close sx={{ fontSize: 16 }} />} onClick={handleClearAll} sx={{ minHeight: 30, py: 0.25, px: 1, borderRadius: '8px', fontWeight: 700 }}>
                Xóa bộ lọc
              </Button>
            )}
          </Box>
          <Box role="group" aria-label="Kiểu hiển thị" sx={{
            display: { xs: 'none', sm: 'inline-flex' }, p: 0.5, gap: 0.5, borderRadius: '12px',
            bgcolor: C.white, border: `1px solid ${C.line}`,
          }}>
            {[
              { value: 'grid' as const, label: 'Dạng lưới', Icon: GridViewRounded },
              { value: 'list' as const, label: 'Dạng danh sách', Icon: ViewAgendaRounded },
            ].map(({ value, label, Icon }) => (
              <IconButton
                key={value}
                aria-label={label}
                aria-pressed={view === value}
                onClick={() => setView(value)}
                size="small"
                sx={{
                  width: 34, height: 34, borderRadius: '9px',
                  color: view === value ? '#FFFFFF' : C.muted,
                  bgcolor: view === value ? C.seaDark : 'transparent',
                  '&:hover': { bgcolor: view === value ? C.sea : '#EEF4F7' },
                }}
              >
                <Icon sx={{ fontSize: 19 }} />
              </IconButton>
            ))}
          </Box>
        </Stack>

        <Box
          component="section"
          aria-label="Danh sách sự cố đô thị"
          aria-busy={loading}
          sx={{
            display: 'grid', gap: { xs: 2, md: 2.5 },
            gridTemplateColumns: view === 'grid'
              ? { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }
              : 'minmax(0, 1fr)',
          }}
        >
          {loading ? (
            Array.from({ length: view === 'grid' ? 6 : 4 }).map((_, index) => (
              <IssueCardSkeleton key={index} view={view} />
            ))
          ) : issues.length === 0 ? (
            <Box sx={{
              gridColumn: '1 / -1', py: { xs: 6, md: 8 }, px: 2, textAlign: 'center',
              bgcolor: C.white, border: `1px dashed #C9D7DE`, borderRadius: '20px',
            }}>
              <Box sx={{
                width: 64, height: 64, mx: 'auto', mb: 2, borderRadius: '50%', display: 'grid', placeItems: 'center',
                color: C.blue, bgcolor: 'rgba(11,94,142,.08)',
              }}>
                <SearchOffRounded sx={{ fontSize: 32 }} />
              </Box>
              <Typography sx={{ fontSize: 17, fontWeight: 800, color: C.ink, mb: 0.5 }}>Không tìm thấy phản ánh phù hợp</Typography>
              <Typography sx={{ fontSize: 14.5, color: C.body, mb: 2.5 }}>
                Hãy thử thay đổi từ khóa, khu vực, loại sự cố hoặc khoảng thời gian.
              </Typography>
              {hasAnyFilter && (
                <Button variant="outlined" onClick={handleClearAll} sx={{ borderRadius: '10px', fontWeight: 700 }}>
                  Xóa bộ lọc
                </Button>
              )}
            </Box>
          ) : (
            issues.map((issue) => <IssueCard key={issue._id} issue={issue} view={view} />)
          )}
        </Box>

        {pagination && pagination.pages > 1 && (
          <Box mt={5} display="flex" justifyContent="center">
            <MuiPagination
              count={pagination.pages}
              page={pagination.current}
              onChange={(_, nextPage) => {
                setPage(nextPage);
                resultsRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
              }}
              shape="rounded"
              sx={{
                '& .MuiPaginationItem-root': { borderRadius: '10px', fontWeight: 650, color: C.body },
                '& .MuiPaginationItem-page': { bgcolor: C.white, border: `1px solid ${C.line}` },
                '& .MuiPaginationItem-root.Mui-selected': {
                  bgcolor: C.seaDark, borderColor: C.seaDark, color: '#FFFFFF',
                  '&:hover': { bgcolor: C.sea },
                },
              }}
            />
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default IssuesPage;
