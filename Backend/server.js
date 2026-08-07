const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const passport = require('passport');

// Load environment variables
dotenv.config();

const connectDB = require('./src/config/db');
const { initSocket } = require('./src/config/socket');
const errorHandler = require('./src/middleware/errorHandler');
const { generalLimiter } = require('./src/middleware/rateLimiters');
const { startEnvironmentCron } = require('./src/jobs/environmentCron');
const { startReportCron } = require('./src/jobs/reportCron');
const { startSlaCron } = require('./src/jobs/slaCron');
const { startPriorityCron } = require('./src/jobs/priorityCron');
const { startEmbeddingCron } = require('./src/jobs/embeddingCron');

// Import routes
const authRoutes = require('./src/routes/auth');
const issueRoutes = require('./src/routes/issues');
const placeRoutes = require('./src/routes/places');
const environmentRoutes = require('./src/routes/environment');
const trafficRoutes = require('./src/routes/traffic');
const userRoutes = require('./src/routes/users');

const dashboardRoutes = require('./src/routes/dashboard');
const commentRoutes = require('./src/routes/comments');
const notificationRoutes = require('./src/routes/notifications');
const aiRoutes = require('./src/routes/ai');
const chatbotRoutes = require('./src/routes/chatbot');
const reportRoutes = require('./src/routes/reports');
const statisticsRoutes = require('./src/routes/statistics');
const badgeRoutes = require('./src/routes/badges');
const departmentRoutes = require('./src/routes/departments');
const auditLogRoutes = require('./src/routes/auditLogs');
const cameraRoutes = require('./src/routes/cameras');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = initSocket(server);

// Make io accessible in controllers via req.app
app.set('io', io);

// ============ MIDDLEWARE ============

// Tin đúng 1 lớp proxy (Render) để req.ip là IP thật của client, nhờ đó rate
// limiter tính theo từng người dùng thay vì gộp tất cả vào IP của proxy.
// Không dùng `true` vì khi đó Express tin toàn bộ chuỗi X-Forwarded-For,
// cho phép client tự thêm header để giả mạo IP và né limiter.
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Passport (Google OAuth)
require('./src/config/passport');
app.use(passport.initialize());

// ============ ROUTES ============

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Smart City Dashboard API is running',
    version: '1.0.0'
  });
});

// Lưu ý: login/register/change-password có authStrictLimiter riêng gắn trực tiếp
// trong routes/auth.js. Không thể đặt app.use('/api/auth/login', ...) sau dòng
// dưới đây vì authRoutes đã xử lý và trả response trước, middleware sẽ không chạy.
app.use('/api/auth', generalLimiter, authRoutes);
app.use('/api/issues', generalLimiter, issueRoutes);
app.use('/api/places', generalLimiter, placeRoutes);
app.use('/api/environment', generalLimiter, environmentRoutes);
app.use('/api/traffic', generalLimiter, trafficRoutes);
app.use('/api/users', generalLimiter, userRoutes);
app.use('/api/dashboard', generalLimiter, dashboardRoutes);
app.use('/api/issues/:issueId/comments', generalLimiter, commentRoutes);
app.use('/api/notifications', generalLimiter, notificationRoutes);
app.use('/api/ai', generalLimiter, aiRoutes);
app.use('/api/chatbot', generalLimiter, chatbotRoutes);
app.use('/api/reports', generalLimiter, reportRoutes);
app.use('/api/statistics', generalLimiter, statisticsRoutes);
app.use('/api/badges', generalLimiter, badgeRoutes);
app.use('/api/departments', generalLimiter, departmentRoutes);
app.use('/api/audit-logs', generalLimiter, auditLogRoutes);
app.use('/api/cameras', generalLimiter, cameraRoutes);

// ============ ERROR HANDLING ============

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);

// ============ START SERVER ============

const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start server
connectDB().then(() => {
  // Start cron jobs after DB is connected
  startEnvironmentCron();
  startReportCron();
  startSlaCron();
  startPriorityCron();
  startEmbeddingCron();

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}).catch((err) => {
  console.error('❌ Failed to connect to MongoDB:', err.message);
  // Start server anyway for health checks
  server.listen(PORT, () => {
    console.log(`⚠️  Server running on port ${PORT} (without database)`);
  });
});

module.exports = { app, server };
