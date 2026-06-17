const admin = require('../config/firebase');
const db    = admin.firestore();

/**
 * requireAdmin — middleware that verifies the caller has role: 'admin' in Firestore.
 *
 * Must be placed AFTER verifyToken so req.user is populated.
 * Checks Firestore directly (not just a custom claim) so that admin revocation
 * takes effect within the 60-second Firestore cache window.
 *
 * Returns 403 for non-admins instead of a more informative error to avoid
 * leaking the existence of the admin panel.
 */
async function requireAdmin(req, res, next) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists || doc.data().role !== 'admin') {
      // Return the same 403 as a generic page to not hint the route exists
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Attach profile to request for downstream handlers
    req.adminProfile = doc.data();
    next();
  } catch (err) {
    console.error('[requireAdmin]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { requireAdmin };
