const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const passport = require('passport');
const mongoose = require('mongoose');
// Nạp TRƯỚC dotenv.config() để gọi validateEnv() được ngay bên dưới, và trước
// mọi module đọc process.env lúc nạp (emailService dựng transporter ở top level).
const { validateEnv } = require('./src/config/validateEnv');

// Load environment variables
dotenv.config();

// Hỏng cấu hình thì hỏng NGAY và nói rõ thiếu gì. Trước đây thiếu JWT_SECRET chỉ
// nổ khi có người đăng nhập — tức là sau khi deploy đã "thành công".
validateEnv();

const connectDB = require('./src/config/db');
const { logger } = require('./src/utils/logger');
const { initSocket } = require('./src/config/socket');
const errorHandler = require('./src/middleware/errorHandler');
const { getHealth } = require('./src/controllers/healthController');
const { generalLimiter } = require('./src/middleware/rateLimiters');
const { startCrons } = require('./src/jobs');
const { registerShutdownHandlers } = require('./src/config/shutdown');

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
const geoRoutes = require('./src/routes/geo');
const metaRoutes = require('./src/routes/meta');
const appRoutes = require('./src/routes/app');

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
  // X-App-Version: app mobile gửi để server quyết định có buộc cập nhật không
  // (task 0.8). App native không chịu CORS, nhưng bản build web để xem thử thì có.
  allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Version']
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

// Health check THẬT: đọc mongoose.connection.readyState và trả 503 khi DB chưa sẵn
// sàng. Route '/' ở trên trả 200 cứng nên không dùng làm health check được —
// monitor sẽ luôn báo xanh kể cả khi DB đã đứt. Đặt ngoài /api nên không chịu
// generalLimiter.
app.get('/health', getHealth);

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
// Geo proxy có limiter riêng gắn trong routes/geo.js (tile cần ngưỡng rộng hơn
// nhiều), nên không bọc generalLimiter ở đây để hai limiter không chồng nhau.
app.use('/api/geo', geoRoutes);
app.use('/api/meta', generalLimiter, metaRoutes);
app.use('/api/app', generalLimiter, appRoutes);

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

// Cron khởi động theo sự kiện kết nối, KHÔNG nằm trong nhánh .then() của
// connectDB(). Trước đây nếu MongoDB lỗi lúc boot (rất hay gặp khi Atlas free tier
// ngủ đông đúng lúc deploy) thì Mongoose vẫn tự reconnect ở tầng driver và HTTP
// hoạt động lại bình thường, nhưng cả 5 cron job im lặng VĨNH VIỄN vì không còn
// đường nào khởi động lại chúng: SLA nhắc hạn, điểm ưu tiên, dữ liệu môi trường,
// embedding và báo cáo định kỳ đều ngừng trong khi API vẫn trả 200.
// startCrons có cờ chống chạy trùng nên event 'connected' bắn lại sau mỗi lần
// reconnect cũng không nhân đôi số job.
mongoose.connection.on('connected', startCrons);

// Listen đúng MỘT lần và không phụ thuộc kết quả kết nối DB — /health cần phải
// sống thì monitor mới biết DB đang đứt.
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});

connectDB().catch((err) => {
  logger.error('Không kết nối được MongoDB', { reason: err.message });
  logger.warn('Server vẫn chạy: /health trả 503, cron tự khởi động khi DB kết nối được');
});

// Tắt có trật tự khi Render gửi SIGTERM lúc deploy — xem src/config/shutdown.js.
registerShutdownHandlers({ server, io, mongoose });

module.exports = { app, server };
