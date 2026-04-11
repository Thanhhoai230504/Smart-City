jest.mock('../../src/models/Issue');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Place');

const Issue = require('../../src/models/Issue');
const User = require('../../src/models/User');
const Place = require('../../src/models/Place');
const dashboardService = require('../../src/services/dashboardService');

describe('DashboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getStats()', () => {
    it('should return dashboard statistics', async () => {
      Issue.countDocuments
        .mockResolvedValueOnce(100) // totalIssues
        .mockResolvedValueOnce(5)   // issuesToday
        .mockResolvedValueOnce(20)  // issuesThisWeek
        .mockResolvedValueOnce(50); // issuesThisMonth

      Issue.aggregate
        .mockResolvedValueOnce([      // issuesByStatus
          { _id: 'reported', count: 30 },
          { _id: 'processing', count: 20 },
          { _id: 'resolved', count: 40 },
          { _id: 'rejected', count: 10 },
        ])
        .mockResolvedValueOnce([      // issuesByCategory
          { _id: 'pothole', count: 25 },
          { _id: 'garbage', count: 15 },
        ])
        .mockResolvedValueOnce([      // issuesTrend
          { _id: '2026-04-01', count: 3 },
          { _id: '2026-04-02', count: 5 },
        ]);

      User.countDocuments.mockResolvedValue(500);
      Place.countDocuments.mockResolvedValue(30);
      Issue.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue([
                { _id: '1', title: 'Recent 1' },
              ]),
            }),
          }),
        }),
      });

      const result = await dashboardService.getStats();

      expect(result.overview.totalIssues).toBe(100);
      expect(result.overview.issuesToday).toBe(5);
      expect(result.overview.issuesThisWeek).toBe(20);
      expect(result.overview.issuesThisMonth).toBe(50);
      expect(result.overview.totalUsers).toBe(500);
      expect(result.overview.totalPlaces).toBe(30);

      expect(result.issuesByStatus).toEqual({
        reported: 30,
        processing: 20,
        resolved: 40,
        rejected: 10,
      });

      expect(result.issuesByCategory).toEqual([
        { category: 'pothole', label: 'Ổ gà', count: 25 },
        { category: 'garbage', label: 'Rác thải', count: 15 },
      ]);

      expect(result.issuesTrend).toEqual([
        { date: '2026-04-01', count: 3 },
        { date: '2026-04-02', count: 5 },
      ]);

      expect(result.recentIssues).toHaveLength(1);
    });
  });
});
