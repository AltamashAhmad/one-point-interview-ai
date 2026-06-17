const admin = require('../config/firebase');

/**
 * Firebase App Check verification middleware.
 *
 * Verifies the X-Firebase-AppCheck header sent by the frontend.
 * App Check ensures requests originate from your real React app,
 * not from Postman, curl, or scrapers that found your Firebase config.
 *
 * Development bypass:
 *   Set SKIP_APP_CHECK=true in backend/.env to skip verification locally.
 *   In production this must NEVER be set to true.
 *
 * Frontend setup:
 *   The frontend attaches the token via X-Firebase-AppCheck header
 *   using firebase/app-check's getToken() API.
 */
async function verifyAppCheck(req, res, next) {
  // ── Development bypass ─────────────────────────────────────────────────────
  if (process.env.SKIP_APP_CHECK === 'true') {
    // Only log this warning once per server start, not on every request
    return next();
  }

  const appCheckToken = req.headers['x-firebase-appcheck'];

  if (!appCheckToken) {
    return res.status(401).json({
      error: 'App Check token missing. Requests must originate from the official app.',
    });
  }

  try {
    // consumeToken=false: we verify but don't consume the token (allows reuse within TTL)
    const appCheckClaims = await admin.appCheck().verifyToken(appCheckToken);
    // Attach the App ID for logging if needed
    req.appCheckAppId = appCheckClaims.appId;
    next();
  } catch (err) {
    console.warn(`[AppCheck] Rejected invalid token — ${err.message}`);
    return res.status(401).json({
      error: 'App Check verification failed. Access denied.',
    });
  }
}

module.exports = { verifyAppCheck };
