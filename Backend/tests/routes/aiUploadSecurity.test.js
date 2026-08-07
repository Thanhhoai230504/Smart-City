const http = require('http');

jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
}));

jest.mock('../../src/services/aiService', () => ({
  classifyIssueImage: jest.fn().mockResolvedValue({ category: 'pothole', confidence: 0.9, description: 'ổ gà' }),
}));

const express = require('express');
const { classifyIssueImage } = require('../../src/services/aiService');
const errorHandler = require('../../src/middleware/errorHandler');
const aiRouter = require('../../src/routes/ai');

const BOUNDARY = '----jestboundary1234';

const multipartBody = (filename, contentType, content) => Buffer.concat([
  Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\n`),
  Buffer.from(`Content-Type: ${contentType}\r\n\r\n`),
  Buffer.isBuffer(content) ? content : Buffer.from(content),
  Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
]);

const buildApp = () => {
  const app = express();
  app.use('/api/ai', aiRouter);
  app.use(errorHandler);
  return app;
};

// Không có supertest trong dự án nên gửi multipart thủ công qua http.
const postFile = (body) => new Promise((resolve, reject) => {
  const server = buildApp().listen(0, () => {
    const req = http.request({
      port: server.address().port,
      path: '/api/ai/classify-image',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        server.close(() => resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null }));
      });
    });
    req.on('error', (error) => server.close(() => reject(error)));
    req.end(body);
  });
});

const jpegBuffer = () => Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(64, 0x11),
]);

describe('POST /api/ai/classify-image upload hardening', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a non-image file by mimetype', async () => {
    const res = await postFile(multipartBody('payload.sh', 'application/x-sh', '#!/bin/sh\nrm -rf /\n'));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Only image files are allowed!');
    expect(classifyIssueImage).not.toHaveBeenCalled();
  });

  it('rejects a non-image payload that lies about its mimetype', async () => {
    const res = await postFile(multipartBody('fake.jpg', 'image/jpeg', '#!/bin/sh\necho not-an-image\n'));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Tệp tải lên không phải ảnh hợp lệ');
    expect(classifyIssueImage).not.toHaveBeenCalled();
  });

  it('rejects a file above the 5MB limit', async () => {
    const oversized = Buffer.concat([jpegBuffer(), Buffer.alloc(5 * 1024 * 1024, 0x22)]);
    const res = await postFile(multipartBody('big.jpg', 'image/jpeg', oversized));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LIMIT_FILE_SIZE');
    expect(classifyIssueImage).not.toHaveBeenCalled();
  });

  it('accepts a real JPEG', async () => {
    const res = await postFile(multipartBody('good.jpg', 'image/jpeg', jpegBuffer()));

    expect(res.status).toBe(200);
    expect(res.body.data.category).toBe('pothole');
    expect(classifyIssueImage).toHaveBeenCalledTimes(1);
  });

  it('accepts a real PNG', async () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 0x33),
    ]);
    const res = await postFile(multipartBody('good.png', 'image/png', png));

    expect(res.status).toBe(200);
    expect(classifyIssueImage).toHaveBeenCalledTimes(1);
  });
});
