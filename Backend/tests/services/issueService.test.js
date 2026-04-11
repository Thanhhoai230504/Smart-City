jest.mock('../../src/models/Issue');
jest.mock('../../src/models/Notification');
jest.mock('../../src/models/User');
jest.mock('../../src/config/socket');
jest.mock('../../src/config/cloudinary');

const Issue = require('../../src/models/Issue');
const Notification = require('../../src/models/Notification');
const User = require('../../src/models/User');
const { getIO } = require('../../src/config/socket');
const issueService = require('../../src/services/issueService');

const mockIO = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

describe('IssueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getIO.mockReturnValue(mockIO);
  });

  describe('getIssues()', () => {
    it('should return paginated issues with default params', async () => {
      const mockIssues = [{ _id: '1', title: 'Issue 1' }];
      Issue.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockIssues),
              }),
            }),
          }),
        }),
      });
      Issue.countDocuments.mockResolvedValue(1);

      const result = await issueService.getIssues({ page: 1, limit: 10 });

      expect(result.issues).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should apply status and category filters', async () => {
      Issue.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });
      Issue.countDocuments.mockResolvedValue(0);

      await issueService.getIssues({ status: 'reported', category: 'pothole', page: 1, limit: 10 });

      expect(Issue.find).toHaveBeenCalledWith({ status: 'reported', category: 'pothole' });
    });
  });

  describe('getIssueById()', () => {
    it('should throw 404 if issue not found', async () => {
      Issue.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(issueService.getIssueById('nonexistent')).rejects.toThrow('Issue not found.');
    });

    it('should return issue if found', async () => {
      const mockIssue = { _id: '1', title: 'Test Issue' };
      Issue.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockIssue),
        }),
      });

      const result = await issueService.getIssueById('1');
      expect(result).toEqual(mockIssue);
    });
  });

  describe('createIssue()', () => {
    it('should create issue and notify admins', async () => {
      const mockIssue = {
        _id: 'issue1',
        title: 'Pothole',
        populate: jest.fn().mockResolvedValue(true),
      };
      Issue.create.mockResolvedValue(mockIssue);
      User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: 'admin1' }]) });
      Notification.create.mockResolvedValue({ _id: 'notif1' });

      const result = await issueService.createIssue({
        title: 'Pothole',
        description: 'Big hole on street',
        category: 'pothole',
        location: '123 Street',
        latitude: 16.05,
        longitude: 108.2,
        file: null,
        user: { id: 'user1', name: 'Citizen' },
      });

      expect(Issue.create).toHaveBeenCalled();
      expect(result._id).toBe('issue1');
    });
  });

  describe('updateIssueStatus()', () => {
    it('should throw for invalid status', async () => {
      await expect(
        issueService.updateIssueStatus('issue1', { status: 'invalid', adminUser: { id: 'admin1' } })
      ).rejects.toThrow('Status must be one of');
    });

    it('should throw if issue not found', async () => {
      Issue.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        issueService.updateIssueStatus('nonexistent', { status: 'processing', adminUser: { id: 'admin1' } })
      ).rejects.toThrow('Issue not found.');
    });

    it('should update status and notify reporter', async () => {
      const mockIssue = {
        _id: 'issue1',
        title: 'Pothole',
        userId: { _id: 'user1' },
      };
      Issue.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockIssue),
        }),
      });
      Notification.create.mockResolvedValue({ _id: 'notif1' });

      const result = await issueService.updateIssueStatus('issue1', {
        status: 'processing',
        note: 'Working on it',
        adminUser: { id: 'admin1' },
      });

      expect(result._id).toBe('issue1');
      expect(Notification.create).toHaveBeenCalled();
      expect(mockIO.to).toHaveBeenCalledWith('user_user1');
    });

    it('should set resolvedAt when status is resolved', async () => {
      const mockIssue = {
        _id: 'issue1',
        title: 'Fixed',
        userId: { _id: 'user1' },
      };
      Issue.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockIssue),
        }),
      });
      Notification.create.mockResolvedValue({ _id: 'notif1' });

      await issueService.updateIssueStatus('issue1', {
        status: 'resolved',
        adminUser: { id: 'admin1' },
      });

      const updateCall = Issue.findByIdAndUpdate.mock.calls[0][1];
      expect(updateCall.resolvedAt).toBeInstanceOf(Date);
    });
  });

  describe('deleteIssue()', () => {
    it('should throw if issue not found', async () => {
      Issue.findByIdAndDelete.mockResolvedValue(null);

      await expect(issueService.deleteIssue('nonexistent')).rejects.toThrow('Issue not found.');
    });

    it('should delete and return issue', async () => {
      const mockIssue = { _id: '1', title: 'Deleted' };
      Issue.findByIdAndDelete.mockResolvedValue(mockIssue);

      const result = await issueService.deleteIssue('1');
      expect(result).toEqual(mockIssue);
    });
  });

  describe('getMyIssues()', () => {
    it('should return user-specific issues', async () => {
      Issue.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([{ _id: '1' }]),
            }),
          }),
        }),
      });
      Issue.countDocuments.mockResolvedValue(1);

      const result = await issueService.getMyIssues({ userId: 'user1', page: 1, limit: 10 });

      expect(result.issues).toHaveLength(1);
      expect(Issue.find).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user1' }));
    });
  });

  describe('deleteMyIssue()', () => {
    it('should throw if issue not found', async () => {
      Issue.findById.mockResolvedValue(null);

      await expect(issueService.deleteMyIssue('nonexistent', 'user1')).rejects.toThrow('Issue not found.');
    });

    it('should throw if user is not the owner', async () => {
      Issue.findById.mockResolvedValue({
        _id: 'issue1',
        userId: { toString: () => 'otherUser' },
        status: 'reported',
      });

      await expect(issueService.deleteMyIssue('issue1', 'user1')).rejects.toThrow('You can only delete your own issues.');
    });

    it('should throw if status is not "reported"', async () => {
      Issue.findById.mockResolvedValue({
        _id: 'issue1',
        userId: { toString: () => 'user1' },
        status: 'processing',
      });

      await expect(issueService.deleteMyIssue('issue1', { toString: () => 'user1' }))
        .rejects.toThrow('Only issues with status "reported" can be deleted.');
    });

    it('should delete successfully if owner and status is reported', async () => {
      Issue.findById.mockResolvedValue({
        _id: 'issue1',
        userId: { toString: () => 'user1' },
        status: 'reported',
      });
      Issue.findByIdAndDelete.mockResolvedValue(true);

      await issueService.deleteMyIssue('issue1', { toString: () => 'user1' });

      expect(Issue.findByIdAndDelete).toHaveBeenCalledWith('issue1');
    });
  });

  describe('updateMyIssue()', () => {
    it('should throw if issue not found', async () => {
      Issue.findById.mockResolvedValue(null);

      await expect(issueService.updateMyIssue('nonexistent', 'user1', {})).rejects.toThrow('Issue not found.');
    });

    it('should throw if not the owner', async () => {
      Issue.findById.mockResolvedValue({
        userId: { toString: () => 'otherUser' },
        status: 'reported',
      });

      await expect(issueService.updateMyIssue('issue1', { toString: () => 'user1' }, { title: 'New' }))
        .rejects.toThrow('You can only edit your own issues.');
    });

    it('should throw if status is not reported', async () => {
      Issue.findById.mockResolvedValue({
        userId: { toString: () => 'user1' },
        status: 'processing',
      });

      await expect(issueService.updateMyIssue('issue1', { toString: () => 'user1' }, { title: 'New' }))
        .rejects.toThrow('Only issues with status "reported" can be edited.');
    });

    it('should update title and description', async () => {
      const mockIssue = {
        userId: { toString: () => 'user1' },
        status: 'reported',
        title: 'Old',
        description: 'Old desc',
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(true),
      };
      Issue.findById.mockResolvedValue(mockIssue);

      await issueService.updateMyIssue('issue1', { toString: () => 'user1' }, {
        title: ' New Title ',
        description: ' New Description ',
      });

      expect(mockIssue.title).toBe('New Title');
      expect(mockIssue.description).toBe('New Description');
      expect(mockIssue.save).toHaveBeenCalled();
    });
  });
});
