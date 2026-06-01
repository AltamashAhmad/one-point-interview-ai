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
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in 15 minutes.' },
});

// Per-user limiter on the expensive AI endpoint (prevents one account from
// consuming the entire IP quota behind a shared network / VPN)
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,                    // 30 AI requests per user per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  // Key by Firebase UID attached by verifyToken (falls back to IP before auth)
  keyGenerator: (req) => req.user?.uid || ipKeyGenerator(req),
  skip: (req) => !req.user, // auth middleware runs first on the route
  message: { error: 'Too many chat requests. Please wait 15 minutes before sending more.' },
});

app.use('/api/', apiLimiter);

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/chat',      chatLimiter, chatRouter);
app.use('/api/health',    healthRouter);
app.use('/api/history',   historyRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/loops',     loopsRouter);

app.get('/', (req, res) => {
  res.json({ message: '🎯 One Point Interview AI', status: 'running', version: '1.0.0' });
});

// ── Global Error Handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ── 404 Handler ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
