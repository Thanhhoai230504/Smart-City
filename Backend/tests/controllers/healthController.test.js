const mongoose = require('mongoose');
const { buildHealthPayload, getHealth } = require('../../src/controllers/healthController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

/** Ép readyState thật trên mongoose.connection để test đúng đường chạy của handler. */
const withReadyState = (value, fn) => {
  const original = mongoose.connection.readyState;
  Object.defineProperty(mongoose.connection, 'readyState', { value, configurable: true });
  try { fn(); } finally {
    Object.defineProperty(mongoose.connection, 'readyState', { value: original, configurable: true });
  }
};

// Trước đây GET / trả 200 cứng và không đọc mongoose.connection.readyState, nên
// monitor luôn báo xanh kể cả khi DB đã đứt — trạng thái "nửa sống" không phát hiện được.
describe('healthController', () => {
  it.each([
    [0, 'disconnected', false, 503],
    [1, 'connected', true, 200],
    [2, 'connecting', false, 503],
    [3, 'disconnecting', false, 503],
  ])('reports readyState %i as %s with HTTP %i', (state, label, success, expectedStatus) => {
    expect(buildHealthPayload(state, 42)).toMatchObject({
      db: label,
      success,
      status: success ? 'ok' : 'degraded',
    });

    withReadyState(state, () => {
      const res = mockRes();
      getHealth({}, res);
      expect(res.status).toHaveBeenCalledWith(expectedStatus);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ db: label, success }));
    });
  });

  it('returns an unknown label for an unexpected readyState instead of crashing', () => {
    expect(buildHealthPayload(99, 1).db).toBe('unknown');
  });

  it('exposes uptime and version so a monitor can spot a restart loop', () => {
    const payload = buildHealthPayload(1, 7);
    expect(payload.uptimeSeconds).toBe(7);
    expect(typeof payload.version).toBe('string');
  });

  it('reads the live mongoose state when no override is applied', () => {
    const res = mockRes();
    getHealth({}, res);
    // Môi trường test không mở kết nối thật nên readyState là 0.
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ db: 'disconnected' }));
  });
});
