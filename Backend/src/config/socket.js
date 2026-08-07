const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io;

/**
 * Lấy access token từ handshake.
 * Ưu tiên socket.handshake.auth.token (client gửi qua option `auth`),
 * fallback sang header Authorization: Bearer <token>.
 */
const extractToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  const header = socket.handshake.headers?.authorization;
  if (header && header.startsWith('Bearer ')) return header.split(' ')[1];

  return null;
};

/**
 * Middleware xác thực JWT cho Socket.io.
 * Danh tính (userId, role) LUÔN lấy từ token đã verify — không bao giờ
 * tin dữ liệu client tự khai, tránh việc client giả mạo role admin
 * hoặc nghe thông báo riêng của người khác.
 */
const authenticateSocket = async (socket, next) => {
  try {
    const token = extractToken(socket);
    if (!token) {
      return next(new Error('UNAUTHORIZED: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('_id role isActive');
    if (!user || !user.isActive) {
      return next(new Error('UNAUTHORIZED: User not found or deactivated'));
    }

    // Gắn danh tính đã xác thực vào socket
    socket.data.userId = user._id.toString();
    socket.data.role = user.role;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new Error('TOKEN_EXPIRED'));
    }
    next(new Error('UNAUTHORIZED: Invalid token'));
  }
};

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const { userId, role } = socket.data;

    // Tự động join room dựa trên danh tính từ token, client không cần
    // (và không thể) tự chọn room.
    socket.join(`user_${userId}`);
    if (role === 'admin') {
      socket.join('admins');
    }

    console.log(`🔌 Client connected: ${socket.id} (user ${userId}, role ${role})`);

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = { initSocket, getIO, authenticateSocket };
