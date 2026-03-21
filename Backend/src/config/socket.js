const { Server } = require('socket.io');

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join room based on user role (client sends role after auth)
    socket.on('join', (data) => {
      if (data.role === 'admin') {
        socket.join('admins');
        console.log(`👤 Admin joined: ${socket.id}`);
      }
      if (data.userId) {
        socket.join(`user_${data.userId}`);
        console.log(`👤 User ${data.userId} joined: ${socket.id}`);
      }
    });

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

module.exports = { initSocket, getIO };
