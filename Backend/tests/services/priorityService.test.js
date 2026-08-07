const { calculatePriorityScore } = require('../../src/services/priorityService');
const { getPriorityLevel } = require('../../src/utils/priorityConfig');

const NOW = new Date('2026-08-01T12:00:00.000Z');

const makeIssue = (overrides = {}) => ({
  category: 'other',
  status: 'reported',
  voteCount: 0,
  createdAt: new Date('2026-08-01T12:00:00.000Z'),
  assignedAt: null,
  dueAt: null,
  ...overrides,
});

describe('PriorityService.calculatePriorityScore', () => {
  it('returns 100 and critical when every factor reaches its cap', () => {
    const result = calculatePriorityScore({
      issue: makeIssue({
        category: 'flooding',
        voteCount: 50,
        createdAt: new Date('2026-07-31T00:00:00.000Z'),
        dueAt: new Date('2026-08-01T11:00:00.000Z'),
      }),
      nearbyCount: 10,
      nearestSensitivePlace: {
        _id: 'hospital-1',
        type: 'hospital',
        name: 'Hospital A',
        distanceMeters: 80,
      },
      now: NOW,
    });

    expect(result.priorityScore).toBe(100);
    expect(result.priorityLevel).toBe('critical');
    expect(result.priorityFactors).toHaveLength(5);
    expect(result.priorityFactors.reduce((sum, factor) => sum + factor.points, 0)).toBe(100);
  });

  it('keeps a newly reported low-impact issue in the low band', () => {
    const result = calculatePriorityScore({ issue: makeIssue(), now: NOW });

    expect(result.priorityScore).toBe(15);
    expect(result.priorityLevel).toBe('low');
    expect(result.priorityFactors.find((factor) => factor.code === 'severity')).toMatchObject({
      normalizedScore: 50,
      weight: 0.3,
      points: 15,
    });
  });

  it('uses logarithmic vote normalization and caps extreme vote counts', () => {
    const atCap = calculatePriorityScore({
      issue: makeIssue({ voteCount: 50 }),
      now: NOW,
    });
    const aboveCap = calculatePriorityScore({
      issue: makeIssue({ voteCount: 5000 }),
      now: NOW,
    });

    const atCapVote = atCap.priorityFactors.find((factor) => factor.code === 'votes');
    const aboveCapVote = aboveCap.priorityFactors.find((factor) => factor.code === 'votes');
    expect(atCapVote.points).toBe(15);
    expect(aboveCapVote.points).toBe(15);
  });

  it('scores sensitive places by transparent distance bands', () => {
    const distances = [80, 250, 450, null];
    const expected = [100, 75, 40, 0];

    distances.forEach((distance, index) => {
      const result = calculatePriorityScore({
        issue: makeIssue(),
        nearestSensitivePlace: distance == null
          ? null
          : { type: 'school', distanceMeters: distance },
        now: NOW,
      });
      const factor = result.priorityFactors.find((item) => item.code === 'sensitive_place');
      expect(factor.normalizedScore).toBe(expected[index]);
    });
  });

  it('is deterministic for the same issue context and timestamp', () => {
    const input = {
      issue: makeIssue({
        category: 'pothole',
        voteCount: 7,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      }),
      nearbyCount: 3,
      nearestSensitivePlace: { type: 'school', distanceMeters: 320 },
      now: NOW,
    };

    expect(calculatePriorityScore(input)).toEqual(calculatePriorityScore(input));
  });
});

describe('priority thresholds', () => {
  it.each([
    [0, 'low'],
    [34.9, 'low'],
    [35, 'medium'],
    [59.9, 'medium'],
    [60, 'high'],
    [79.9, 'high'],
    [80, 'critical'],
    [100, 'critical'],
  ])('maps score %s to %s', (score, expected) => {
    expect(getPriorityLevel(score)).toBe(expected);
  });
});
