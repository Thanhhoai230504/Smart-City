jest.mock('../../src/models/DepartmentEvaluation');
jest.mock('../../src/models/Department');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Notification');
jest.mock('../../src/config/socket');
jest.mock('../../src/services/departmentPerformanceService', () => ({
  ...jest.requireActual('../../src/services/departmentPerformanceService'),
  getDepartmentPerformanceDetail: jest.fn(),
}));

const DepartmentEvaluation = require('../../src/models/DepartmentEvaluation');
const Department = require('../../src/models/Department');
const User = require('../../src/models/User');
const Notification = require('../../src/models/Notification');
const { getIO } = require('../../src/config/socket');
const { getDepartmentPerformanceDetail } = require('../../src/services/departmentPerformanceService');
const service = require('../../src/services/departmentEvaluationService');

const DEPT_ID = '6a6732404513fe4ab8577236';
const OTHER_DEPT = '6a6732414513fe4ab8577237';
const NOW = new Date('2026-10-04T05:00:00Z');
const SEPTEMBER = { from: '2026-08-31T17:00:00.000Z', to: '2026-09-30T16:59:59.999Z' };
const admin = { id: 'admin1', role: 'admin', name: 'Quản trị' };
const mockIO = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

const mockQuery = (result) => {
  const q = { then: (res, rej) => Promise.resolve(result).then(res, rej) };
  for (const m of ['populate', 'select', 'lean', 'sort', 'limit']) q[m] = jest.fn(() => q);
  return q;
};

const detail = (label = 'improve', score = 53) => ({
  period: { from: new Date(SEPTEMBER.from), to: new Date(SEPTEMBER.to) },
  config: { version: 'dept-score-v1', weights: { onTime: 0.4 }, thresholds: { commend: 85, meet: 60 }, minClosedForScore: 5, labels: {} },
  department: { _id: DEPT_ID, name: 'Phòng Hạ tầng', code: 'HTGT' },
  metrics: { assigned: 10, closed: 8, onTimeRate: 43 },
  score: { score, label, labelText: { commend: 'Đề xuất khen thưởng', meet: 'Đạt yêu cầu', improve: 'Cần nhắc nhở', insufficient: 'Chưa đủ dữ liệu' }[label], components: [], attention: [], reasons: [], version: 'dept-score-v1' },
  trend: { unit: 'week', buckets: [] },
  byCategory: [],
  staff: [{ name: 'Cán bộ A' }],
  evidence: {
    overdue: [{ _id: 'i1', title: 'Ổ gà', status: 'processing', dueAt: new Date(), assignee: { name: 'A' } }],
    escalated: [], reopened: [], lowRated: [], praised: [],
  },
});

const input = (over = {}) => ({ ...SEPTEMBER, decision: 'remind', content: 'Đơn vị còn nhiều việc trễ hạn, cần khắc phục.', ...over });

beforeEach(() => {
  jest.clearAllMocks();
  getIO.mockReturnValue(mockIO);
  Department.findById.mockReturnValue(mockQuery({ _id: DEPT_ID, name: 'Phòng Hạ tầng', code: 'HTGT', isActive: true }));
  DepartmentEvaluation.exists.mockResolvedValue(null);
  DepartmentEvaluation.create.mockImplementation(async (doc) => ({ _id: 'ev1', ...doc }));
  getDepartmentPerformanceDetail.mockResolvedValue(detail());
  User.find.mockReturnValue(mockQuery([{ _id: 's1' }, { _id: 's2' }]));
  Notification.create.mockImplementation(async (doc) => ({ _id: 'n1', ...doc }));
});

