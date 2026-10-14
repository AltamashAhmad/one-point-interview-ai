/**
 * Errors created here are safe to show to users (`expose: true`).
 * Anything else reaching the global error handler is treated as an internal failure.
 */
function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  if (code) err.code = code;
  return err;
}

const logger = require('./logger');

const GENERIC_SERVER_MESSAGE = 'Something went wrong on our side. Please try again.';

function errorHandler(err, req, res, _next) {
  const exposed = err.expose === true;
  const status = exposed ? (err.status || err.statusCode || 400) : 500;
  const context = { requestId: req.id, method: req.method, path: req.originalUrl, status };

  if (status >= 500) {
    logger.error(err.message, { ...context, stack: err.stack });
  } else {
    logger.warn(err.message, { ...context, code: err.code });
  }

  if (res.headersSent) return;
  res.status(status).json({
    error: exposed ? err.message : GENERIC_SERVER_MESSAGE,
    code: exposed ? err.code : 'INTERNAL_ERROR',
    ...(req.id && { requestId: req.id }),
    ...(err.retryAfter && { retryAfter: err.retryAfter }),
    ...(exposed && err.details && { details: err.details }),
  });
}

module.exports = { httpError, errorHandler, GENERIC_SERVER_MESSAGE };
