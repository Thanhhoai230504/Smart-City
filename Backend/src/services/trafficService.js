const axios = require('axios');
const cache = require('../utils/cache');

// Tọa độ chính xác các tuyến đường chính Đà Nẵng (verified via Google Maps)
const DA_NANG_ROADS = [
  // ═══ Hải Châu ═══
  { lat: 16.0544, lon: 108.2186, fallbackName: 'Đường 2 Tháng 9' },
  { lat: 16.0710, lon: 108.2242, fallbackName: 'Đường Bạch Đằng' },
  { lat: 16.0725, lon: 108.2195, fallbackName: 'Đường Lê Duẩn' },
  { lat: 16.0605, lon: 108.2103, fallbackName: 'Đường Điện Biên Phủ' },
  { lat: 16.0678, lon: 108.2153, fallbackName: 'Đường Hùng Vương' },
  { lat: 16.0698, lon: 108.2103, fallbackName: 'Đường Trần Cao Vân' },
  { lat: 16.0653, lon: 108.2188, fallbackName: 'Đường Trần Phú' },
  { lat: 16.0688, lon: 108.2143, fallbackName: 'Đường Phan Chu Trinh' },
  { lat: 16.0563, lon: 108.2073, fallbackName: 'Đường Nguyễn Văn Linh' },

  // ═══ Thanh Khê ═══
  { lat: 16.0655, lon: 108.1968, fallbackName: 'Đường Ông Ích Khiêm' },
  { lat: 16.0710, lon: 108.1930, fallbackName: 'Đường Đinh Tiên Hoàng' },
  { lat: 16.0640, lon: 108.1870, fallbackName: 'Đường Tôn Đức Thắng' },
  { lat: 16.0575, lon: 108.1885, fallbackName: 'Đường Hà Huy Tập' },

  // ═══ Sơn Trà ═══
  { lat: 16.0830, lon: 108.2328, fallbackName: 'Đường Ngô Quyền' },
  { lat: 16.0918, lon: 108.2478, fallbackName: 'Đường Hoàng Sa' },
  { lat: 16.0810, lon: 108.2378, fallbackName: 'Đường Phạm Văn Đồng' },
  { lat: 16.0860, lon: 108.2290, fallbackName: 'Đường Lê Đức Thọ' },

  // ═══ Ngũ Hành Sơn ═══
  { lat: 16.0480, lon: 108.2488, fallbackName: 'Đường Võ Nguyên Giáp' },
  { lat: 16.0320, lon: 108.2508, fallbackName: 'Đường Trường Sa' },
  { lat: 16.0350, lon: 108.2380, fallbackName: 'Đường Lê Văn Hiến' },
  { lat: 16.0413, lon: 108.2398, fallbackName: 'Đường Ngũ Hành Sơn' },

  // ═══ Cẩm Lệ ═══
  { lat: 16.0210, lon: 108.2120, fallbackName: 'Đường Nguyễn Hữu Thọ' },
  { lat: 16.0380, lon: 108.2018, fallbackName: 'Đường Cách Mạng Tháng 8' },
  { lat: 16.0180, lon: 108.2008, fallbackName: 'Đường Trường Chinh' },

  // ═══ Liên Chiểu ═══
  { lat: 16.0830, lon: 108.1548, fallbackName: 'Đường Nguyễn Tất Thành' },
  { lat: 16.0728, lon: 108.1518, fallbackName: 'Đường Nguyễn Lương Bằng' },
  { lat: 16.0680, lon: 108.1585, fallbackName: 'Đường Tôn Đức Thắng (Liên Chiểu)' },

  // ═══ Cầu & nút giao ═══
  { lat: 16.0612, lon: 108.2275, fallbackName: 'Cầu Rồng' },
  { lat: 16.0525, lon: 108.2275, fallbackName: 'Cầu Trần Thị Lý' },
  { lat: 16.0724, lon: 108.2270, fallbackName: 'Cầu Sông Hàn' },
  { lat: 16.0835, lon: 108.2105, fallbackName: 'Cầu Thuận Phước' },
  { lat: 16.0643, lon: 108.2048, fallbackName: 'Nút giao Ngã Ba Huế' },
];

