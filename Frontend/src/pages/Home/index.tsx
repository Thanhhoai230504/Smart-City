import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Box } from '@mui/material';
import { RootState } from '../../store/store';
import { statisticsApi } from '../../api/statisticsApi';
import { issueApi } from '../../api/issueApi';
import { Issue } from '../../types';
import { C } from './homeStyle';
import HeroSection from './HeroSection';
import HowItWorks from './HowItWorks';
import CategoriesSection from './CategoriesSection';
import RolesSection from './RolesSection';
import ExploreSection from './ExploreSection';
import FinalCta from './FinalCta';
import { LoadState, Overview } from './LivePanel';

/**
 * Trang chủ: trả lời ngay "hệ thống này để làm gì" — phần đầu nói rõ mục đích và
 * có số liệu thật, rồi lần lượt cách hoạt động, loại sự cố, các vai trò, dữ liệu
 * công khai và lời kêu gọi phản ánh.
 */
const HomePage: React.FC = () => {
  const { isAuthenticated } = useSelector((s: RootState) => s.auth);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [statsState, setStatsState] = useState<LoadState>('loading');
  const [statsSlow, setStatsSlow] = useState(false);
  const [statsAt, setStatsAt] = useState<Date | null>(null);
  const [statsAttempt, setStatsAttempt] = useState(0);
  const [recent, setRecent] = useState<Issue[] | null>(null);

  // Số liệu tổng quan. Backend chạy gói miễn phí của Render, ngủ sau 15 phút không
  // ai dùng: lần gọi đầu có thể mất 30–60 giây — có khung đang tải, lời nhắc khi
  // chậm và nút thử lại khi lỗi.
  useEffect(() => {
    const ctrl = new AbortController();
    setStatsState('loading');
    setStatsSlow(false);
    const slow = window.setTimeout(() => setStatsSlow(true), 6000);
    statisticsApi.getPublicStatistics(ctrl.signal)
      .then(({ data }) => {
        setOverview(data.data?.overview || null);
        setStatsAt(new Date());
        setStatsState('ready');
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setStatsState('error');
      })
      .finally(() => window.clearTimeout(slow));
    return () => { ctrl.abort(); window.clearTimeout(slow); };
  }, [statsAttempt]);

  // Ba phản ánh mới nhất cho bảng "Tình hình xử lý" — chỉ để minh hoạ, lỗi thì ẩn.
  useEffect(() => {
    const ctrl = new AbortController();
    setRecent(null);
    issueApi.getIssues({ limit: 3 }, ctrl.signal)
      .then(({ data }) => setRecent(data.data?.issues?.slice(0, 3) ?? []))
      .catch(() => {
        if (!ctrl.signal.aborted) setRecent([]);
      });
    return () => ctrl.abort();
  }, [statsAttempt]);

  return (
    <Box sx={{ bgcolor: C.bg, color: C.ink, overflowX: 'clip' }}>
      <HeroSection
        isAuthenticated={isAuthenticated}
        overview={overview}
        statsState={statsState}
        statsSlow={statsSlow}
        statsAt={statsAt}
        onRetryStats={() => setStatsAttempt((n) => n + 1)}
        recent={recent}
      />
      <HowItWorks />
      <CategoriesSection />
      <RolesSection />
      <ExploreSection />
      <FinalCta isAuthenticated={isAuthenticated} />
    </Box>
  );
};

export default HomePage;
