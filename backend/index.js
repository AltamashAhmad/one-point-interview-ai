require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('./config/env').validateEnv();

const { createApp } = require('./app');
const logger = require('./utils/logger');
const lifecycle = require('./utils/lifecycle');

const PORT = process.env.PORT || 8080;
// Long enough for an in-flight AI reply (SSE stream) to finish; PM2/ECS kill after their own timeout.
const SHUTDOWN_GRACE_MS = 25_000;

const server = createApp().listen(PORT, () => {
  logger.info('server started', { port: PORT, env: process.env.NODE_ENV || 'development' });
});

function shutdown(signal) {
  if (lifecycle.isShuttingDown()) return;
  lifecycle.markShuttingDown();
  logger.info('shutting down', { signal });
  server.close(() => {
    logger.info('all connections closed');
    process.exit(0);
  });
  server.closeIdleConnections?.();
  setTimeout(() => {
    logger.warn('forcing exit after grace period');
    process.exit(1);
  }, SHUTDOWN_GRACE_MS).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('unhandled promise rejection', { error: reason instanceof Error ? reason.stack : String(reason) });
});
