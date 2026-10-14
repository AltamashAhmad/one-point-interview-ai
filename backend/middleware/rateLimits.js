const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const isLocalhost = (req) => req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';

/** Per-user limiter for AI-backed endpoints; admins and unlimited accounts are exempt. */
function aiLimiter({ max, message }) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.uid || ipKeyGenerator(req),
    skip: (req) => req.userProfile?.role === 'admin' || req.userProfile?.isUnlimited === true || isLocalhost(req),
    message: { error: message, code: 'RATE_LIMITED' },
  });
}

module.exports = { aiLimiter };
