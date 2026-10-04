const axios = require('axios');
const cache = require('../utils/cache');

/**
 * Điểm đo tốc độ — mỗi điểm nằm GIỮA một đoạn của đúng tuyến đó, lấy từ hình
 * học OpenStreetMap (04/10/2026) và đã kiểm bằng TomTom: cả 32 điểm rơi đúng
 * trên đoạn được đo (lệch 0–10 m).
 *
 * Danh sách cũ ghi "verified via Google Maps" nhưng 23/32 điểm bị TomTom bắt
 * sang đoạn cách 25 m – 1,5 km (điểm "Cách Mạng Tháng 8" thực ra đo một tuyến
 * cách 1,5 km), vài tên khác nhau còn ra cùng một đoạn.
 *
 * Tên hiển thị lấy từ đây. KHÔNG tra địa chỉ ngược nữa: Goong trả về số nhà,
 * kiệt, tên cửa hàng gần điểm nhất ("Trà chanh …", "Kiệt 372 …") chứ không phải
 * tên đường. Cầu Nguyễn Văn Trỗi không có — giờ chỉ dành cho người đi bộ.
 */
const DA_NANG_ROADS = [
  { name: 'Đường 2 Tháng 9', lat: 16.057384, lon: 108.222359 },
  { name: 'Đường Bạch Đằng', lat: 16.066704, lon: 108.224814 },
  { name: 'Đường Lê Duẩn', lat: 16.070779, lon: 108.216251 },
  { name: 'Đường Hùng Vương', lat: 16.067895, lon: 108.21721 },
  { name: 'Đường Trần Phú', lat: 16.066457, lon: 108.223685 },
  { name: 'Đường Phan Châu Trinh', lat: 16.057226, lon: 108.218891 },
  { name: 'Đường Nguyễn Văn Linh', lat: 16.060903, lon: 108.220717 },
  { name: 'Đường Hoàng Diệu', lat: 16.056245, lon: 108.217156 },
  { name: 'Đường Điện Biên Phủ', lat: 16.065609, lon: 108.196079 },
  { name: 'Đường Ông Ích Khiêm', lat: 16.075337, lon: 108.212451 },
  { name: 'Đường Trần Cao Vân', lat: 16.071199, lon: 108.194207 },
  { name: 'Đường Hà Huy Tập', lat: 16.061888, lon: 108.191851 },
  { name: 'Đường Nguyễn Tri Phương', lat: 16.0524, lon: 108.21054 },
  { name: 'Đường Ngô Quyền', lat: 16.079344, lon: 108.233329 },
  { name: 'Đường Phạm Văn Đồng', lat: 16.07008, lon: 108.241494 },
  { name: 'Đường Võ Văn Kiệt', lat: 16.063128, lon: 108.242809 },
  { name: 'Đường Hoàng Sa', lat: 16.095087, lon: 108.252184 },
  { name: 'Đường Võ Nguyên Giáp', lat: 16.026328, lon: 108.25583 },
  { name: 'Đường Trường Sa', lat: 15.977128, lon: 108.277803 },
  { name: 'Đường Lê Văn Hiến', lat: 16.025527, lon: 108.249596 },
  { name: 'Đường Ngũ Hành Sơn', lat: 16.046959, lon: 108.238627 },
  { name: 'Đường Cách Mạng Tháng 8', lat: 16.02316, lon: 108.215125 },
  { name: 'Đường Trường Chinh', lat: 16.039999, lon: 108.185948 },
  { name: 'Đường Nguyễn Hữu Thọ', lat: 16.047089, lon: 108.209596 },
  { name: 'Đường Tôn Đức Thắng', lat: 16.060947, lon: 108.161609 },
  { name: 'Đường Nguyễn Tất Thành', lat: 16.082886, lon: 108.163751 },
  { name: 'Đường Nguyễn Lương Bằng', lat: 16.093196, lon: 108.140457 },
  { name: 'Cầu Rồng', lat: 16.061092, lon: 108.2279 },
  { name: 'Cầu Sông Hàn', lat: 16.07236, lon: 108.228411 },
  { name: 'Cầu Trần Thị Lý', lat: 16.05039, lon: 108.229994 },
  { name: 'Cầu Thuận Phước', lat: 16.095126, lon: 108.220565 },
  { name: 'Cầu Tiên Sơn', lat: 16.035426, lon: 108.235672 },
];

