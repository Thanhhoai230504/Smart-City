const jwt = require('jsonwebtoken');

// Mock User model
jest.mock('../../src/models/User', () => {
  const mockUser = {
    findById: jest.fn(),
  };
  return mockUser;
});

const User = require('../../src/models/User');
const { authMiddleware, adminMiddleware, ownerMiddleware } = require('../../src/middleware/auth');

const mockReq = (overrides = {}) => ({
  headers: {},
  params: {},
  user: null,
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authMiddleware', () => {
    it('should return 401 if no Authorization header', async () => {
      const req = mockReq();
      const res = mockRes();

      await authMiddleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. No token provided.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if Authorization header does not start with Bearer', async () => {
      const req = mockReq({ headers: { authorization: 'Basic abc123' } });
      const res = mockRes();

      await authMiddleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 for invalid token', async () => {
      const req = mockReq({ headers: { authorization: 'Bearer invalid-token' } });
      const res = mockRes();

      await authMiddleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token.',
      });
    });

    it('should return 401 for expired token', async () => {
      const expiredToken = jwt.sign(
        { id: '123', email: 'test@test.com', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '0s' }
      );
      const req = mockReq({ headers: { authorization: `Bearer ${expiredToken}` } });
      const res = mockRes();

      // Small delay to ensure token is expired
      await new Promise(resolve => setTimeout(resolve, 10));
      await authMiddleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'TOKEN_EXPIRED',
        })
      );
    });

    it('should return 401 if user not found', async () => {
      const token = jwt.sign(
        { id: '507f1f77bcf86cd799439011', email: 'test@test.com', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      User.findById.mockResolvedValue(null);

      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = mockRes();

      await authMiddleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found or account deactivated.',
      });
    });

    it('should return 401 if user is deactivated', async () => {
      const token = jwt.sign(
        { id: '507f1f77bcf86cd799439011', email: 'test@test.com', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      User.findById.mockResolvedValue({ _id: '507f1f77bcf86cd799439011', isActive: false });

      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = mockRes();

      await authMiddleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should attach user to req and call next() on valid token', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = jwt.sign(
        { id: userId, email: 'test@test.com', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      User.findById.mockResolvedValue({
        _id: userId,
        name: 'Test User',
        email: 'test@test.com',
        role: 'user',
        isActive: true,
      });

      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = mockRes();

      await authMiddleware(req, res, mockNext);

      expect(req.user).toEqual({
        id: userId,
        name: 'Test User',
        email: 'test@test.com',
        role: 'user',
      });
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('adminMiddleware', () => {
    it('should return 403 if user is not admin', () => {
      const req = mockReq({ user: { role: 'user' } });
      const res = mockRes();

      adminMiddleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. Admin privileges required.',
      });
    });

    it('should call next() if user is admin', () => {
      const req = mockReq({ user: { role: 'admin' } });
      const res = mockRes();

      adminMiddleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('ownerMiddleware', () => {
    it('should call next() if user is admin', async () => {
      const mockModel = { findById: jest.fn() };
      const middleware = ownerMiddleware(mockModel);
      const req = mockReq({ user: { role: 'admin', id: 'admin1' }, params: { id: 'resource1' } });
      const res = mockRes();

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockModel.findById).not.toHaveBeenCalled();
    });

    it('should return 404 if resource not found', async () => {
      const mockModel = { findById: jest.fn().mockResolvedValue(null) };
      const middleware = ownerMiddleware(mockModel);
      const req = mockReq({ user: { role: 'user', id: 'user1' }, params: { id: 'resource1' } });
      const res = mockRes();

      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if user is not the resource owner', async () => {
      const mockModel = {
        findById: jest.fn().mockResolvedValue({ userId: { toString: () => 'otherUser' } }),
      };
      const middleware = ownerMiddleware(mockModel);
      const req = mockReq({
        user: { role: 'user', id: { toString: () => 'currentUser' } },
        params: { id: 'resource1' },
      });
      const res = mockRes();

      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should call next() if user is the resource owner', async () => {
      const mockModel = {
        findById: jest.fn().mockResolvedValue({ userId: { toString: () => 'user1' } }),
      };
      const middleware = ownerMiddleware(mockModel);
      const req = mockReq({
        user: { role: 'user', id: { toString: () => 'user1' } },
        params: { id: 'resource1' },
      });
      const res = mockRes();

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
