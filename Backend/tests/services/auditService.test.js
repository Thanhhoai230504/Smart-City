jest.mock('../../src/models/AuditLog');

const AuditLog = require('../../src/models/AuditLog');
const auditService = require('../../src/services/auditService');

const mockQuery = (result) => {
  const query = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ['populate', 'sort', 'skip', 'limit', 'lean']) {
    query[method] = jest.fn(() => query);
  }
  return query;
};

describe('AuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordAudit()', () => {
    it('should capture actor, target and request context', async () => {
      AuditLog.create.mockResolvedValue({ _id: 'log1' });
      const request = {
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('jest-agent'),
      };

      const result = await auditService.recordAudit({
        actor: { id: 'admin1', role: 'admin' },
        action: 'issue.deleted',
        entityType: 'Issue',
        entityId: 'issue1',
        description: 'Xóa sự cố',
        metadata: { reason: 'duplicate' },
        request,
      });

      expect(AuditLog.create).toHaveBeenCalledWith({
        actorId: 'admin1',
        actorRole: 'admin',
        action: 'issue.deleted',
        entityType: 'Issue',
        entityId: 'issue1',
        description: 'Xóa sự cố',
        metadata: { reason: 'duplicate' },
        ipAddress: '127.0.0.1',
        userAgent: 'jest-agent',
      });
      expect(result).toEqual({ _id: 'log1' });
    });

    it('should not fail the completed business action when audit storage is unavailable', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      AuditLog.create.mockRejectedValue(new Error('Mongo unavailable'));

      await expect(auditService.recordAudit({
        actor: { id: 'admin1', role: 'admin' },
        action: 'issue.deleted',
        entityType: 'Issue',
        entityId: 'issue1',
        description: 'Xóa sự cố',
      })).resolves.toBeNull();

      expect(warn).toHaveBeenCalledWith('Audit log write error:', 'Mongo unavailable');
      warn.mockRestore();
    });
  });

  describe('getAuditLogs()', () => {
    it('should apply filters and return pagination', async () => {
      const logs = [{ _id: 'log1' }];
      AuditLog.find.mockReturnValue(mockQuery(logs));
      AuditLog.countDocuments.mockResolvedValue(1);

      const result = await auditService.getAuditLogs({
        action: 'issue.assigned',
        entityType: 'Issue',
        actorId: 'admin1',
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
        page: 1,
        limit: 20,
      });

      const filter = AuditLog.find.mock.calls[0][0];
      expect(filter.action).toBe('issue.assigned');
      expect(filter.entityType).toBe('Issue');
      expect(filter.actorId).toBe('admin1');
      expect(filter.createdAt.$gte).toBeInstanceOf(Date);
      expect(filter.createdAt.$lte).toBeInstanceOf(Date);
      expect(result.logs).toBe(logs);
      expect(result.pagination).toEqual({
        current: 1,
        pages: 1,
        total: 1,
        limit: 20,
      });
    });
  });
});
