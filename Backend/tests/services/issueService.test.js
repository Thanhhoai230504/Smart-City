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

      await expect(issueService.getIssueById('nonexistent')).rejects.toThrow('Không tìm thấy sự cố.');
    });

    it('should return issue if found and not soft-deleted', async () => {
      const mockIssue = { _id: '1', title: 'Test Issue' };
      Issue.findOne.mockReturnValue(mockQuery(mockIssue));

      const result = await issueService.getIssueById('1');
      expect(result).toMatchObject(mockIssue);
      expect(Issue.findOne).toHaveBeenCalledWith({ _id: '1', isDeleted: false });
    });

    // Route chi tiết là công khai: không ai được gom danh sách người ủng hộ /
    // theo dõi của người khác, hay đọc metadata vận hành của embedding.
    describe('public detail payload', () => {
      const stored = () => ({
        _id: '1',
        title: 'Ổ gà',
        votes: ['u1', 'u2', 'u3'],
        followers: ['u2', 'reporter'],
        embedding: { model: 'gemini-embedding-001', sourceHash: 'abc', lastError: 'quota' },
        lastReminderAt: new Date(),
        intakeReminderAt: null,
        isDeleted: false,
        deletedBy: null,
      });

      it('guest: no voter/follower ids, no embedding, no internal fields', async () => {
        Issue.findOne.mockReturnValue(mockQuery(stored()));

        const result = await issueService.getIssueById('1');

        expect(result).toMatchObject({ votes: [], followers: [], hasVoted: false, isFollowing: false });
        expect(result).not.toHaveProperty('embedding');
        expect(result).not.toHaveProperty('lastReminderAt');
        expect(result).not.toHaveProperty('isDeleted');
      });

      it('signed-in citizen: only their own id comes back (old clients keep working)', async () => {
        Issue.findOne.mockReturnValue(mockQuery(stored()));

        const result = await issueService.getIssueById('1', { id: 'u2', role: 'user' });

        expect(result).toMatchObject({ votes: ['u2'], followers: ['u2'], hasVoted: true, isFollowing: true });
      });

      it('admin keeps internal SLA fields but still gets no voter list or embedding', async () => {
        Issue.findOne.mockReturnValue(mockQuery(stored()));

        const result = await issueService.getIssueById('1', { id: 'admin1', role: 'admin' });

        expect(result.votes).toEqual([]);
        expect(result).not.toHaveProperty('embedding');
        expect(result).toHaveProperty('lastReminderAt');
      });
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

    it('should expose contact details to an admin', async () => {
      const query = mockQuery({ _id: '1' });
      Issue.findOne.mockReturnValue(query);

      await issueService.getIssueById('1', { id: 'x', role: 'admin' });

      expect(query.select).not.toHaveBeenCalledWith('-phone');
      expect(query.populate).toHaveBeenCalledWith('userId', 'name email');
    });

    // Cán bộ chỉ thấy SĐT/email người báo cáo trên phiếu của ĐÚNG đơn vị mình.
    // Trước đây mọi cán bộ đều thấy — kể cả phiếu của đơn vị khác và phiếu chưa giao.
    describe('staff contact scope', () => {
      const staff = { id: 's1', role: 'staff', departmentId: 'deptA' };

      const loadAsStaff = async (issueDepartmentId) => {
        const scopeQuery = mockQuery({ _id: '1', departmentId: issueDepartmentId });
        const mainQuery = mockQuery({ _id: '1' });
        Issue.findOne.mockReturnValueOnce(scopeQuery).mockReturnValueOnce(mainQuery);
        await issueService.getIssueById('1', staff);
        // Bọc trong object: query giả có then() nên trả thẳng sẽ bị await "mở" ra.
        return { query: mainQuery };
      };

      it('same department → sees phone and emails', async () => {
        const { query } = await loadAsStaff('deptA');

        expect(query.select).not.toHaveBeenCalledWith('-phone');
        expect(query.populate).toHaveBeenCalledWith('userId', 'name email');
        expect(query.populate).toHaveBeenCalledWith('statusHistory.changedBy', 'name email');
      });

      it('another department → name only, no phone', async () => {
        const { query } = await loadAsStaff('deptB');

        expect(query.select).toHaveBeenCalledWith('-phone');
        expect(query.populate).toHaveBeenCalledWith('userId', 'name');
        expect(query.populate).toHaveBeenCalledWith('statusHistory.changedBy', 'name');
      });

      it('unassigned issue → name only, no phone', async () => {
        const { query } = await loadAsStaff(null);

        expect(query.select).toHaveBeenCalledWith('-phone');
        expect(query.populate).toHaveBeenCalledWith('userId', 'name');
      });

      it('missing issue → 404 from the scope lookup', async () => {
        Issue.findOne.mockReturnValueOnce(mockQuery(null));

        await expect(issueService.getIssueById('missing', staff)).rejects.toMatchObject({ statusCode: 404 });
      });
    });

    it('canSeeIssueContact: admin always, staff only for its own department', () => {
      const { canSeeIssueContact } = issueService;
      expect(canSeeIssueContact({ role: 'admin' }, null)).toBe(true);
      expect(canSeeIssueContact({ role: 'staff', departmentId: 'd1' }, 'd1')).toBe(true);
      expect(canSeeIssueContact({ role: 'staff', departmentId: 'd1' }, { _id: 'd1' })).toBe(true);
      expect(canSeeIssueContact({ role: 'staff', departmentId: 'd1' }, 'd2')).toBe(false);
      expect(canSeeIssueContact({ role: 'staff', departmentId: null }, 'd1')).toBe(false);
      expect(canSeeIssueContact({ role: 'user' }, 'd1')).toBe(false);
      expect(canSeeIssueContact(null, 'd1')).toBe(false);
    });

    it('should keep the public department contact for everyone', async () => {
      const query = mockQuery({ _id: '1' });
      Issue.findOne.mockReturnValue(query);

      await issueService.getIssueById('1');

      expect(query.populate).toHaveBeenCalledWith('departmentId', 'name code email phone');
    });

    // ─── E2: timeline "ai làm gì" ───
    // statusHistory[].changedBy được ghi đầy đủ ở 4 chỗ (lúc tạo, đổi trạng thái,
    // phân công, thu hồi) nhưng chuỗi populate của getIssueById thiếu nó, nên
    // client nhận ObjectId thô thay vì tên người thực hiện.
    it('should populate who changed each status, name only for an anonymous visitor', async () => {
      const query = mockQuery({ _id: '1' });
      Issue.findOne.mockReturnValue(query);

      await issueService.getIssueById('1');

      expect(query.populate).toHaveBeenCalledWith('statusHistory.changedBy', 'name');
    });

    it('should populate statusHistory.changedBy with email for an admin', async () => {
      const query = mockQuery({ _id: '1' });
      Issue.findOne.mockReturnValue(query);

      await issueService.getIssueById('1', { id: 'x', role: 'admin' });

      expect(query.populate).toHaveBeenCalledWith('statusHistory.changedBy', 'name email');
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
      ).rejects.toThrow('Trạng thái không hợp lệ.');
    });

    it('should throw if issue not found', async () => {
      Issue.findOne.mockReturnValue(mockQuery(null));

      await expect(
        issueService.updateIssueStatus('nonexistent', { status: 'processing', adminUser: { id: 'admin1', role: 'admin' } })
      ).rejects.toThrow('Không tìm thấy sự cố.');
    });

    it('should update status and notify reporter', async () => {
      const mockIssue = {
        _id: 'issue1',
        title: 'Pothole',
        userId: { _id: 'user1' },
      };
      Issue.findOne.mockReturnValue(mockQuery({ _id: 'issue1', status: 'reported', resolutionImages: [] }));
      Issue.findOneAndUpdate.mockReturnValue(mockQuery(mockIssue));
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

    // Hai cán bộ bấm cùng lúc / bấm đúp: lệnh ghi phải kèm trạng thái vừa đọc, nếu
    // không cả hai cùng qua bước kiểm tra luật rồi cùng ghi.
    it('writes only if the issue is still in the status it was checked against', async () => {
      Issue.findOne.mockReturnValue(mockQuery({ _id: 'issue1', status: 'reported', resolutionImages: [] }));
      Issue.findOneAndUpdate.mockReturnValue(mockQuery({ _id: 'issue1', title: 'T', userId: { _id: 'u1' } }));
      Notification.create.mockResolvedValue({ _id: 'n1' });

      await issueService.updateIssueStatus('issue1', { status: 'processing', adminUser: { id: 'a1', role: 'admin' } });

      expect(Issue.findOneAndUpdate.mock.calls[0][0]).toEqual({
        _id: 'issue1', isDeleted: false, mergedInto: null, status: 'reported',
      });
    });

    it('returns 409 STATUS_CONFLICT when someone else changed the issue in between', async () => {
      Issue.findOne.mockReturnValue(mockQuery({
        _id: 'issue1', status: 'processing', resolutionImages: [{ url: 'x' }],
      }));
      Issue.findOneAndUpdate.mockReturnValue(mockQuery(null));

      await expect(
        issueService.updateIssueStatus('issue1', { status: 'resolved', adminUser: { id: 'a1', role: 'admin' } })
      ).rejects.toMatchObject({ statusCode: 409, code: 'STATUS_CONFLICT' });
      expect(Notification.create).not.toHaveBeenCalled();
    });

    // Người theo dõi là bất kỳ ai đã bấm "đây là cùng một sự cố" — không được nhận
    // SĐT/email qua socket.
    it('sends followers a summary without phone or emails', async () => {
      Issue.findOne.mockReturnValue(mockQuery({ _id: 'issue1', status: 'reported', resolutionImages: [] }));
      Issue.findOneAndUpdate.mockReturnValue(mockQuery({
        _id: 'issue1',
        title: 'Ổ gà',
        status: 'processing',
        category: 'pothole',
        phone: '0905123456',
        userId: { _id: 'reporter1', name: 'Dân', email: 'dan@example.com' },
        adminId: { _id: 'staff1', name: 'Cán bộ', email: 'canbo@example.com' },
        followers: ['follower1'],
      }));
      Notification.create.mockResolvedValue({ _id: 'n1', message: 'm' });

      await issueService.updateIssueStatus('issue1', { status: 'processing', adminUser: { id: 'a1', role: 'admin' } });

      const issueEvents = mockIO.emit.mock.calls.filter(([event]) => event === 'issue:updated');
      expect(issueEvents).toHaveLength(2); // reporter + follower
      for (const [, payload] of issueEvents) {
        expect(payload.issue).toEqual({
          _id: 'issue1', title: 'Ổ gà', status: 'processing', category: 'pothole', resolvedAt: null, updatedAt: null,
        });
        expect(JSON.stringify(payload)).not.toMatch(/0905123456|@example\.com/);
      }
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
      Issue.findOneAndUpdate.mockReturnValue(mockQuery(mockIssue));
      Notification.create.mockResolvedValue({ _id: 'notif1' });

      await issueService.updateIssueStatus('issue1', {
        status: 'resolved',
        adminUser: { id: 'admin1', role: 'admin' },
      });

      const [guard, updateCall] = Issue.findOneAndUpdate.mock.calls[0];
      expect(updateCall.$set.resolvedAt).toBeInstanceOf(Date);
      // Ảnh minh chứng phải còn ĐÚNG lúc ghi (một lượt mở lại chen giữa sẽ xoá chúng).
      expect(guard['resolutionImages.0']).toEqual({ $exists: true });
    });

    // ─── E5: state machine trạng thái ───
    // Trước đây updateIssueStatus chỉ kiểm tra status có thuộc enum hay không,
    // nên MỌI cặp chuyển tiếp đều được nhận — kể cả lùi phiếu đã xử lý về
    // 'reported' bằng cách gọi thẳng API.
    it.each([
      ['resolved', 'reported'],
      ['processing', 'reported'],
      ['rejected', 'reported'],
      ['resolved', 'rejected'],
      ['rejected', 'resolved'],
      ['resolved', 'resolved'],
      ['processing', 'processing'],
    ])('refuses the %s -> %s transition', async (from, to) => {
      Issue.findOne.mockReturnValue(mockQuery({
        _id: 'issue1',
        status: from,
        resolutionImages: [{ url: 'https://cloud/after.jpg' }],
      }));

      await expect(
        issueService.updateIssueStatus('issue1', {
          status: to,
          adminUser: { id: 'admin1', role: 'admin' },
        })
      ).rejects.toThrow(/Không thể chuyển từ/);

      expect(Issue.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('tags the refused transition with a machine-readable code', async () => {
      Issue.findOne.mockReturnValue(mockQuery({
        _id: 'issue1', status: 'resolved', resolutionImages: [{ url: 'x' }],
      }));

      await expect(
        issueService.updateIssueStatus('issue1', {
          status: 'reported',
          adminUser: { id: 'admin1', role: 'admin' },
        })
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_STATUS_TRANSITION' });
    });

    // App mobile phải mở đúng màn hình cần thiết dựa trên mã lỗi, không so chuỗi
    // tiếng Việt. Hai mã dưới đây là hai nhánh UI khác hẳn nhau: một bên mở camera,
    // một bên điều hướng sang phiếu gốc.
    it('tags NO_RESOLUTION_IMAGE so the client can open the camera flow', async () => {
      Issue.findOne.mockReturnValue(mockQuery({
        _id: 'issue1', status: 'processing', resolutionImages: [],
      }));

      await expect(
        issueService.updateIssueStatus('issue1', {
          status: 'resolved',
          adminUser: { id: 'admin1', role: 'admin' },
        })
      ).rejects.toMatchObject({ statusCode: 400, code: 'NO_RESOLUTION_IMAGE' });
    });

    it('tags MERGED_ISSUE so the client can redirect to the original issue', async () => {
      Issue.findOne.mockReturnValue(mockQuery({
        _id: 'issue1', status: 'processing', resolutionImages: [], mergedInto: 'other1',
      }));

      await expect(
        issueService.updateIssueStatus('issue1', {
          status: 'resolved',
          adminUser: { id: 'admin1', role: 'admin' },
        })
      ).rejects.toMatchObject({ statusCode: 400, code: 'MERGED_ISSUE' });
    });

    it('still allows a legitimate reopening: resolved -> processing', async () => {
      Issue.findOne.mockReturnValue(mockQuery({
        _id: 'issue1', status: 'resolved', resolutionImages: [{ url: 'x' }],
      }));
      Issue.findOneAndUpdate.mockReturnValue(mockQuery({
        _id: 'issue1', title: 'Fixed', userId: { _id: 'user1' },
      }));
      Notification.create.mockResolvedValue({ _id: 'notif1' });

      const result = await issueService.updateIssueStatus('issue1', {
        status: 'processing',
        note: 'Người dân phản ánh chưa xong',
        adminUser: { id: 'admin1', role: 'admin' },
      });

      expect(result._id).toBe('issue1');
    });

    // Mở lại phiếu đã đóng = lượt mới: ảnh minh chứng + đánh giá cũ được cất đi,
    // nên phải chụp minh chứng MỚI trước khi báo xong lần nữa.
    it('reopening a resolved issue archives the round and clears evidence + rating', async () => {
      const resolvedAt = new Date('2026-10-01T03:00:00Z');
      Issue.findOne.mockReturnValue(mockQuery({
        _id: 'issue1',
        status: 'resolved',
        resolvedAt,
        resolutionImages: [{ url: 'https://cloud/after.jpg', publicId: 'p1', uploadedBy: 'staff1', uploadedAt: resolvedAt }],
        rating: { score: 1, comment: 'Chưa sửa xong', ratedAt: resolvedAt },
        statusHistory: [],
      }));
      Issue.findOneAndUpdate.mockReturnValue(mockQuery({ _id: 'issue1', title: 'T', userId: { _id: 'u1' } }));
      Notification.create.mockResolvedValue({ _id: 'n1' });

      await issueService.updateIssueStatus('issue1', {
        status: 'processing',
        note: 'Mở lại để làm tiếp',
        adminUser: { id: 'staff1', role: 'admin' },
      });

      const [guard, update] = Issue.findOneAndUpdate.mock.calls[0];
      expect(guard.status).toBe('resolved');
      expect(update.$set).toMatchObject({
        status: 'processing',
        resolvedAt: null,
        resolutionImages: [],
        rating: { score: null, comment: null, ratedAt: null },
      });
      expect(update.$push.previousRounds).toMatchObject({
        closedStatus: 'resolved',
        closedAt: resolvedAt,
        resolutionImages: [{ url: 'https://cloud/after.jpg', publicId: 'p1' }],
        rating: { score: 1, comment: 'Chưa sửa xong' },
        reopenedBy: 'staff1',
        reopenReason: 'Mở lại để làm tiếp',
      });
    });

    it('a normal processing -> resolved change does not touch previous rounds', async () => {
      Issue.findOne.mockReturnValue(mockQuery({
        _id: 'issue1', status: 'processing', resolutionImages: [{ url: 'x' }],
      }));
      Issue.findOneAndUpdate.mockReturnValue(mockQuery({ _id: 'issue1', title: 'T', userId: { _id: 'u1' } }));
      Notification.create.mockResolvedValue({ _id: 'n1' });

      await issueService.updateIssueStatus('issue1', { status: 'resolved', adminUser: { id: 'a1', role: 'admin' } });

      const [, update] = Issue.findOneAndUpdate.mock.calls[0];
      expect(update.$push.previousRounds).toBeUndefined();
      expect(update.$set.rating).toBeUndefined();
    });

    // Quyền phải kiểm tra TRƯỚC trạng thái: cán bộ sai đơn vị không được học
    // luật chuyển trạng thái của một phiếu họ không có quyền đụng vào.
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

  describe('addResolutionImages()', () => {
    const files = (n) => Array.from({ length: n }, (_, i) => ({ path: `https://cdn.test/after-${i}.jpg`, filename: `after/${i}` }));
    const staff = { id: 'staff1', role: 'staff', departmentId: 'deptA' };

    it('adds the photos with ONE conditional write (count checked atomically)', async () => {
      Issue.findOne.mockReturnValue(mockQuery({ _id: 'i1', status: 'processing', departmentId: 'deptA', resolutionImages: [{ url: 'x' }] }));
      Issue.findOneAndUpdate.mockReturnValue(mockQuery({ resolutionImages: [{ url: 'x' }, { url: 'a' }, { url: 'b' }] }));

      const result = await issueService.addResolutionImages('i1', files(2), staff);

      const [filter, update] = Issue.findOneAndUpdate.mock.calls[0];
      // Phần tử thứ (5 − 2) = 3 chưa tồn tại ⇔ mảng đang có tối đa 3 ảnh.
      expect(filter).toMatchObject({ _id: 'i1', isDeleted: false, mergedInto: null, 'resolutionImages.3': { $exists: false } });
      expect(filter.status).toEqual({ $nin: ['resolved', 'rejected'] });
      expect(update.$push.resolutionImages.$each).toHaveLength(2);
      expect(result).toHaveLength(3);
    });

    it('a parallel upload that would exceed 5 photos is refused and its files rolled back', async () => {
      Issue.findOne.mockReturnValue(mockQuery({ _id: 'i1', status: 'processing', departmentId: 'deptA', resolutionImages: [] }));
      Issue.findOneAndUpdate.mockReturnValue(mockQuery(null));

      await expect(issueService.addResolutionImages('i1', files(3), staff)).rejects.toThrow(/tối đa 5 ảnh/);
      expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(3);
    });

    it('refuses new evidence on a closed issue (ISSUE_CLOSED) — reopen first', async () => {
      Issue.findOne.mockReturnValue(mockQuery({ _id: 'i1', status: 'resolved', departmentId: 'deptA', resolutionImages: [{ url: 'x' }] }));

      await expect(issueService.addResolutionImages('i1', files(1), staff))
        .rejects.toMatchObject({ statusCode: 400, code: 'ISSUE_CLOSED' });
      expect(Issue.findOneAndUpdate).not.toHaveBeenCalled();
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('after/0');
    });
  });

  describe('deleteIssue()', () => {
    it('should throw if issue not found', async () => {
      Issue.findOneAndUpdate.mockResolvedValue(null);

      await expect(issueService.deleteIssue('nonexistent')).rejects.toThrow('Không tìm thấy sự cố.');
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

      await expect(issueService.deleteMyIssue('nonexistent', 'user1')).rejects.toThrow('Không tìm thấy sự cố.');
    });

    it('should throw if user is not the owner', async () => {
      Issue.findOne.mockResolvedValue({
        _id: 'issue1',
        userId: { toString: () => 'otherUser' },
        status: 'reported',
      });

      await expect(issueService.deleteMyIssue('issue1', 'user1')).rejects.toThrow('Bạn chỉ được xoá sự cố do chính mình báo cáo.');
    });

    it('should throw if status is not "reported"', async () => {
      Issue.findOne.mockResolvedValue({
        _id: 'issue1',
        userId: { toString: () => 'user1' },
        status: 'processing',
      });

      await expect(issueService.deleteMyIssue('issue1', { toString: () => 'user1' }))
        .rejects.toThrow('Chỉ xoá được sự cố còn ở trạng thái "Mới báo cáo".');
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

      await expect(issueService.updateMyIssue('nonexistent', 'user1', {})).rejects.toThrow('Không tìm thấy sự cố.');
    });

    it('should throw if not the owner', async () => {
      Issue.findOne.mockResolvedValue({
        userId: { toString: () => 'otherUser' },
        status: 'reported',
      });

      await expect(issueService.updateMyIssue('issue1', { toString: () => 'user1' }, { title: 'New' }))
        .rejects.toThrow('Bạn chỉ được sửa sự cố do chính mình báo cáo.');
    });

    it('should throw if status is not reported', async () => {
      Issue.findOne.mockResolvedValue({
        userId: { toString: () => 'user1' },
        status: 'processing',
      });

      await expect(issueService.updateMyIssue('issue1', { toString: () => 'user1' }, { title: 'New' }))
        .rejects.toThrow('Chỉ sửa được sự cố còn ở trạng thái "Mới báo cáo".');
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