describe('createEvaluation', () => {
  it('stores the decision with a snapshot computed by the server, not sent by the client', async () => {
    const { evaluation } = await service.createEvaluation(DEPT_ID, input({ snapshot: { score: 100 } }), admin, NOW);

    expect(getDepartmentPerformanceDetail).toHaveBeenCalledWith(DEPT_ID, SEPTEMBER, NOW);
    const saved = DepartmentEvaluation.create.mock.calls[0][0];
    expect(saved).toMatchObject({
      departmentId: DEPT_ID,
      decision: 'remind',
      decidedBy: 'admin1',
      suggestion: { label: 'improve', labelText: 'Cần nhắc nhở', score: 53 },
      deviatesFromSuggestion: false,
      deviationReason: null,
    });
    expect(saved.period.from.toISOString()).toBe(SEPTEMBER.from);
    expect(saved.snapshot.score.score).toBe(53);
    expect(saved.snapshot.metrics.onTimeRate).toBe(43);
    expect(saved.snapshot.department).toEqual({ name: 'Phòng Hạ tầng', code: 'HTGT' });
    expect(saved.snapshot.capturedAt).toEqual(NOW);
    expect(evaluation._id).toBe('ev1');
  });

  // Ảnh chụp chỉ giữ mã + tiêu đề + trạng thái phiếu: đủ để truy lại, không phình dung lượng.
  it('keeps a compact list of evidence issues in the snapshot', async () => {
    await service.createEvaluation(DEPT_ID, input(), admin, NOW);
    const saved = DepartmentEvaluation.create.mock.calls[0][0];
    expect(saved.snapshot.evidence.overdue).toEqual([{ _id: 'i1', title: 'Ổ gà', status: 'processing' }]);
    expect(saved.snapshot).not.toHaveProperty('staff');
  });

  it('requires a reason when the decision differs from the suggestion', async () => {
    await expect(service.createEvaluation(DEPT_ID, input({ decision: 'commend' }), admin, NOW))
      .rejects.toMatchObject({ statusCode: 400, code: 'DEVIATION_REASON_REQUIRED' });
    expect(DepartmentEvaluation.create).not.toHaveBeenCalled();
  });

  it('accepts a different decision when a reason is given', async () => {
    await service.createEvaluation(DEPT_ID, input({ decision: 'criticize', deviationReason: 'Tồn đọng kéo dài nhiều kỳ liên tiếp.' }), admin, NOW);
    expect(DepartmentEvaluation.create.mock.calls[0][0]).toMatchObject({
      deviatesFromSuggestion: true, deviationReason: 'Tồn đọng kéo dài nhiều kỳ liên tiếp.',
    });
  });

  it('drops a reason that is not needed', async () => {
    await service.createEvaluation(DEPT_ID, input({ deviationReason: 'không cần thiết lắm đâu' }), admin, NOW);
    expect(DepartmentEvaluation.create.mock.calls[0][0].deviationReason).toBeNull();
  });

  it('rejects a period that has not ended yet', async () => {
    await expect(service.createEvaluation(DEPT_ID, input({ to: '2026-10-31T16:59:59.999Z' }), admin, NOW))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(getDepartmentPerformanceDetail).not.toHaveBeenCalled();
  });

  // Đổi quyết định = huỷ bản cũ (có lý do) rồi ghi bản mới, để lịch sử không bị ghi đè.
  it('refuses a second active decision for the same department and period', async () => {
    DepartmentEvaluation.exists.mockResolvedValue({ _id: 'old' });
    await expect(service.createEvaluation(DEPT_ID, input(), admin, NOW))
      .rejects.toMatchObject({ statusCode: 409, code: 'EVALUATION_EXISTS' });
  });

  it('returns 404 for an unknown department', async () => {
    Department.findById.mockReturnValue(mockQuery(null));
    await expect(service.createEvaluation(DEPT_ID, input(), admin, NOW)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('notifies the department staff in-app, not by email', async () => {
    await service.createEvaluation(DEPT_ID, input(), admin, NOW);
    expect(User.find).toHaveBeenCalledWith({ departmentId: DEPT_ID, role: 'staff', isActive: true });
    expect(Notification.create).toHaveBeenCalledTimes(2);
    expect(Notification.create.mock.calls[0][0]).toMatchObject({
      userId: 's1', type: 'department_evaluated', issueId: null,
    });
    expect(Notification.create.mock.calls[0][0].message).toContain('01/09/2026 – 30/09/2026');
  });

  it('still saves the decision when notifications fail', async () => {
    Notification.create.mockRejectedValue(new Error('socket down'));
    const { evaluation } = await service.createEvaluation(DEPT_ID, input(), admin, NOW);
    expect(evaluation._id).toBe('ev1');
  });
});

describe('listEvaluations', () => {
  beforeEach(() => {
    DepartmentEvaluation.find.mockReturnValue(mockQuery([{ _id: 'ev1' }]));
  });

  it('lets an admin read any department', async () => {
    const list = await service.listEvaluations(DEPT_ID, admin);
    expect(list).toEqual([{ _id: 'ev1' }]);
    expect(DepartmentEvaluation.find).toHaveBeenCalledWith({ departmentId: DEPT_ID });
  });

  it('lets staff read their own department', async () => {
    await expect(service.listEvaluations(DEPT_ID, { id: 's1', role: 'staff', departmentId: DEPT_ID })).resolves.toHaveLength(1);
  });

  it('forbids staff from reading another department', async () => {
    await expect(service.listEvaluations(DEPT_ID, { id: 's1', role: 'staff', departmentId: OTHER_DEPT }))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('revokeEvaluation', () => {
  const active = (over = {}) => ({
    _id: 'ev1', departmentId: DEPT_ID, status: 'active', decision: 'commend',
    period: { from: new Date(SEPTEMBER.from), to: new Date(SEPTEMBER.to) },
    save: jest.fn().mockResolvedValue(true),
    ...over,
  });

  it('marks the decision revoked with who, when and why — it is never deleted', async () => {
    const ev = active();
    DepartmentEvaluation.findById.mockResolvedValue(ev);
    await service.revokeEvaluation(DEPT_ID, 'ev1', { reason: 'Ghi nhầm kỳ đánh giá, sẽ ghi lại.' }, admin, NOW);
    expect(ev).toMatchObject({ status: 'revoked', revokedBy: 'admin1', revokedAt: NOW, revokeReason: 'Ghi nhầm kỳ đánh giá, sẽ ghi lại.' });
    expect(ev.save).toHaveBeenCalled();
    expect(Notification.create).toHaveBeenCalled();
  });

  it('refuses to revoke twice', async () => {
    DepartmentEvaluation.findById.mockResolvedValue(active({ status: 'revoked' }));
    await expect(service.revokeEvaluation(DEPT_ID, 'ev1', { reason: 'Huỷ lần nữa cho chắc ăn' }, admin, NOW))
      .rejects.toMatchObject({ statusCode: 400, code: 'EVALUATION_REVOKED' });
  });

  it('returns 404 when the decision belongs to another department', async () => {
    DepartmentEvaluation.findById.mockResolvedValue(active({ departmentId: OTHER_DEPT }));
    await expect(service.revokeEvaluation(DEPT_ID, 'ev1', { reason: 'Ghi nhầm đơn vị cần huỷ' }, admin, NOW))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
