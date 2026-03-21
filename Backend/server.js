const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const connectDB = require('./src/config/db');
const { initSocket } = require('./src/config/socket');
const errorHandler = require('./src/middleware/errorHandler');
const { startEnvironmentCron } = require('./src/jobs/environmentCron');

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

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = initSocket(server);

// Make io accessible in controllers via req.app
app.set('io', io);

// ============ MIDDLEWARE ============

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// ============ ROUTES ============

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Smart City Dashboard API is running',
    version: '1.0.0'
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/issues', generalLimiter, issueRoutes);
app.use('/api/places', generalLimiter, placeRoutes);
app.use('/api/environment', generalLimiter, environmentRoutes);
app.use('/api/traffic', generalLimiter, trafficRoutes);
app.use('/api/users', generalLimiter, userRoutes);
app.use('/api/dashboard', generalLimiter, dashboardRoutes);
app.use('/api/issues/:issueId/comments', generalLimiter, commentRoutes);
app.use('/api/notifications', generalLimiter, notificationRoutes);

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
