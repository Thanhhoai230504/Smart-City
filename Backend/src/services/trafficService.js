const axios = require('axios');
const cache = require('../utils/cache');

const DA_NANG_ROADS = [
  // Hải Châu
  { name: 'Đường 2 Tháng 9', lat: 16.0601, lon: 108.2239 },
  { name: 'Đường Bạch Đằng', lat: 16.0739, lon: 108.2246 },
  { name: 'Đường Lê Duẩn', lat: 16.0717, lon: 108.2232 },
  { name: 'Đường Điện Biên Phủ', lat: 16.0670, lon: 108.2170 },
  { name: 'Đường Trần Cao Vân', lat: 16.0722, lon: 108.2070 },
  // Thanh Khê
  { name: 'Đường Ông Ích Khiêm', lat: 16.0631, lon: 108.2157 },
  { name: 'Đường Dũng Sĩ Thanh Khê', lat: 16.0774, lon: 108.1708 },
  // Sơn Trà
  { name: 'Đường Ngô Quyền', lat: 16.0907, lon: 108.2428 },
  { name: 'Đường Hoàng Sa', lat: 16.0951, lon: 108.2522 },
  // Ngũ Hành Sơn
  { name: 'Đường Võ Nguyên Giáp', lat: 16.0544, lon: 108.2476 },
  { name: 'Đường Lê Văn Hiến', lat: 16.0300, lon: 108.2596 },
  { name: 'Đường Trường Sa', lat: 16.0300, lon: 108.2550 },
  // Cẩm Lệ
  { name: 'Đường Nguyễn Hữu Thọ', lat: 16.0192, lon: 108.2116 },
  { name: 'Đường Trường Chinh', lat: 16.0171, lon: 108.1933 },
  // Liên Chiểu
  { name: 'Đường Nguyễn Tất Thành', lat: 16.0787, lon: 108.1713 },
  { name: 'Đường Nguyễn Lương Bằng', lat: 16.0728, lon: 108.1499 },
  // Cầu
  { name: 'Cầu Rồng', lat: 16.0612, lon: 108.2279 },
  { name: 'Cầu Trần Thị Lý', lat: 16.0511, lon: 108.2291 },
  { name: 'Cầu Thuận Phước', lat: 16.0835, lon: 108.2130 },
  { name: 'Cầu Sông Hàn', lat: 16.0724, lon: 108.2284 },
  // Bổ sung
  { name: 'Đường Hùng Vương', lat: 16.0680, lon: 108.2205 },
  { name: 'Đường Nguyễn Văn Linh', lat: 16.0560, lon: 108.2120 },
  { name: 'Đường Trần Phú', lat: 16.0650, lon: 108.2200 },
  { name: 'Đường Phan Chu Trinh', lat: 16.0700, lon: 108.2180 },
  { name: 'Đường Hà Huy Tập', lat: 16.0610, lon: 108.1930 },
  { name: 'Đường Tôn Đức Thắng', lat: 16.0650, lon: 108.1860 },
  { name: 'Đường Phạm Văn Đồng', lat: 16.0800, lon: 108.2490 },
  { name: 'Đường Võ Văn Kiệt', lat: 16.0860, lon: 108.2350 },
  { name: 'Đường Lê Đức Thọ', lat: 16.0820, lon: 108.2310 },
  { name: 'Đường Ngũ Hành Sơn', lat: 16.0420, lon: 108.2440 },
  { name: 'Đường Lê Văn Lương', lat: 16.0250, lon: 108.2490 },
  { name: 'Đường Cách Mạng Tháng 8', lat: 16.0400, lon: 108.2060 },
  { name: 'Đường Võ Chí Công', lat: 16.0140, lon: 108.2200 },
  { name: 'Đường Quốc lộ 14B', lat: 16.0100, lon: 108.1700 },
  { name: 'Đường Hầm Hải Vân (QL1A)', lat: 16.1020, lon: 108.1250 },
  { name: 'Đường Hoà Minh', lat: 16.0680, lon: 108.1600 },
  { name: 'Đường Trường Chinh', lat: 16.0480, lon: 108.2010 },
  { name: 'Đường Đinh Tiên Hoàng', lat: 16.0760, lon: 108.2140 },
  { name: 'Nút giao Ngã Ba Huế', lat: 16.0640, lon: 108.2050 },
  { name: 'Đường Trần Đại Nghĩa', lat: 16.0330, lon: 108.2300 },
];

