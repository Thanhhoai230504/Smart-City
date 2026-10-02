const geoService = require('../services/geoService');

const autocomplete = async (req, res, next) => {
  try {
    const data = await geoService.autocomplete({
      input: req.query.input,
      lat: Number(req.query.lat),
      lng: Number(req.query.lng),
      radius: req.query.radius ? Number(req.query.radius) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const placeDetail = async (req, res, next) => {
  try {
    const data = await geoService.placeDetail({ placeId: req.query.place_id });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const reverseGeocode = async (req, res, next) => {
  try {
    const data = await geoService.reverseGeocode({
      lat: Number(req.query.lat),
      lng: Number(req.query.lng),
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const route = async (req, res, next) => {
  try {
    const data = await geoService.route({
      fromLat: Number(req.query.fromLat),
      fromLng: Number(req.query.fromLng),
      toLat: Number(req.query.toLat),
      toLng: Number(req.query.toLng),
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * Stream tile giao thông qua server.
 *
 * Phải proxy nhị phân chứ không trả URL: trả URL kèm key ra client thì key vẫn lộ.
 * `Cache-Control` dài để trình duyệt và map SDK không gọi lại mỗi khung hình —
 * không có header này, kéo bản đồ một lượt là hàng trăm request xuyên qua server.
 */
const trafficTile = async (req, res, next) => {
  try {
    const { buffer, contentType } = await geoService.fetchTrafficTile({
      z: Number(req.params.z),
      x: Number(req.params.x),
      y: Number(req.params.y),
    });
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=900');
    // Web nhúng tile bằng <img> từ một origin KHÁC (dev: :3000 -> :5000, production:
    // Vercel -> Render). helmet() mặc định gắn `same-origin`, khiến trình duyệt chặn
    // toàn bộ tile (ERR_BLOCKED_BY_RESPONSE.NotSameOrigin) và lớp giao thông biến mất
    // không báo lỗi. Chỉ nới cho route ảnh công khai này, không nới cho cả API.
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = { autocomplete, placeDetail, reverseGeocode, route, trafficTile };
