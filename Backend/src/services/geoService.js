const axios = require('axios');
const ApiError = require('../utils/apiError');
// utils/cache export một singleton dùng chung cho cả hệ thống (traffic, môi
// trường, AI, chatbot đều xài). Dùng lại nó với key có tiền tố thay vì tự dựng
// store riêng — TTL truyền theo từng lần set nên không vướng nhau.
const cache = require('../utils/cache');

/**
 * Proxy các lời gọi Goong/TomTom để API key không rời khỏi server.
 *
 * Vì sao bắt buộc: Vite nhúng mọi biến `VITE_*` thẳng vào bundle, nên key hiện
 * đang nằm công khai trong `dist/assets/*.js`. Trên web còn hạn chế được bằng
 * HTTP referrer restriction ở dashboard nhà cung cấp, nhưng app native **không
 * gửi referrer** và APK thì giải nén ra là đọc được — không có cách nào chặn.
 *
 * Cache có hai mục đích: giảm độ trễ và giữ hoá đơn. Autocomplete bị gọi mỗi lần
 * người dùng gõ (dù đã debounce), còn tile giao thông bị gọi theo từng ô bản đồ.
 */

const GOONG_BASE = 'https://rsapi.goong.io';
const TOMTOM_BASE = 'https://api.tomtom.com';
const TIMEOUT_MS = 8000;

// TTL khác nhau theo mức độ biến động của dữ liệu: gợi ý địa chỉ gần như tĩnh,
// toạ độ của một place_id thì bất biến, còn tuyến đường phụ thuộc giao thông.
const TTL = {
  autocomplete: 60 * 1000,
  placeDetail: 24 * 60 * 60 * 1000,
  reverse: 5 * 60 * 1000,
  route: 5 * 60 * 1000,
};

const requireKey = (value, name) => {
  if (!value) {
    throw ApiError.serviceUnavailable(`Dịch vụ bản đồ chưa được cấu hình (${name})`);
  }
  return value;
};

/**
 * Lỗi từ nhà cung cấp không được ném nguyên văn ra client — message của họ có thể
 * chứa cả URL kèm key. Chỉ giữ status để client biết nên thử lại hay không.
 */
const callProvider = async (url, params) => {
  try {
    const { data } = await axios.get(url, { params, timeout: TIMEOUT_MS });
    return data;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw ApiError.serviceUnavailable('Dịch vụ bản đồ phản hồi chậm, vui lòng thử lại');
    }
    const status = error.response?.status;
    if (status === 429) {
      throw ApiError.serviceUnavailable('Dịch vụ bản đồ đang quá tải, vui lòng thử lại sau');
    }
    throw ApiError.serviceUnavailable('Không gọi được dịch vụ bản đồ');
  }
};

/** Gợi ý địa chỉ quanh một toạ độ. */
const autocomplete = async ({ input, lat, lng, radius = 30, limit = 5 }) => {
  const key = `geo:ac:${input}:${lat}:${lng}:${radius}:${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await callProvider(`${GOONG_BASE}/Place/AutoComplete`, {
    api_key: requireKey(process.env.GOONG_API_KEY, 'GOONG_API_KEY'),
    input,
    ...(Number.isFinite(lat) && Number.isFinite(lng) ? { location: `${lat},${lng}` } : {}),
    radius,
    limit,
    more_compound: true,
  });

  // Chỉ trả đúng phần client cần. Giữ nguyên hình dạng `predictions` để frontend
  // hiện tại không phải sửa chỗ đọc dữ liệu.
  const result = { predictions: data?.predictions || [] };
  cache.set(key, result, TTL.autocomplete);
  return result;
};

/** Toạ độ và địa chỉ đầy đủ của một place_id. */
const placeDetail = async ({ placeId }) => {
  const key = `geo:pd:${placeId}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await callProvider(`${GOONG_BASE}/Place/Detail`, {
    api_key: requireKey(process.env.GOONG_API_KEY, 'GOONG_API_KEY'),
    place_id: placeId,
  });

  const location = data?.result?.geometry?.location;
  if (!location) {
    throw ApiError.notFound('Không tìm thấy địa điểm');
  }
  const result = {
    lat: location.lat,
    lng: location.lng,
    address: data.result.formatted_address || data.result.name || '',
  };
  cache.set(key, result, TTL.placeDetail);
  return result;
};

/** Địa chỉ từ toạ độ. */
const reverseGeocode = async ({ lat, lng }) => {
  const key = `geo:rev:${lat.toFixed(6)},${lng.toFixed(6)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await callProvider(`${GOONG_BASE}/Geocode`, {
    api_key: requireKey(process.env.GOONG_API_KEY, 'GOONG_API_KEY'),
    latlng: `${lat},${lng}`,
  });

  const result = {
    // Không có kết quả thì trả chính toạ độ — client luôn có gì đó để hiển thị
    // thay vì phải tự xử lý trường hợp rỗng.
    address: data?.results?.[0]?.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
  };
  cache.set(key, result, TTL.reverse);
  return result;
};

/** Chỉ đường giữa hai toạ độ, có tính giao thông thời gian thực. */
const route = async ({ fromLat, fromLng, toLat, toLng }) => {
  const key = `geo:rt:${fromLat},${fromLng}:${toLat},${toLng}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const path = `${fromLat},${fromLng}:${toLat},${toLng}`;
  const data = await callProvider(
    `${TOMTOM_BASE}/routing/1/calculateRoute/${encodeURIComponent(path)}/json`,
    {
      key: requireKey(process.env.TOMTOM_API_KEY, 'TOMTOM_API_KEY'),
      traffic: true,
      travelMode: 'car',
      language: 'vi-VN',
    }
  );

  const leg = data?.routes?.[0];
  if (!leg) throw ApiError.notFound('Không tìm được tuyến đường');

  const result = {
    distanceMeters: leg.summary?.lengthInMeters ?? null,
    durationSeconds: leg.summary?.travelTimeInSeconds ?? null,
    trafficDelaySeconds: leg.summary?.trafficDelayInSeconds ?? 0,
    points: (leg.legs || []).flatMap((l) => (l.points || []).map((p) => [p.latitude, p.longitude])),
  };
  cache.set(key, result, TTL.route);
  return result;
};

/**
 * URL tile giao thông TomTom.
 *
 * Trả URL cho server tự fetch chứ KHÔNG trả về client — trả URL kèm key ra client
 * thì vẫn lộ key, chỉ là lộ chậm hơn một nhịp.
 */
const trafficTileUrl = ({ z, x, y }) => {
  const key = requireKey(process.env.TOMTOM_API_KEY, 'TOMTOM_API_KEY');
  return `${TOMTOM_BASE}/traffic/map/4/tile/flow/relative0/${z}/${x}/${y}.png?key=${key}&tileSize=256`;
};

/** Tải tile về dưới dạng buffer để controller stream lại cho client. */
const fetchTrafficTile = async ({ z, x, y }) => {
  try {
    const res = await axios.get(trafficTileUrl({ z, x, y }), {
      responseType: 'arraybuffer',
      timeout: TIMEOUT_MS,
    });
    return { buffer: Buffer.from(res.data), contentType: res.headers['content-type'] || 'image/png' };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.serviceUnavailable('Không tải được lớp giao thông');
  }
};

module.exports = {
  autocomplete,
  placeDetail,
  reverseGeocode,
  route,
  fetchTrafficTile,
  trafficTileUrl,
  TTL,
};
