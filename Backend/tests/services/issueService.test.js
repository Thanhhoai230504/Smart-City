jest.mock('../../src/models/Issue');
jest.mock('../../src/models/Notification');
jest.mock('../../src/models/User');
jest.mock('../../src/config/socket');
jest.mock('../../src/config/cloudinary');

const Issue = require('../../src/models/Issue');
const Notification = require('../../src/models/Notification');
const User = require('../../src/models/User');
const { getIO } = require('../../src/config/socket');
const cloudinary = require('../../src/config/cloudinary');
const issueService = require('../../src/services/issueService');

const mockIO = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

// config/cloudinary được auto-mock nên uploader không tồn tại sẵn, phải tự dựng.
cloudinary.uploader = { destroy: jest.fn() };

/**
 * Mock một Mongoose Query: mọi method chain (populate/select/sort/skip/limit)
 * trả về chính nó, và await ra `result`. Nhờ vậy test không phải lồng đúng số
 * lần .populate() mà service đang gọi — thêm populate mới không làm vỡ test.
 */
const mockQuery = (result) => {
  const query = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ['populate', 'select', 'sort', 'skip', 'limit', 'lean']) {
    query[method] = jest.fn(() => query);
  }
  return query;
};

describe('IssueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getIO.mockReturnValue(mockIO);
    cloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });
  });

  describe('getIssues()', () => {
    it('should return paginated issues with default params', async () => {
      const mockIssues = [{ _id: '1', title: 'Issue 1' }];
      Issue.find.mockReturnValue(mockQuery(mockIssues));
      Issue.countDocuments.mockResolvedValue(1);

      const result = await issueService.getIssues({ page: 1, limit: 10 });

      expect(result.issues).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should apply status and category filters', async () => {
      Issue.find.mockReturnValue(mockQuery([]));
      Issue.countDocuments.mockResolvedValue(0);

      await issueService.getIssues({ status: 'reported', category: 'pothole', page: 1, limit: 10 });

      // isDeleted: false luôn có trong filter để loại sự cố đã xoá mềm
      expect(Issue.find).toHaveBeenCalledWith({
        isDeleted: false,
        mergedInto: null,
        status: 'reported',
        category: 'pothole',
      });
    });

    it('should filter by normalized district instead of $regex on location', async () => {
      Issue.find.mockReturnValue(mockQuery([]));
      Issue.countDocuments.mockResolvedValue(0);

      await issueService.getIssues({ district: 'hai chau', page: 1, limit: 10 });

      expect(Issue.find).toHaveBeenCalledWith({
        isDeleted: false,
        mergedInto: null,
        district: 'Hải Châu',
      });
    });

    it('should filter assigned issues on the backend before pagination', async () => {
      Issue.find.mockReturnValue(mockQuery([]));
      Issue.countDocuments.mockResolvedValue(0);

      await issueService.getIssues({ assigned: 'true', status: 'processing', page: 1, limit: 10 });

      expect(Issue.find).toHaveBeenCalledWith({
        isDeleted: false,
        mergedInto: null,
        status: 'processing',
        departmentId: { $ne: null },
      });
    });

    it('should force staff scope to their own department', async () => {
      Issue.find.mockReturnValue(mockQuery([]));
      Issue.countDocuments.mockResolvedValue(0);

      await issueService.getIssues({
        departmentId: 'deptB',
        requester: { role: 'staff', departmentId: 'deptA' },
      });

      expect(Issue.find).toHaveBeenCalledWith({
        isDeleted: false,
        mergedInto: null,
        departmentId: 'deptA',
      });
    });

    it('should return no work when a staff account has no department', async () => {
      Issue.find.mockReturnValue(mockQuery([]));
      Issue.countDocuments.mockResolvedValue(0);

      await issueService.getIssues({
        requester: { role: 'staff', departmentId: null },
      });

      expect(Issue.find).toHaveBeenCalledWith({
        isDeleted: false,
        mergedInto: null,
        departmentId: { $in: [] },
      });
    });

    it('should not return closed issues for an overdue SLA filter', async () => {
      Issue.find.mockReturnValue(mockQuery([]));
      Issue.countDocuments.mockResolvedValue(0);

      await issueService.getIssues({ status: 'resolved', slaStatus: 'overdue' });

      const filter = Issue.find.mock.calls[0][0];
      expect(filter.status).toEqual({ $in: [] });
      expect(filter.dueAt.$ne).toBeNull();
      expect(filter.dueAt.$lt).toBeInstanceOf(Date);
    });

    it('should use the text index for search instead of collection-scanning regex', async () => {
      Issue.find.mockReturnValue(mockQuery([]));
      Issue.countDocuments.mockResolvedValue(0);

      await issueService.getIssues({ search: 'ngập đường' });

      expect(Issue.find).toHaveBeenCalledWith(expect.objectContaining({
        $text: { $search: 'ngập đường' },
      }));
      expect(Issue.find.mock.calls[0][0].$or).toBeUndefined();
    });

    it('should return a compact viewport payload without running countDocuments', async () => {
      const query = mockQuery([{ _id: 'map-1', latitude: 16.05, longitude: 108.2 }]);
      Issue.find.mockReturnValue(query);

      const result = await issueService.getIssues({
        view: 'map',
        bounds: '108.0,15.9,108.4,16.3',
        limit: 9999,
      });

      const filter = Issue.find.mock.calls[0][0];
      expect(filter.status).toEqual({ $in: ['reported', 'processing'] });
      expect(filter.geo.$geoWithin.$geometry.type).toBe('Polygon');
      expect(query.select).toHaveBeenCalled();
      expect(query.limit).toHaveBeenCalledWith(500);
      expect(query.lean).toHaveBeenCalled();
      expect(Issue.countDocuments).not.toHaveBeenCalled();
      expect(result.pagination.limit).toBe(500);
    });
  });

  describe('getIssueById()', () => {
    it('should throw 404 if issue not found', async () => {
      Issue.findOne.mockReturnValue(mockQuery(null));

      await expect(issueService.getIssueById('nonexistent')).rejects.toThrow('Issue not found.');
    });

    it('should return issue if found and not soft-deleted', async () => {
      const mockIssue = { _id: '1', title: 'Test Issue' };
      Issue.findOne.mockReturnValue(mockQuery(mockIssue));

      const result = await issueService.getIssueById('1');
      expect(result).toEqual(mockIssue);
      expect(Issue.findOne).toHaveBeenCalledWith({ _id: '1', isDeleted: false });
    });

    it('should hide the reporter phone and user emails from an anonymous visitor', async () => {
      const query = mockQuery({ _id: '1' });
      Issue.findOne.mockReturnValue(query);

      await issueService.getIssueById('1');

      expect(query.select).toHaveBeenCalledWith('-phone');
      const populatedUserFields = query.populate.mock.calls
        .filter(([path]) => ['userId', 'adminId', 'assigneeId'].includes(path))
        .map(([, fields]) => fields);
      expect(populatedUserFields).toHaveLength(3);
      for (const fields of populatedUserFields) {
        expect(fields).toBe('name');
      }
    });

    it('should hide contact details from a logged-in citizen', async () => {
      const query = mockQuery({ _id: '1' });
      Issue.findOne.mockReturnValue(query);

      await issueService.getIssueById('1', { id: 'u1', role: 'user' });

      expect(query.select).toHaveBeenCalledWith('-phone');
      expect(query.populate).toHaveBeenCalledWith('userId', 'name');
    });

    it.each(['admin', 'staff'])('should expose contact details to %s', async (role) => {
      const query = mockQuery({ _id: '1' });
      Issue.findOne.mockReturnValue(query);

      await issueService.getIssueById('1', { id: 'x', role });

      expect(query.select).not.toHaveBeenCalledWith('-phone');
      expect(query.populate).toHaveBeenCalledWith('userId', 'name email');
    });

    it('should keep the public department contact for everyone', async () => {
      const query = mockQuery({ _id: '1' });
      Issue.findOne.mockReturnValue(query);

      await issueService.getIssueById('1');

      expect(query.populate).toHaveBeenCalledWith('departmentId', 'name code email phone');
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

    it('should store up to five uploaded images and keep the first as the legacy image', async () => {
      const mockIssue = {
        _id: 'issue-images',
        title: 'Flooding',
        populate: jest.fn().mockResolvedValue(true),
      };
      const files = [
        { path: 'https://cdn.test/one.jpg', filename: 'issues/one' },
        { path: 'https://cdn.test/two.jpg', filename: 'issues/two' },
      ];
      Issue.create.mockResolvedValue(mockIssue);
      User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });

      await issueService.createIssue({
        title: 'Flooding',
        description: 'Deep water',
        category: 'flooding',
        location: '123 Street',
        latitude: 16.05,
        longitude: 108.2,
        files,
        user: { id: 'user1', name: 'Citizen' },
      });

      expect(Issue.create).toHaveBeenCalledWith(expect.objectContaining({
        imageUrl: files[0].path,
        imagePublicId: files[0].filename,
        images: [
          { url: files[0].path, publicId: files[0].filename },
          { url: files[1].path, publicId: files[1].filename },
        ],
      }));
    });

    it('should roll back every uploaded image when MongoDB creation fails', async () => {
      const files = [
        { path: 'https://cdn.test/one.jpg', filename: 'issues/one' },
        { path: 'https://cdn.test/two.jpg', filename: 'issues/two' },
        { path: 'https://cdn.test/three.jpg', filename: 'issues/three' },
      ];
      Issue.create.mockRejectedValue(new Error('MongoDB unavailable'));
      cloudinary.uploader.destroy
        .mockRejectedValueOnce(new Error('Cloudinary temporary error'))
        .mockResolvedValue({ result: 'ok' });

      await expect(issueService.createIssue({
        title: 'Flooding',
        description: 'Deep water',
        category: 'flooding',
        location: '123 Street',
        latitude: 16.05,
        longitude: 108.2,
        files,
        user: { id: 'user1', name: 'Citizen' },
      })).rejects.toThrow('MongoDB unavailable');

      expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(3);
      expect(cloudinary.uploader.destroy).toHaveBeenNthCalledWith(1, 'issues/one');
      expect(cloudinary.uploader.destroy).toHaveBeenNthCalledWith(2, 'issues/two');
      expect(cloudinary.uploader.destroy).toHaveBeenNthCalledWith(3, 'issues/three');
    });
  });

  describe('updateIssueStatus()', () => {
    it('should throw for invalid status', async () => {
      await expect(
        issueService.updateIssueStatus('issue1', { status: 'invalid', adminUser: { id: 'admin1', role: 'admin' } })
      ).rejects.toThrow('Status must be one of');
    });

    it('should throw if issue not found', async () => {
      Issue.findOne.mockReturnValue(mockQuery(null));

      await expect(
        issueService.updateIssueStatus('nonexistent', { status: 'processing', adminUser: { id: 'admin1', role: 'admin' } })
      ).rejects.toThrow('Issue not found.');
    });

    it('should update status and notify reporter', async () => {
      const mockIssue = {
        _id: 'issue1',
        title: 'Pothole',
        userId: { _id: 'user1' },
      };
      Issue.findOne.mockReturnValue(mockQuery({ _id: 'issue1', status: 'reported', resolutionImages: [] }));
      Issue.findByIdAndUpdate.mockReturnValue(mockQuery(mockIssue));
      Notification.create.mockResolvedValue({ _id: 'notif1' });

      const result = await issueService.updateIssueStatus('issue1', {
        status: 'processing',
        note: 'Working on it',
        adminUser: { id: 'admin1', role: 'admin' },
      });

      expect(result._id).toBe('issue1');
      expect(Notification.create).toHaveBeenCalled();
      expect(mockIO.to).toHaveBeenCalledWith('user_user1');
    });

    // Ảnh minh chứng là căn cứ cho điểm đánh giá của người dân, nên không cho
    // báo "đã xử lý" bằng lời.
    it('should refuse to resolve without a resolution image', async () => {
      Issue.findOne.mockReturnValue(mockQuery({ _id: 'issue1', status: 'processing', resolutionImages: [] }));

      await expect(
        issueService.updateIssueStatus('issue1', {
          status: 'resolved',
          adminUser: { id: 'admin1', role: 'admin' },
        })
      ).rejects.toThrow('ảnh minh chứng');
    });

    it('should set resolvedAt when status is resolved', async () => {
      const mockIssue = {
        _id: 'issue1',
        title: 'Fixed',
        userId: { _id: 'user1' },
      };
      Issue.findOne.mockReturnValue(mockQuery({
        _id: 'issue1',
        status: 'processing',
        resolutionImages: [{ url: 'https://cloud/after.jpg' }],
      }));
      Issue.findByIdAndUpdate.mockReturnValue(mockQuery(mockIssue));
      Notification.create.mockResolvedValue({ _id: 'notif1' });

      await issueService.updateIssueStatus('issue1', {
        status: 'resolved',
        adminUser: { id: 'admin1', role: 'admin' },
      });

      const updateCall = Issue.findByIdAndUpdate.mock.calls[0][1];
      expect(updateCall.resolvedAt).toBeInstanceOf(Date);
    });

    // Cán bộ đơn vị A không được đổi trạng thái sự cố của đơn vị B.
    it('should refuse when staff handles an issue of another department', async () => {
      Issue.findOne.mockReturnValue(mockQuery({
        _id: 'issue1',
        status: 'processing',
        departmentId: 'deptB',
        resolutionImages: [],
      }));

      await expect(
        issueService.updateIssueStatus('issue1', {
          status: 'processing',
          adminUser: { id: 'staff1', role: 'staff', departmentId: 'deptA' },
        })
      ).rejects.toThrow('không thuộc đơn vị của bạn');
    });
  });

  describe('deleteIssue()', () => {
    it('should throw if issue not found', async () => {
      Issue.findOneAndUpdate.mockResolvedValue(null);

      await expect(issueService.deleteIssue('nonexistent')).rejects.toThrow('Issue not found.');
    });

    it('should soft delete instead of removing the document', async () => {
      const mockIssue = { _id: '1', title: 'Deleted', imagePublicId: null };
      Issue.findOneAndUpdate.mockResolvedValue(mockIssue);

      const result = await issueService.deleteIssue('1', { id: 'admin1' });

      expect(result).toEqual(mockIssue);
      expect(Issue.findByIdAndDelete).not.toHaveBeenCalled();

      const [filter, update] = Issue.findOneAndUpdate.mock.calls[0];
      expect(filter).toEqual({ _id: '1', isDeleted: false });
      expect(update.isDeleted).toBe(true);
      expect(update.deletedBy).toBe('admin1');
      expect(update.deletedAt).toBeInstanceOf(Date);
    });

    it('should delete the Cloudinary image when one exists', async () => {
      Issue.findOneAndUpdate.mockResolvedValue({ _id: '1', imagePublicId: 'smart-city/abc123' });

      await issueService.deleteIssue('1', { id: 'admin1' });

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('smart-city/abc123');
    });

    it('should still succeed when Cloudinary deletion fails', async () => {
      Issue.findOneAndUpdate.mockResolvedValue({ _id: '1', imagePublicId: 'smart-city/abc123' });
      cloudinary.uploader.destroy.mockRejectedValueOnce(new Error('Cloudinary down'));

      await expect(issueService.deleteIssue('1', { id: 'admin1' })).resolves.toBeDefined();
    });
  });

  describe('getMyIssues()', () => {
    it('should return user-specific issues', async () => {
      Issue.find.mockReturnValue(mockQuery([{ _id: '1' }]));
      Issue.countDocuments.mockResolvedValue(1);

      const result = await issueService.getMyIssues({ userId: 'user1', page: 1, limit: 10 });

      expect(result.issues).toHaveLength(1);
      expect(Issue.find).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user1' }));
    });
  });

  describe('getMyIssueSummary()', () => {
    it('should aggregate exact status totals without loading issue documents', async () => {
      Issue.aggregate.mockResolvedValue([{
        total: 120,
        reported: 20,
        processing: 30,
        resolved: 60,
        rejected: 10,
      }]);

      const result = await issueService.getMyIssueSummary('507f1f77bcf86cd799439011');

      expect(result.total).toBe(120);
      expect(result.resolved).toBe(60);
      expect(Issue.find).not.toHaveBeenCalled();
    });
  });

  describe('deleteMyIssue()', () => {
    it('should throw if issue not found', async () => {
      Issue.findOne.mockResolvedValue(null);

      await expect(issueService.deleteMyIssue('nonexistent', 'user1')).rejects.toThrow('Issue not found.');
    });

    it('should throw if user is not the owner', async () => {
      Issue.findOne.mockResolvedValue({
        _id: 'issue1',
        userId: { toString: () => 'otherUser' },
        status: 'reported',
      });

      await expect(issueService.deleteMyIssue('issue1', 'user1')).rejects.toThrow('You can only delete your own issues.');
    });

    it('should throw if status is not "reported"', async () => {
      Issue.findOne.mockResolvedValue({
        _id: 'issue1',
        userId: { toString: () => 'user1' },
        status: 'processing',
      });

      await expect(issueService.deleteMyIssue('issue1', { toString: () => 'user1' }))
        .rejects.toThrow('Only issues with status "reported" can be deleted.');
    });

    it('should soft delete and clean up the image if owner and status is reported', async () => {
      const mockIssue = {
        _id: 'issue1',
        userId: { toString: () => 'user1' },
        status: 'reported',
        imagePublicId: 'smart-city/xyz789',
        save: jest.fn().mockResolvedValue(true),
      };
      Issue.findOne.mockResolvedValue(mockIssue);

      await issueService.deleteMyIssue('issue1', { toString: () => 'user1' });

      expect(mockIssue.isDeleted).toBe(true);
      expect(mockIssue.imageUrl).toBeNull();
      expect(mockIssue.imagePublicId).toBeNull();
      expect(mockIssue.save).toHaveBeenCalled();
      expect(Issue.findByIdAndDelete).not.toHaveBeenCalled();
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('smart-city/xyz789');
    });
  });

  describe('updateMyIssue()', () => {
    it('should throw if issue not found', async () => {
      Issue.findOne.mockResolvedValue(null);

      await expect(issueService.updateMyIssue('nonexistent', 'user1', {})).rejects.toThrow('Issue not found.');
    });

    it('should throw if not the owner', async () => {
      Issue.findOne.mockResolvedValue({
        userId: { toString: () => 'otherUser' },
        status: 'reported',
      });

      await expect(issueService.updateMyIssue('issue1', { toString: () => 'user1' }, { title: 'New' }))
        .rejects.toThrow('You can only edit your own issues.');
    });

    it('should throw if status is not reported', async () => {
      Issue.findOne.mockResolvedValue({
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
      Issue.findOne.mockResolvedValue(mockIssue);

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