// Zoom 18: TomTom xét cả đường cấp thấp nên bắt đúng đoạn tại điểm đo. Ở zoom
// 12 (bản cũ) chỉ còn đường lớn, điểm trên đường nhỏ bị bắt sang tuyến khác.
const FLOW_URL = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/18/json';

// TomTom: confidence > 0.6 nghĩa là tốc độ đo từ xe đang chạy (thời gian thực);
// thấp hơn là ước tính từ dữ liệu lịch sử — không phản ánh tình hình lúc này.
const LIVE_CONFIDENCE = 0.6;

const CACHE_KEY = 'traffic_stats';
const CACHE_TTL = 15 * 60 * 1000;

const levelOf = (ratio) => (ratio > 0.75 ? 'normal' : ratio > 0.5 ? 'slow' : ratio > 0.25 ? 'congested' : 'heavy');

const fetchRoadSpeed = async (road, apiKey) => {
  try {
    const { data } = await axios.get(FLOW_URL, {
      params: { key: apiKey, point: `${road.lat},${road.lon}`, unit: 'KMPH' },
      timeout: 8000,
    });
    const flow = data.flowSegmentData;
    if (!flow || !(flow.freeFlowSpeed > 0)) return null;

    const closed = flow.roadClosure === true;
    const ratio = closed ? 0 : flow.currentSpeed / flow.freeFlowSpeed;
    const coords = flow.coordinates?.coordinate || [];
    const first = coords[0];
    const last = coords[coords.length - 1];

    return {
      name: road.name,
      lat: road.lat,
      lon: road.lon,
      currentSpeed: flow.currentSpeed,
      freeFlowSpeed: flow.freeFlowSpeed,
      currentTravelTime: flow.currentTravelTime,
      freeFlowTravelTime: flow.freeFlowTravelTime,
      confidence: flow.confidence,
      live: flow.confidence > LIVE_CONFIDENCE,
      closed,
      ratio,
      level: closed ? 'closed' : levelOf(ratio),
      // TomTom có khi trả một đoạn dài phủ nhiều tuyến nối liền (Võ Nguyên Giáp →
      // Trường Sa). Cùng đoạn thì thống kê chỉ tính một lần.
      segmentKey: first && last
        ? `${first.latitude},${first.longitude}|${last.latitude},${last.longitude}`
        : `${road.lat},${road.lon}`,
    };
  } catch {
    return null;
  }
};

const roadView = (s, sharedWith = []) => ({
  name: s.name,
  lat: s.lat,
  lon: s.lon,
  currentSpeed: s.currentSpeed,
  freeFlowSpeed: s.freeFlowSpeed,
  level: s.level,
  live: s.live,
  confidence: s.confidence,
  closed: s.closed,
  // Tuyến khác cùng đoạn đo TomTom → cùng số liệu; ghi ra để người xem không
  // tưởng là lỗi khi hai tuyến hiện y hệt nhau.
  sharedWith,
});

const average = (items, pick) => (items.length
  ? Math.round(items.reduce((sum, s) => sum + pick(s), 0) / items.length)
  : 0);

/**
 * Số liệu tổng hợp chỉ dùng đoạn có dữ liệu thời gian thực, mỗi đoạn một lần.
 * Chỉ số tắc nghẽn theo cách TomTom Traffic Index: thời gian đi lại tăng bao
 * nhiêu % so với lúc thông thoáng (tổng thời gian hiện tại / tổng thời gian
 * thông thoáng − 1). Bản cũ dùng 1 − trung bình(tốc độ / tốc độ thông thoáng):
 * không phải thước đo chuẩn, và nhẹ tay với đoạn kẹt (chạy nửa tốc độ = 50%,
 * trong khi thời gian đi lại thực tế gấp đôi).
 */
