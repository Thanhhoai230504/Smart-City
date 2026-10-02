jest.mock('../../src/services/geoService');

const geoService = require('../../src/services/geoService');
const { trafficTile } = require('../../src/controllers/geoController');

/**
 * Tile giao thông được web nhúng bằng thẻ <img> của Leaflet, từ một ORIGIN KHÁC:
 * dev là localhost:3000 gọi localhost:5000, production là Vercel gọi Render.
 *
 * `helmet()` mặc định gắn `Cross-Origin-Resource-Policy: same-origin` cho mọi phản
 * hồi, nên trình duyệt chặn toàn bộ tile (net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin)
 * và lớp giao thông biến mất mà không báo lỗi gì trên giao diện. `curl` không áp
 * dụng chính sách này nên kiểm tra bằng curl vẫn thấy 200 — lỗi chỉ lộ ra trên
 * trình duyệt thật.
 */
const makeRes = () => {
  const headers = {};
  return {
    headers,
    set: jest.fn((k, v) => { headers[k.toLowerCase()] = v; }),
    send: jest.fn(),
  };
};

describe('geoController.trafficTile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lets a page on another origin embed the tile image', async () => {
    geoService.fetchTrafficTile.mockResolvedValue({ buffer: Buffer.from('png'), contentType: 'image/png' });
    const res = makeRes();
    await trafficTile({ params: { z: '13', x: '6558', y: '3725' } }, res, jest.fn());

    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('still sends the image with its type and browser cache header', async () => {
    const buffer = Buffer.from('png');
    geoService.fetchTrafficTile.mockResolvedValue({ buffer, contentType: 'image/png' });
    const res = makeRes();
    await trafficTile({ params: { z: '13', x: '1', y: '2' } }, res, jest.fn());

    expect(geoService.fetchTrafficTile).toHaveBeenCalledWith({ z: 13, x: 1, y: 2 });
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toBe('public, max-age=900');
    expect(res.send).toHaveBeenCalledWith(buffer);
  });

  it('passes provider errors on without sending a tile', async () => {
    const err = new Error('provider down');
    geoService.fetchTrafficTile.mockRejectedValue(err);
    const res = makeRes();
    const next = jest.fn();
    await trafficTile({ params: { z: '13', x: '1', y: '2' } }, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.send).not.toHaveBeenCalled();
  });
});
