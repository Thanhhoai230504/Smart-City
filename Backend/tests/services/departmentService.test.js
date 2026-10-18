jest.mock('../../src/models/Department');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Issue');
jest.mock('../../src/config/socket', () => ({ disconnectUserSockets: jest.fn() }));

const Department = require('../../src/models/Department');
const User = require('../../src/models/User');
const Issue = require('../../src/models/Issue');
const { disconnectUserSockets } = require('../../src/config/socket');
const departmentService = require('../../src/services/departmentService');

const OPEN = { $in: ['reported', 'processing'] };

describe('departmentService — phân quyền theo đơn vị', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Issue.updateMany.mockResolvedValue({ modifiedCount: 0 });
  });

  describe('vô hiệu hoá đơn vị', () => {
    // Trước đây chỉ DELETE kiểm "còn phiếu mở"; PUT { isActive: false } bỏ qua.
    it('PUT isActive=false còn phiếu mở → 400, không ghi', async () => {
      Issue.countDocuments.mockResolvedValue(3);

      await expect(departmentService.updateDepartment('d1', { isActive: false }))
        .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/còn 3 sự cố/) });
      expect(Issue.countDocuments).toHaveBeenCalledWith(expect.objectContaining({ departmentId: 'd1', status: OPEN }));
      expect(Department.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('PUT isActive=false khi đã hết việc → ghi bình thường', async () => {
      Issue.countDocuments.mockResolvedValue(0);
      Department.findByIdAndUpdate.mockResolvedValue({ _id: 'd1', isActive: false });

      await expect(departmentService.updateDepartment('d1', { isActive: false })).resolves.toMatchObject({ isActive: false });
    });

    it('sửa tên không cần kiểm phiếu mở', async () => {
      Department.findByIdAndUpdate.mockResolvedValue({ _id: 'd1', name: 'Mới' });

      await departmentService.updateDepartment('d1', { name: 'Mới' });

      expect(Issue.countDocuments).not.toHaveBeenCalled();
    });
  });

  describe('releaseOpenAssignments()', () => {
    it('chỉ trả phiếu còn mở về hàng chờ', async () => {
      Issue.updateMany.mockResolvedValue({ modifiedCount: 2 });

      await expect(departmentService.releaseOpenAssignments('u1')).resolves.toBe(2);
      expect(Issue.updateMany).toHaveBeenCalledWith(
        { assigneeId: 'u1', isDeleted: false, status: OPEN },
        { $set: { assigneeId: null } }
      );
    });

    it('giữ lại phiếu của đơn vị mới khi chuyển đơn vị', async () => {
      await departmentService.releaseOpenAssignments('u1', { keepDepartmentId: 'dNew' });

      expect(Issue.updateMany).toHaveBeenCalledWith(
        { assigneeId: 'u1', isDeleted: false, status: OPEN, departmentId: { $ne: 'dNew' } },
        { $set: { assigneeId: null } }
      );
    });
  });

  describe('assignStaffToDepartment()', () => {
    it('chuyển sang đơn vị khác: trả phiếu của đơn vị cũ và ngắt socket để client tải lại quyền', async () => {
      const user = { _id: 'u1', role: 'staff', departmentId: 'dOld', save: jest.fn().mockResolvedValue(true) };
      User.findById.mockResolvedValue(user);
      Department.findOne.mockResolvedValue({ _id: 'dNew' });

      await departmentService.assignStaffToDepartment('u1', 'dNew');

      expect(user).toMatchObject({ role: 'staff', departmentId: 'dNew' });
      expect(Issue.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ assigneeId: 'u1', departmentId: { $ne: 'dNew' } }),
        { $set: { assigneeId: null } }
      );
      expect(disconnectUserSockets).toHaveBeenCalledWith('u1');
    });

    it('bỏ gán đơn vị: về người dùng thường, trả mọi phiếu đang mở', async () => {
      const user = { _id: 'u1', role: 'staff', departmentId: 'dOld', save: jest.fn().mockResolvedValue(true) };
      User.findById.mockResolvedValue(user);

      await departmentService.assignStaffToDepartment('u1', null);

      expect(user).toMatchObject({ role: 'user', departmentId: null });
      expect(Issue.updateMany).toHaveBeenCalledWith(
        { assigneeId: 'u1', isDeleted: false, status: OPEN },
        { $set: { assigneeId: null } }
      );
      expect(disconnectUserSockets).toHaveBeenCalledWith('u1');
    });
  });
});