const calculateStats = (segments, now = new Date()) => {
  const namesBySegment = new Map();
  segments.forEach((s) => namesBySegment.set(s.segmentKey, [...(namesBySegment.get(s.segmentKey) || []), s.name]));
  const view = (s) => roadView(s, namesBySegment.get(s.segmentKey).filter((n) => n !== s.name));

  const seen = new Set();
  const unique = segments.filter((s) => (seen.has(s.segmentKey) ? false : seen.add(s.segmentKey)));
  const measured = unique.filter((s) => s.live && !s.closed);

  const travel = measured.reduce(
    (acc, s) => ({ now: acc.now + (s.currentTravelTime || 0), free: acc.free + (s.freeFlowTravelTime || 0) }),
    { now: 0, free: 0 },
  );
  const congestionIndex = travel.free > 0
    ? Math.max(0, Math.round((travel.now / travel.free - 1) * 100))
    : 0;

  const summary = { normal: 0, slow: 0, congested: 0, heavy: 0, closed: 0 };
  unique.forEach((s) => { if (s.closed || s.live) summary[s.level] += 1; });

  // Đóng đường đứng đầu "cần chú ý"; đoạn chưa có dữ liệu thời gian thực không
  // được xếp hạng tốt/xấu vì tốc độ đó là ước tính.
  const ranked = unique.filter((s) => s.closed || s.live);
  const worstRoads = [...ranked].sort((a, b) => a.ratio - b.ratio).slice(0, 5).map(view);
  const bestRoads = [...ranked].filter((s) => !s.closed).sort((a, b) => b.ratio - a.ratio).slice(0, 5).map(view);

  return {
    source: 'tomtom',
    lastUpdated: now.toISOString(),
    totalRoads: segments.length,
    measuredSegments: measured.length,
    estimatedRoads: segments.filter((s) => !s.live && !s.closed).length,
    averageSpeed: average(measured, (s) => s.currentSpeed),
    averageFreeFlowSpeed: average(measured, (s) => s.freeFlowSpeed),
    congestionIndex,
    summary,
    worstRoads,
    bestRoads,
    roads: segments.map(view),
  };
};

const getMockStats = () => ({
  source: 'mock',
  lastUpdated: new Date().toISOString(),
  totalRoads: 20,
  measuredSegments: 20,
  estimatedRoads: 0,
  averageSpeed: 32,
  averageFreeFlowSpeed: 45,
  congestionIndex: 29,
  summary: { normal: 8, slow: 8, congested: 3, heavy: 1, closed: 0 },
  worstRoads: [
    { name: 'Đường Điện Biên Phủ', lat: 16.065609, lon: 108.196079, currentSpeed: 12, freeFlowSpeed: 50, level: 'heavy' },
    { name: 'Đường Trần Cao Vân', lat: 16.071199, lon: 108.194207, currentSpeed: 18, freeFlowSpeed: 45, level: 'congested' },
  ],
  bestRoads: [
    { name: 'Đường Võ Nguyên Giáp', lat: 16.026328, lon: 108.25583, currentSpeed: 55, freeFlowSpeed: 60, level: 'normal' },
    { name: 'Đường Hoàng Sa', lat: 16.095087, lon: 108.252184, currentSpeed: 50, freeFlowSpeed: 55, level: 'normal' },
  ],
  roads: [],
});

const getTrafficStats = async () => {
  const cachedData = cache.get(CACHE_KEY);
  if (cachedData) return cachedData;

  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) return getMockStats();

  // 5 điểm một lượt để không chạm giới hạn tần suất của TomTom
  const batchSize = 5;
  const segments = [];

  for (let i = 0; i < DA_NANG_ROADS.length; i += batchSize) {
    const batch = DA_NANG_ROADS.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((road) => fetchRoadSpeed(road, apiKey)));
    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value) segments.push(r.value);
    });
  }

  if (segments.length === 0) return getMockStats();

  const stats = calculateStats(segments);
  cache.set(CACHE_KEY, stats, CACHE_TTL);
  return stats;
};

module.exports = {
  getTrafficStats,
  calculateStats,
  levelOf,
  DA_NANG_ROADS,
  LIVE_CONFIDENCE,
};
