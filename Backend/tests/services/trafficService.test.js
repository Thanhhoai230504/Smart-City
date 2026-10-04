jest.mock('axios');

const axios = require('axios');
const cache = require('../../src/utils/cache');
const {
  getTrafficStats, calculateStats, levelOf, DA_NANG_ROADS, LIVE_CONFIDENCE,
} = require('../../src/services/trafficService');

/** Một đoạn đã xử lý như fetchRoadSpeed trả về. */
const seg = (name, cur, free, extra = {}) => ({
  name,
  lat: 16.06,
  lon: 108.22,
  currentSpeed: cur,
  freeFlowSpeed: free,
  // cùng chiều dài 1 km → thời gian (giây) = 3600 / tốc độ
  currentTravelTime: Math.round(3600 / Math.max(cur, 1)),
  freeFlowTravelTime: Math.round(3600 / free),
  confidence: 0.95,
  live: true,
  closed: false,
  ratio: cur / free,
  level: levelOf(cur / free),
  segmentKey: name,
  ...extra,
});

describe('trafficService', () => {
  describe('danh sách điểm đo', () => {
    it('tên không trùng, toạ độ không trùng, đều trong Đà Nẵng', () => {
      const names = DA_NANG_ROADS.map((r) => r.name);
      expect(new Set(names).size).toBe(names.length);
      const coords = DA_NANG_ROADS.map((r) => `${r.lat},${r.lon}`);
      expect(new Set(coords).size).toBe(coords.length);
      for (const r of DA_NANG_ROADS) {
        expect(r.lat).toBeGreaterThan(15.9);
        expect(r.lat).toBeLessThan(16.2);
        expect(r.lon).toBeGreaterThan(108.1);
        expect(r.lon).toBeLessThan(108.35);
      }
    });

    it('ngưỡng trạng thái theo tỷ lệ tốc độ hiện tại / thông thoáng', () => {
      expect(levelOf(0.9)).toBe('normal');
      expect(levelOf(0.6)).toBe('slow');
      expect(levelOf(0.4)).toBe('congested');
      expect(levelOf(0.2)).toBe('heavy');
    });
  });

  describe('calculateStats()', () => {
    it('chỉ số tắc nghẽn = thời gian đi lại tăng bao nhiêu % so với lúc thông thoáng', () => {
      // 30 km/h trên đường thông thoáng 60 km/h → thời gian gấp đôi → +100%.
      const stats = calculateStats([seg('A', 30, 60), seg('B', 60, 60)]);
      // Tổng: (120 + 60) / (60 + 60) − 1 = 50%
      expect(stats.congestionIndex).toBe(50);
      expect(stats.averageSpeed).toBe(45);
      expect(stats.source).toBe('tomtom');
    });

    it('nhiều tuyến cùng rơi vào một đoạn TomTom thì thống kê tính một lần', () => {
      const stats = calculateStats([
        seg('Đường Võ Nguyên Giáp', 20, 50, { segmentKey: 'coastal' }),
        seg('Đường Trường Sa', 20, 50, { segmentKey: 'coastal' }),
        seg('Đường Lê Duẩn', 40, 40),
      ]);
      expect(stats.summary.congested + stats.summary.normal).toBe(2);
      expect(stats.measuredSegments).toBe(2);
      expect(stats.averageSpeed).toBe(30);
      // Danh sách chi tiết vẫn đủ từng tuyến, ghi rõ tuyến nào chung đoạn đo
      expect(stats.roads.map((r) => r.name)).toEqual(['Đường Võ Nguyên Giáp', 'Đường Trường Sa', 'Đường Lê Duẩn']);
      expect(stats.roads[0].sharedWith).toEqual(['Đường Trường Sa']);
      expect(stats.roads[1].sharedWith).toEqual(['Đường Võ Nguyên Giáp']);
      expect(stats.roads[2].sharedWith).toEqual([]);
    });

    it('đoạn không có dữ liệu thời gian thực: hiện trong danh sách nhưng không vào số liệu tổng hợp', () => {
      const stats = calculateStats([
        seg('Có xe chạy', 20, 40),
        seg('Ước tính', 40, 40, { confidence: 0.3, live: false }),
      ]);
      expect(stats.measuredSegments).toBe(1);
      expect(stats.estimatedRoads).toBe(1);
      expect(stats.averageSpeed).toBe(20);
      expect(stats.summary.normal).toBe(0);
      expect(stats.roads.find((r) => r.name === 'Ước tính')).toMatchObject({ live: false, confidence: 0.3 });
      expect(stats.bestRoads.map((r) => r.name)).not.toContain('Ước tính');
    });

    it('đường bị đóng đứng đầu danh sách cần chú ý, không tính vào tốc độ trung bình', () => {
      const stats = calculateStats([
        seg('Thông thoáng', 40, 40),
        seg('Đóng đường', 0, 40, { closed: true, ratio: 0, level: 'closed' }),
      ]);
      expect(stats.worstRoads[0]).toMatchObject({ name: 'Đóng đường', level: 'closed' });
      expect(stats.summary.closed).toBe(1);
      expect(stats.averageSpeed).toBe(40);
    });
  });

  describe('getTrafficStats()', () => {
    const OLD_KEY = process.env.TOMTOM_API_KEY;

    beforeEach(() => {
      jest.clearAllMocks();
      cache.clear();
    });
    afterAll(() => {
      process.env.TOMTOM_API_KEY = OLD_KEY;
    });

    it('không có khoá TomTom → dữ liệu mẫu, ghi rõ nguồn là mock', async () => {
      delete process.env.TOMTOM_API_KEY;
      const stats = await getTrafficStats();
      expect(stats.source).toBe('mock');
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('tên tuyến lấy từ danh sách điểm đo, không tra địa chỉ ngược; gọi TomTom ở zoom 18', async () => {
      process.env.TOMTOM_API_KEY = 'test-key';
      axios.get.mockImplementation(async (url, { params }) => {
        const [lat, lon] = params.point.split(',').map(Number);
        return {
          data: {
            flowSegmentData: {
              frc: 'FRC3',
              currentSpeed: 30,
              freeFlowSpeed: 40,
              currentTravelTime: 120,
              freeFlowTravelTime: 90,
              confidence: 0.9,
              roadClosure: false,
              coordinates: { coordinate: [{ latitude: lat, longitude: lon }, { latitude: lat + 0.001, longitude: lon }] },
            },
          },
        };
      });

      const stats = await getTrafficStats();

      expect(axios.get).toHaveBeenCalledTimes(DA_NANG_ROADS.length);
      for (const [url] of axios.get.mock.calls) {
        expect(url).toContain('api.tomtom.com');
        expect(url).toContain('/18/json');
      }
      expect(stats.roads.map((r) => r.name)).toEqual(DA_NANG_ROADS.map((r) => r.name));
      expect(stats.measuredSegments).toBe(DA_NANG_ROADS.length);
      expect(stats.congestionIndex).toBe(33);
      expect(LIVE_CONFIDENCE).toBe(0.6);
    });
  });
});
