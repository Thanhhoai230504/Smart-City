const axios = require('axios');
const cache = require('../utils/cache');

/**
 * 20 key sampling points across Da Nang for traffic statistics.
 * Fewer than the old 50 — optimized for aggregated stats, not map display.
 */
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

  // ── BỔ SUNG 20 ĐƯỜNG HUYẾT MẠCH ─────────────────────────────

  // Hải Châu – trục nội đô
  { name: 'Đường Hùng Vương', lat: 16.0680, lon: 108.2205 }, // trục Đông-Tây trung tâm
  { name: 'Đường Nguyễn Văn Linh', lat: 16.0560, lon: 108.2120 }, // vành đai phía Nam Hải Châu
  { name: 'Đường Trần Phú', lat: 16.0650, lon: 108.2200 }, // song song Hùng Vương
  { name: 'Đường Phan Chu Trinh', lat: 16.0700, lon: 108.2180 }, // kết nối sân bay – trung tâm

  // Thanh Khê – khu dân cư dày đặc
  { name: 'Đường Hà Huy Tập', lat: 16.0610, lon: 108.1930 }, // trục chính Thanh Khê
  { name: 'Đường Tôn Đức Thắng', lat: 16.0650, lon: 108.1860 }, // nối Liên Chiểu – Thanh Khê

  // Sơn Trà – bán đảo & khu du lịch
  { name: 'Đường Phạm Văn Đồng', lat: 16.0800, lon: 108.2490 }, // ven biển Sơn Trà – Ngũ Hành Sơn
  { name: 'Đường Võ Văn Kiệt', lat: 16.0860, lon: 108.2350 }, // trục Sơn Trà nối nội đô
  { name: 'Đường Lê Đức Thọ', lat: 16.0820, lon: 108.2310 }, // kết nối cảng Tiên Sa

  // Ngũ Hành Sơn – ven biển phía Nam
  { name: 'Đường Ngũ Hành Sơn', lat: 16.0420, lon: 108.2440 }, // trục chính quận NHS
  { name: 'Đường Lê Văn Lương', lat: 16.0250, lon: 108.2490 }, // khu đô thị Nam NHS

  // Cẩm Lệ – đô thị mới phía Nam
  { name: 'Đường Cách Mạng Tháng 8', lat: 16.0400, lon: 108.2060 }, // nối Cẩm Lệ – Hải Châu
  { name: 'Đường Võ Chí Công', lat: 16.0140, lon: 108.2200 }, // trục Hòa Xuân – cầu Cẩm Lệ
  { name: 'Đường Quốc lộ 14B', lat: 16.0100, lon: 108.1700 }, // cửa ngõ Tây Nam ĐN

  // Liên Chiểu – cửa ngõ phía Bắc & Tây Bắc
  { name: 'Đường Hầm Hải Vân (QL1A)', lat: 16.1020, lon: 108.1250 }, // cửa ngõ Bắc quan trọng nhất
  { name: 'Đường Hoà Minh', lat: 16.0680, lon: 108.1600 }, // nội khu Liên Chiểu

  // Vành đai & nút giao thông liên quận
  { name: 'Đường Trường Chinh', lat: 16.0480, lon: 108.2010 }, // vành đai Tây – nối Cẩm Lệ & Hải Châu
  { name: 'Đường Đinh Tiên Hoàng', lat: 16.0760, lon: 108.2140 }, // nút giao trung tâm Thanh Khê
  { name: 'Nút giao Ngã Ba Huế', lat: 16.0640, lon: 108.2050 }, // điểm ùn tắc trọng yếu
  { name: 'Đường Trần Đại Nghĩa', lat: 16.0330, lon: 108.2300 }, // kết nối NHS – Cẩm Lệ phía Nam
];

const CACHE_KEY = 'traffic_stats';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * @desc    Get traffic statistics for dashboard
 * @route   GET /api/traffic/stats
 * @access  Public
 */
const getTrafficStats = async (req, res, next) => {
  try {
    const cachedData = cache.get(CACHE_KEY);
    if (cachedData) {
      return res.json({ success: true, data: cachedData });
    }

    const apiKey = process.env.TOMTOM_API_KEY;
    if (!apiKey) {
      return res.json({
        success: true,
        data: getMockStats(),
      });
    }

    // Fetch traffic for all sampling points
    const results = await Promise.allSettled(
      DA_NANG_ROADS.map(road => fetchRoadSpeed(road, apiKey))
    );

    const segments = results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    if (segments.length === 0) {
      return res.json({ success: true, data: getMockStats() });
    }

    // Calculate aggregated statistics
    const stats = calculateStats(segments);

    cache.set(CACHE_KEY, stats, CACHE_TTL);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch speed data for a single road from TomTom
 */
async function fetchRoadSpeed(road, apiKey) {
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
}

/**
 * Calculate aggregated traffic statistics
 */
function calculateStats(segments) {
  const total = segments.length;
  const avgSpeed = Math.round(segments.reduce((sum, s) => sum + s.currentSpeed, 0) / total);
  const avgFreeFlow = Math.round(segments.reduce((sum, s) => sum + s.freeFlowSpeed, 0) / total);
  const avgRatio = segments.reduce((sum, s) => sum + s.ratio, 0) / total;

  // Count by level
  const levelCount = { normal: 0, slow: 0, congested: 0, heavy: 0 };
  segments.forEach(s => { levelCount[s.level]++; });

  // Find worst roads (slowest ratio)
  const worstRoads = [...segments]
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 5)
    .map(s => ({
      name: s.name,
      currentSpeed: s.currentSpeed,
      freeFlowSpeed: s.freeFlowSpeed,
      level: s.level,
    }));

  // Find best roads
  const bestRoads = [...segments]
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5)
    .map(s => ({
      name: s.name,
      currentSpeed: s.currentSpeed,
      freeFlowSpeed: s.freeFlowSpeed,
      level: s.level,
    }));

  return {
    source: 'api',
    lastUpdated: new Date().toISOString(),
    totalRoads: total,
    averageSpeed: avgSpeed,
    averageFreeFlowSpeed: avgFreeFlow,
    congestionIndex: Math.round((1 - avgRatio) * 100), // 0% = thông thoáng, 100% = kẹt cứng
    summary: {
      normal: levelCount.normal,
      slow: levelCount.slow,
      congested: levelCount.congested,
      heavy: levelCount.heavy,
    },
    worstRoads,
    bestRoads,
    roads: segments.map(s => ({
      name: s.name,
      currentSpeed: s.currentSpeed,
      freeFlowSpeed: s.freeFlowSpeed,
      level: s.level,
    })),
  };
}

/**
 * Mock stats when API is unavailable
 */
function getMockStats() {
  return {
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
  };
}

module.exports = { getTrafficStats };
