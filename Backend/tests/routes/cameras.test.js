const http = require('http');
const express = require('express');
const cameraRouter = require('../../src/routes/cameras');
const errorHandler = require('../../src/middleware/errorHandler');
const { PUBLIC_CAMERAS } = require('../../src/utils/publicCameras');

const buildApp = () => {
  const app = express();
  app.use('/api/cameras', cameraRouter);
  app.use(errorHandler);
  return app;
};

// Không có supertest trong dự án nên gọi thẳng qua http trên cổng tạm.
const getJson = (app, path) =>
  new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const req = http.request(
        { port: server.address().port, path, method: 'GET' },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => {
            raw += chunk;
          });
          res.on('end', () => {
            server.close(() =>
              resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null })
            );
          });
        }
      );
      req.on('error', (error) => server.close(() => reject(error)));
      req.end();
    });
  });

describe('GET /api/cameras', () => {
  it('trả về toàn bộ camera công cộng, không cần đăng nhập', async () => {
    const { status, body } = await getJson(buildApp(), '/api/cameras');

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(PUBLIC_CAMERAS.length);
    expect(body.data.cameras).toHaveLength(PUBLIC_CAMERAS.length);
  });

  it('gắn sẵn embedUrl và thumbnailUrl, không lộ youtubeId thô', async () => {
    const { body } = await getJson(buildApp(), '/api/cameras');
    const camera = body.data.cameras[0];

    expect(camera.embedUrl).toBe(
      'https://www.youtube.com/embed/oC8ttZHG50I?autoplay=1&mute=1&rel=0'
    );
    expect(camera.thumbnailUrl).toBe('https://i.ytimg.com/vi/oC8ttZHG50I/hqdefault.jpg');
    expect(camera.youtubeId).toBeUndefined();
  });
});

describe('GET /api/cameras/nearby', () => {
  it('yêu cầu lat và lng', async () => {
    const { status, body } = await getJson(buildApp(), '/api/cameras/nearby');

    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('từ chối lat/lng không phải số', async () => {
    const { status } = await getJson(buildApp(), '/api/cameras/nearby?lat=abc&lng=108.2');

    expect(status).toBe(400);
  });

  it('trả camera gần Cầu Rồng, sắp xếp gần → xa kèm khoảng cách', async () => {
    const { status, body } = await getJson(
      buildApp(),
      '/api/cameras/nearby?lat=16.0612&lng=108.2275&radius=20000'
    );

    expect(status).toBe(200);
    expect(body.data.cameras[0].id).toBe('cau-rong-tay');
    expect(body.data.cameras[0].distance).toBe(0);

    const distances = body.data.cameras.map((c) => c.distance);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
  });

  it('loại camera ngoài bán kính', async () => {
    const { body } = await getJson(
      buildApp(),
      '/api/cameras/nearby?lat=16.0612&lng=108.2275&radius=100'
    );

    expect(body.data.cameras.every((c) => c.distance <= 100)).toBe(true);
    expect(body.data.cameras.map((c) => c.id)).not.toContain('cau-tran-thi-ly');
  });

  it('bỏ qua camera chưa xác minh toạ độ', async () => {
    const { body } = await getJson(
      buildApp(),
      '/api/cameras/nearby?lat=16.0544&lng=108.2022&radius=100000'
    );

    const withoutCoords = PUBLIC_CAMERAS.filter((c) => c.coords === null).map((c) => c.id);
    body.data.cameras.forEach((camera) => {
      expect(withoutCoords).not.toContain(camera.id);
    });
  });
});

describe('thứ tự khai báo route', () => {
  it('khai báo /nearby trước / để không bị route gốc chiếm', () => {
    const paths = cameraRouter.stack.filter((l) => l.route).map((l) => l.route.path);

    expect(paths.indexOf('/nearby')).toBeLessThan(paths.indexOf('/'));
  });
});
