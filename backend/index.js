require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const chatRouter      = require('./routes/chat');
const healthRouter    = require('./routes/health');
const historyRouter   = require('./routes/history');
const questionsRouter = require('./routes/questions');
const loopsRouter     = require('./routes/loops');
const usersRouter     = require('./routes/users');
const accessRouter    = require('./routes/access');
const adminRouter     = require('./routes/admin');
const publicRouter    = require('./routes/public');

const { verifyAppCheck } = require('./middleware/appCheck');

const app = express();
app.set('trust proxy', 1); // Trust the Caddy reverse proxy (one hop) for correct client IPs in rate limiting
const PORT = process.env.PORT || 8080;

// ── Security Middleware ────────────────────────────────────────
app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

// ── Rate Limiting ──────────────────────────────────────────────
// Global IP-based limiter (wide net)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // Reduced back down to 150 to save AWS costs for production
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in 15 minutes.' },
  skip: (req) => {
    // Big Company Strategy 1: Bypass completely for local development loopback IPs
    const isLocalhost = req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';
    return isLocalhost;
  }
});

app.use('/api/', apiLimiter);

// ── App Check — must come from the real frontend app ──────────
// Skipped for the health check (monitoring tools need this unauthenticated)
app.use('/api/', (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/health/')) return next();
  verifyAppCheck(req, res, next);
});

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/chat',      chatRouter);
// Public routes (no auth needed)
app.use('/api/public', publicRouter);

app.use('/api/health',    healthRouter);
app.use('/api/history',   historyRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/loops',     loopsRouter);
app.use('/api/users',     usersRouter);
app.use('/api/access',    accessRouter);
app.use('/api/admin',     adminRouter);

app.get('/', (req, res) => {
  res.json({ message: '🎯 One Point Interview AI', status: 'running', version: '1.0.0' });
});

// ── Global Error Handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || undefined,
  });
});

// ── 404 Handler ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