const CACHE_KEY = 'traffic_stats';
const CACHE_TTL = 15 * 60 * 1000;

const fetchRoadSpeed = async (road, apiKey) => {
  try {
    const response = await axios.get(
      'https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/12/json',
      {
        params: { key: apiKey, point: `${road.lat},${road.lon}`, unit: 'KMPH' },
        timeout: 8000,
      }
    );
    const flow = response.data.flowSegmentData;
    const ratio = flow.currentSpeed / flow.freeFlowSpeed;
    return {
      name: road.name,
      currentSpeed: flow.currentSpeed,
      freeFlowSpeed: flow.freeFlowSpeed,
      ratio,
      level: ratio > 0.75 ? 'normal' : ratio > 0.5 ? 'slow' : ratio > 0.25 ? 'congested' : 'heavy',
    };
  } catch {
    return null;
  }
};

const calculateStats = (segments) => {
  const total = segments.length;
  const avgSpeed = Math.round(segments.reduce((sum, s) => sum + s.currentSpeed, 0) / total);
  const avgFreeFlow = Math.round(segments.reduce((sum, s) => sum + s.freeFlowSpeed, 0) / total);
  const avgRatio = segments.reduce((sum, s) => sum + s.ratio, 0) / total;

  const levelCount = { normal: 0, slow: 0, congested: 0, heavy: 0 };
  segments.forEach(s => { levelCount[s.level]++; });

  const worstRoads = [...segments]
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 5)
    .map(s => ({ name: s.name, currentSpeed: s.currentSpeed, freeFlowSpeed: s.freeFlowSpeed, level: s.level }));

  const bestRoads = [...segments]
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5)
    .map(s => ({ name: s.name, currentSpeed: s.currentSpeed, freeFlowSpeed: s.freeFlowSpeed, level: s.level }));

  return {
    source: 'api',
    lastUpdated: new Date().toISOString(),
    totalRoads: total,
    averageSpeed: avgSpeed,
    averageFreeFlowSpeed: avgFreeFlow,
    congestionIndex: Math.round((1 - avgRatio) * 100),
    summary: { normal: levelCount.normal, slow: levelCount.slow, congested: levelCount.congested, heavy: levelCount.heavy },
    worstRoads,
    bestRoads,
    roads: segments.map(s => ({ name: s.name, currentSpeed: s.currentSpeed, freeFlowSpeed: s.freeFlowSpeed, level: s.level })),
  };
};

const getMockStats = () => ({
  source: 'mock',
  lastUpdated: new Date().toISOString(),
  totalRoads: 20,
  averageSpeed: 32,
  averageFreeFlowSpeed: 45,
  congestionIndex: 29,
  summary: { normal: 8, slow: 8, congested: 3, heavy: 1 },
  worstRoads: [
    { name: 'Đường Điện Biên Phủ', currentSpeed: 12, freeFlowSpeed: 50, level: 'heavy' },
    { name: 'Đường Trần Cao Vân', currentSpeed: 18, freeFlowSpeed: 45, level: 'congested' },
  ],
  bestRoads: [
    { name: 'Đường Võ Nguyên Giáp', currentSpeed: 55, freeFlowSpeed: 60, level: 'normal' },
    { name: 'Đường Hoàng Sa', currentSpeed: 50, freeFlowSpeed: 55, level: 'normal' },
  ],
  roads: [],
});

const getTrafficStats = async () => {
  const cachedData = cache.get(CACHE_KEY);
  if (cachedData) return cachedData;

  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) return getMockStats();

  const results = await Promise.allSettled(
    DA_NANG_ROADS.map(road => fetchRoadSpeed(road, apiKey))
  );

  const segments = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);

  if (segments.length === 0) return getMockStats();

  const stats = calculateStats(segments);
  cache.set(CACHE_KEY, stats, CACHE_TTL);
  return stats;
};

module.exports = { getTrafficStats };
