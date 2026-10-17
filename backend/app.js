const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const healthRouter    = require('./routes/health');
const questionsRouter = require('./routes/questions');
const loopsRouter     = require('./routes/loops');
const usersRouter     = require('./routes/users');
const accessRouter    = require('./routes/access');
const adminRouter     = require('./routes/admin');
const promptsRouter   = require('./routes/prompts');
const publicRouter    = require('./routes/public');
const trackerRouter   = require('./routes/tracker');
const metaRouter      = require('./routes/meta');
const sessionsRouter  = require('./routes/sessions');

const { verifyAppCheck } = require('./middleware/appCheck');
const { requestContext } = require('./middleware/requestContext');
const { httpError, errorHandler } = require('./utils/httpError');
const { version: APP_VERSION } = require('./package.json');

const AMPLIFY_ORIGINS = [
  'https://main.d298ess3vvx0bm.amplifyapp.com',
  'https://main.d3qqncmpm1ahwz.amplifyapp.com',
  'https://main.d369q8sr84jlxa.amplifyapp.com',
];
const isLoopback = (ip) => ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';

/** Builds the Express app (no network listener) so the full middleware stack can be tested. */
function createApp() {
  const app = express();
  app.set('trust proxy', 1); // one hop: the Caddy reverse proxy
  app.disable('x-powered-by');

  app.use(requestContext);
  app.use(helmet());

  const allowedOrigins = [
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()) : ['http://localhost:3000']),
    ...AMPLIFY_ORIGINS,
  ];
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(httpError(403, 'Origin not allowed.', 'CORS_BLOCKED'));
    },
    credentials: true,
    exposedHeaders: ['X-Request-Id', 'RateLimit-Remaining', 'Retry-After'],
  }));

  app.use(express.json({ limit: '2mb' }));

  // Wide per-IP net; per-feature AI limits live in middleware/rateLimits.js.
  app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 150,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again in 15 minutes.', code: 'RATE_LIMITED' },
    skip: (req) => isLoopback(req.ip),
  }));

  // Monitoring probes must work without the App Check token.
  app.use('/api/', (req, res, next) => {
    if (req.path === '/health' || req.path.startsWith('/health/')) return next();
    verifyAppCheck(req, res, next);
  });

  app.use('/api/public',    publicRouter);
  app.use('/api/health',    healthRouter);
  app.use('/api/questions', questionsRouter);
  app.use('/api/loops',     loopsRouter);
  app.use('/api/users',     usersRouter);
  app.use('/api/access',    accessRouter);
  app.use('/api/admin',     adminRouter);
  app.use('/api/prompts',   promptsRouter);
  app.use('/api/tracker',   trackerRouter);
  app.use('/api/meta',      metaRouter);
  app.use('/api/sessions',  sessionsRouter);

  app.get('/', (req, res) => res.json({ service: 'One Point Interview AI', status: 'running', version: APP_VERSION }));
  app.get('/api/public/version', (req, res) => res.json({ version: APP_VERSION }));

  app.use((req, res) => res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND', requestId: req.id }));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
