const admin = require('../config/firebase');

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
    const decodedToken = await admin.auth().verifyIdToken(idToken, /* checkRevoked */ true);
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

module.exports = { verifyToken };
