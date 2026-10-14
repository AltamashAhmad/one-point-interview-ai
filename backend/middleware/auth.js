const admin = require('../config/firebase');

// Checking revocation is a network call to Firebase Auth (~1.5s); the signature check is local.
// Re-check revocation at most every 5 minutes per user. Bans are enforced separately via the profile.
const REVOCATION_CHECK_TTL_MS = 5 * 60_000;
const MAX_TRACKED_USERS = 10_000;
const revocationCheckedAt = new Map(); // uid -> ms timestamp

/** Forces the next request from this user to re-check revocation (e.g. after an admin deletes them). */
function forgetVerifiedUser(uid) {
  revocationCheckedAt.delete(uid);
}

/**
 * Express middleware to verify Firebase ID tokens.
 * Attaches decoded user info to req.user if valid.
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed. Expected: Bearer <token>' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  if (!idToken) {
    return res.status(401).json({ error: 'Token not found in Authorization header' });
  }

  try {
    let decodedToken = await admin.auth().verifyIdToken(idToken);
    const checkedAt = revocationCheckedAt.get(decodedToken.uid);
    if (!checkedAt || Date.now() - checkedAt > REVOCATION_CHECK_TTL_MS) {
      decodedToken = await admin.auth().verifyIdToken(idToken, /* checkRevoked */ true);
      if (revocationCheckedAt.size >= MAX_TRACKED_USERS) revocationCheckedAt.clear();
      revocationCheckedAt.set(decodedToken.uid, Date.now());
    }
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
    next();
  } catch (error) {
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please sign in again.' });
    }
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ error: 'Session revoked. Please sign in again.' });
    }
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
}

module.exports = { verifyToken, forgetVerifiedUser };
