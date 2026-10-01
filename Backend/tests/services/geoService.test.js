jest.mock('axios');

const axios = require('axios');
const cache = require('../../src/utils/cache');
const geoService = require('../../src/services/geoService');

describe('geoService — proxy che API key (B3)', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    cache.clear();
    process.env = { ...OLD_ENV, GOONG_API_KEY: 'goong-secret', TOMTOM_API_KEY: 'tomtom-secret' };
  });

  afterAll(() => { process.env = OLD_ENV; });

  describe('autocomplete', () => {
    it('sends the key to the provider but never returns it to the caller', async () => {
      axios.get.mockResolvedValue({ data: { predictions: [{ description: 'Hải Châu' }] } });

      const result = await geoService.autocomplete({ input: 'Hai Chau', lat: 16, lng: 108 });

      expect(axios.get.mock.calls[0][1].params.api_key).toBe('goong-secret');
      expect(JSON.stringify(result)).not.toContain('goong-secret');
      expect(result.predictions).toHaveLength(1);
    });

    it('caches so a repeated query does not bill the provider twice', async () => {
      axios.get.mockResolvedValue({ data: { predictions: [] } });

      await geoService.autocomplete({ input: 'Hai Chau', lat: 16, lng: 108 });
      await geoService.autocomplete({ input: 'Hai Chau', lat: 16, lng: 108 });

      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('omits the location when coordinates are missing instead of sending NaN', async () => {
      axios.get.mockResolvedValue({ data: { predictions: [] } });

      await geoService.autocomplete({ input: 'Hai Chau', lat: NaN, lng: NaN });

      expect(axios.get.mock.calls[0][1].params.location).toBeUndefined();
    });
  });

  describe('reverseGeocode', () => {
    it('falls back to the raw coordinates when the provider finds nothing', async () => {
      axios.get.mockResolvedValue({ data: { results: [] } });

      const result = await geoService.reverseGeocode({ lat: 16.0544, lng: 108.2022 });

      expect(result.address).toBe('16.054400, 108.202200');
    });
  });

  describe('placeDetail', () => {
    it('returns coordinates for a known place', async () => {
      axios.get.mockResolvedValue({
        data: { result: { geometry: { location: { lat: 16, lng: 108 } }, formatted_address: 'Đà Nẵng' } },
      });

      await expect(geoService.placeDetail({ placeId: 'p1' }))
        .resolves.toEqual({ lat: 16, lng: 108, address: 'Đà Nẵng' });
    });

    it('raises 404 when the provider has no geometry', async () => {
      axios.get.mockResolvedValue({ data: { result: {} } });

      await expect(geoService.placeDetail({ placeId: 'p1' }))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('xu ly loi nha cung cap', () => {
    // Message lỗi của provider có thể chứa nguyên URL kèm key — không được ném
    // nguyên văn ra client.
    it('does not leak the provider error message (which can contain the key)', async () => {
      axios.get.mockRejectedValue(new Error('Request failed: https://rsapi.goong.io/...api_key=goong-secret'));

      await expect(geoService.reverseGeocode({ lat: 16, lng: 108 }))
        .rejects.toMatchObject({ message: expect.not.stringContaining('goong-secret') });
    });

    it('maps a provider rate limit to a retryable 503', async () => {
      axios.get.mockRejectedValue({ response: { status: 429 } });

      await expect(geoService.autocomplete({ input: 'x' }))
        .rejects.toMatchObject({ statusCode: 503 });
    });

    it('maps a timeout to a clear message', async () => {
      axios.get.mockRejectedValue({ code: 'ECONNABORTED' });

      await expect(geoService.autocomplete({ input: 'x' }))
        .rejects.toThrow(/chậm/);
    });

    it('fails loudly when the key is not configured at all', async () => {
      delete process.env.GOONG_API_KEY;

      await expect(geoService.autocomplete({ input: 'x' }))
        .rejects.toMatchObject({ statusCode: 503 });
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('trafficTile', () => {
    it('fetches the tile as a buffer so the key stays server-side', async () => {
      axios.get.mockResolvedValue({ data: Buffer.from('png'), headers: { 'content-type': 'image/png' } });

      const result = await geoService.fetchTrafficTile({ z: 12, x: 1, y: 2 });

      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.contentType).toBe('image/png');
      // URL gửi đi có key, nhưng nó chỉ nằm trong tiến trình server.
      expect(axios.get.mock.calls[0][0]).toContain('tomtom-secret');
    });
  });
});
