const BADGE_CONFIG = [
  { id: 'first_report', label: 'Khởi đầu', icon: '🌱', threshold: 1, description: 'Báo cáo sự cố đầu tiên' },
  { id: 'active_citizen', label: 'Công dân tích cực', icon: '⭐', threshold: 5, description: 'Đã báo cáo 5 sự cố' },
  { id: 'city_guardian', label: 'Người bảo vệ', icon: '🛡️', threshold: 10, description: 'Đã báo cáo 10 sự cố' },
  { id: 'ambassador', label: 'Đại sứ đô thị', icon: '🏆', threshold: 20, description: 'Đã báo cáo 20 sự cố' },
  { id: 'legend', label: 'Huyền thoại', icon: '👑', threshold: 50, description: 'Đã báo cáo 50 sự cố' },
];

const getBadgesForCount = (issueCount) => {
  return BADGE_CONFIG
    .filter(b => issueCount >= b.threshold)
    .map(b => ({ ...b, earned: true }));
};

const getNextBadge = (issueCount) => {
  const next = BADGE_CONFIG.find(b => issueCount < b.threshold);
  if (!next) return null;
  return { ...next, remaining: next.threshold - issueCount };
};

module.exports = { BADGE_CONFIG, getBadgesForCount, getNextBadge };
