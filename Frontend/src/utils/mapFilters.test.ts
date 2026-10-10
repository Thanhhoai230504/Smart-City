import { describe, it, expect } from 'vitest';
import { describeRoute, distanceKm, filterMapIssues, filterMapPlaces } from './mapFilters';
import type { MapIssue, Place } from '../types';

const NOW = new Date('2026-10-09T08:00:00.000Z').getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const issue = (over: Partial<MapIssue>): MapIssue => ({
  _id: 'x', title: 'Ổ gà trên đường Lê Duẩn', category: 'pothole', status: 'reported',
  location: '120 Lê Duẩn, Hải Châu', latitude: 16.0544, longitude: 108.2022,
  imageUrl: null, voteCount: 0, createdAt: hoursAgo(1), ...over,
});

const place = (over: Partial<Place>): Place => ({
  _id: 'p', name: 'Bệnh viện Đà Nẵng', type: 'hospital', address: '124 Hải Phòng',
  latitude: 16.0544, longitude: 108.2022, description: '', phone: '', isActive: true, ...over,
});

const ALL = { search: '', radiusKm: 0, time: 'all' } as const;

describe('filterMapIssues', () => {
  it('keeps only open issues — the map never shows closed work', () => {
    const list = ['reported', 'processing', 'resolved', 'rejected'].map((status) => issue({ _id: status, status: status as MapIssue['status'] }));
    expect(filterMapIssues(list, ALL, NOW).map((i) => i._id)).toEqual(['reported', 'processing']);
  });

  it('searches title and address, ignoring case', () => {
    const list = [issue({ _id: 'a' }), issue({ _id: 'b', title: 'Đèn đường hỏng', location: '5 Bạch Đằng' })];
    expect(filterMapIssues(list, { ...ALL, search: 'LÊ DUẨN' }, NOW).map((i) => i._id)).toEqual(['a']);
    expect(filterMapIssues(list, { ...ALL, search: 'bạch đằng' }, NOW).map((i) => i._id)).toEqual(['b']);
  });

  it('drops issues outside the radius around the city centre', () => {
    // 0,1° vĩ độ ≈ 11 km về phía bắc
    const list = [issue({ _id: 'near' }), issue({ _id: 'far', latitude: 16.1544 })];
    expect(filterMapIssues(list, { ...ALL, radiusKm: 5 }, NOW).map((i) => i._id)).toEqual(['near']);
    expect(filterMapIssues(list, { ...ALL, radiusKm: 12 }, NOW)).toHaveLength(2);
  });

  it('applies the report-time window', () => {
    const list = [issue({ _id: 'today', createdAt: hoursAgo(3) }), issue({ _id: 'old', createdAt: hoursAgo(24 * 10) })];
    expect(filterMapIssues(list, { ...ALL, time: '24h' }, NOW).map((i) => i._id)).toEqual(['today']);
    expect(filterMapIssues(list, { ...ALL, time: '30d' }, NOW)).toHaveLength(2);
  });
});

describe('filterMapPlaces', () => {
  const list = [place({ _id: 'h' }), place({ _id: 's', type: 'school', name: 'Trường THPT Phan Châu Trinh', address: '154 Lê Lợi' })];

  it('treats an empty type list as every type', () => {
    expect(filterMapPlaces(list, [], ALL)).toHaveLength(2);
    expect(filterMapPlaces(list, ['school'], ALL).map((p) => p._id)).toEqual(['s']);
  });

  it('shares the search box with issues', () => {
    expect(filterMapPlaces(list, [], { search: 'lê lợi', radiusKm: 0 }).map((p) => p._id)).toEqual(['s']);
  });
});

describe('describeRoute', () => {
  it('writes distance in metres below 1 km and with a decimal comma above', () => {
    expect(describeRoute({ distanceMeters: 850, durationSeconds: 240, trafficDelaySeconds: 0 }).distance).toBe('850 m');
    expect(describeRoute({ distanceMeters: 5240, durationSeconds: 240, trafficDelaySeconds: 0 }).distance).toBe('5,2 km');
  });

  it.each([
    [20, '1 phút'],
    [840, '14 phút'],
    [3600, '1 giờ'],
    [3900, '1 giờ 5 phút'],
  ])('describes %p seconds as "%s"', (seconds, text) => {
    expect(describeRoute({ distanceMeters: 1000, durationSeconds: seconds, trafficDelaySeconds: 0 }).duration).toBe(text);
  });

  it('only reports traffic delay of a minute or more', () => {
    expect(describeRoute({ distanceMeters: 1000, durationSeconds: 600, trafficDelaySeconds: 45 }).delay).toBeNull();
    expect(describeRoute({ distanceMeters: 1000, durationSeconds: 600, trafficDelaySeconds: 360 }).delay).toBe('Kẹt xe thêm 6 phút');
  });

  it('shows a dash when the provider gave no duration', () => {
    expect(describeRoute({ distanceMeters: null, durationSeconds: null, trafficDelaySeconds: 0 })).toEqual({ distance: '0 m', duration: '—', delay: null });
  });
});

describe('distanceKm', () => {
  it('is zero for the same point and about 11.1 km per 0.1° of latitude', () => {
    expect(distanceKm(16.0544, 108.2022, 16.0544, 108.2022)).toBe(0);
    expect(distanceKm(16.0544, 108.2022, 16.1544, 108.2022)).toBeCloseTo(11.12, 1);
  });
});
