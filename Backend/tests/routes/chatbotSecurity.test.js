const http = require('http');

jest.mock('../../src/services/chatbotService', () => ({
  chat: jest.fn().mockResolvedValue('reply giả lập'),
}));

const express = require('express');
const chatbotService = require('../../src/services/chatbotService');
const chatbotRouter = require('../../src/routes/chatbot');

const buildApp = () => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/chatbot', chatbotRouter);
  return app;
};

// Không có supertest trong dự án nên gọi thẳng qua http trên cổng tạm.
const postJson = (app, path, payload) => new Promise((resolve, reject) => {
  const server = app.listen(0, () => {
    const body = JSON.stringify(payload);
    const req = http.request({
      port: server.address().port,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
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

describe('POST /api/chatbot/message hardening', () => {
  beforeEach(() => jest.clearAllMocks());

  it('mounts a chatbot-specific rate limiter before the handler', () => {
    const route = chatbotRouter.stack.find((layer) => layer.route?.path === '/message');
    const names = route.route.stack.map((layer) => layer.handle.name);
    const validateIndex = names.indexOf('validate');

    expect(validateIndex).toBeGreaterThan(0);
    expect(names.at(-1)).toBe('sendMessage');
    // express-rate-limit exposes an anonymous middleware in the current version.
    expect(names.slice(0, validateIndex)).toContain('');
  });

  it('rejects a 5000-message history without calling Gemini', async () => {
    const history = Array.from({ length: 5000 }, () => ({ role: 'user', content: 'x'.repeat(1500) }));
    const res = await postJson(buildApp(), '/api/chatbot/message', { message: 'hi', history });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors[0].field).toBe('history');
    expect(chatbotService.chat).not.toHaveBeenCalled();
  });

  it('rejects an oversized single history entry', async () => {
    const history = [{ role: 'user', content: 'x'.repeat(2001) }];
    const res = await postJson(buildApp(), '/api/chatbot/message', { message: 'hi', history });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toContain('history');
    expect(chatbotService.chat).not.toHaveBeenCalled();
  });

  it('rejects an oversized message', async () => {
    const res = await postJson(buildApp(), '/api/chatbot/message', { message: 'x'.repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('message');
    expect(chatbotService.chat).not.toHaveBeenCalled();
  });

  it('rejects an empty message', async () => {
    const res = await postJson(buildApp(), '/api/chatbot/message', { message: '   ' });

    expect(res.status).toBe(400);
    expect(chatbotService.chat).not.toHaveBeenCalled();
  });

  it('still answers guests sending a normal conversation', async () => {
    const history = Array.from({ length: 10 }, () => ({ role: 'user', content: 'Xin chào' }));
    const res = await postJson(buildApp(), '/api/chatbot/message', { message: 'Cách báo cáo sự cố?', history });

    expect(res.status).toBe(200);
    expect(res.body.data.reply).toBe('reply giả lập');
    expect(chatbotService.chat).toHaveBeenCalledTimes(1);
  });
});