const GOONG_API_KEY = process.env.GOONG_API_KEY;
const CACHE_KEY = 'traffic_stats';
const CACHE_TTL = 15 * 60 * 1000;

// Reverse geocode via Goong to get accurate road name
const reverseGeocode = async (lat, lon) => {
  if (!GOONG_API_KEY) return null;
  try {
    const { data } = await axios.get(
      `https://rsapi.goong.io/Geocode?latlng=${lat},${lon}&api_key=${GOONG_API_KEY}`,
      { timeout: 5000 }
    );
    if (data.status === 'OK' && data.results?.length > 0) {
      // Lấy tên đường từ compound hoặc formatted_address
      const result = data.results[0];
      const route = result.address_components?.find(c => c.types?.includes('route'));
      return route?.long_name || result.formatted_address?.split(',')[0] || null;
    }
  } catch { /* ignore */ }
  return null;
};

// Fetch traffic data for a road point from TomTom
const fetchRoadSpeed = async (road, apiKey) => {
  try {
    const { data } = await axios.get(
      'https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/12/json',
      { params: { key: apiKey, point: `${road.lat},${road.lon}`, unit: 'KMPH' }, timeout: 8000 }
    );
    const flow = data.flowSegmentData;
    const ratio = flow.currentSpeed / flow.freeFlowSpeed;

    // Get accurate road name from Goong, fallback to predefined name
    let roadName = road.fallbackName;
    const goongName = await reverseGeocode(road.lat, road.lon);
    if (goongName && goongName.length > 3) roadName = goongName;

    return {
      name: roadName,
      lat: road.lat,
      lon: road.lon,
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
    .map(s => ({ name: s.name, lat: s.lat, lon: s.lon, currentSpeed: s.currentSpeed, freeFlowSpeed: s.freeFlowSpeed, level: s.level }));

  const bestRoads = [...segments]
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5)
    .map(s => ({ name: s.name, lat: s.lat, lon: s.lon, currentSpeed: s.currentSpeed, freeFlowSpeed: s.freeFlowSpeed, level: s.level }));

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
    roads: segments.map(s => ({
      name: s.name, lat: s.lat, lon: s.lon,
      currentSpeed: s.currentSpeed, freeFlowSpeed: s.freeFlowSpeed, level: s.level,
    })),
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
    { name: 'Đường Điện Biên Phủ', lat: 16.0605, lon: 108.2103, currentSpeed: 12, freeFlowSpeed: 50, level: 'heavy' },
    { name: 'Đường Trần Cao Vân', lat: 16.0698, lon: 108.2103, currentSpeed: 18, freeFlowSpeed: 45, level: 'congested' },
  ],
  bestRoads: [
    { name: 'Đường Võ Nguyên Giáp', lat: 16.0480, lon: 108.2488, currentSpeed: 55, freeFlowSpeed: 60, level: 'normal' },
    { name: 'Đường Hoàng Sa', lat: 16.0918, lon: 108.2478, currentSpeed: 50, freeFlowSpeed: 55, level: 'normal' },
  ],
  roads: [],
});

const getTrafficStats = async () => {
  const cachedData = cache.get(CACHE_KEY);
  if (cachedData) return cachedData;

  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) return getMockStats();

  // Fetch traffic + Goong reverse geocode in parallel batches (5 at a time to avoid rate limits)
  const batchSize = 5;
  const segments = [];

  for (let i = 0; i < DA_NANG_ROADS.length; i += batchSize) {
    const batch = DA_NANG_ROADS.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(road => fetchRoadSpeed(road, apiKey))
    );
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) segments.push(r.value);
    });
  }

  if (segments.length === 0) return getMockStats();

  const stats = calculateStats(segments);
  cache.set(CACHE_KEY, stats, CACHE_TTL);
  return stats;
};

module.exports = { getTrafficStats };
