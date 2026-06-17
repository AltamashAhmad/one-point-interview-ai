const express = require('express');
const router  = express.Router();
const { verifyToken } = require('../middleware/auth');
const admin = require('../config/firebase');

const db = admin.firestore();

/**
 * GET /api/users/me
 *
 * Returns the current user's profile from Firestore.
 * Auto-creates the profile if this is the user's first login.
 * Called by AuthContext on every login to populate userProfile in React.
 */
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const doc = await db.collection('users').doc(uid).get();

    if (!doc.exists) {
      // First login — create profile with PENDING status
      const today = new Date().toISOString().split('T')[0];
      const now   = admin.firestore.FieldValue.serverTimestamp();

      // Get platform settings for defaults
      let freeTrialLimit = 3;
      let defaultDailyLimit = 20;
      try {
        const settingsDoc = await db.collection('platformSettings').doc('main').get();
        if (settingsDoc.exists) {
          freeTrialLimit    = settingsDoc.data().freeTrialLimit    ?? 3;
          defaultDailyLimit = settingsDoc.data().defaultDailyLimit ?? 20;
        }
      } catch { /* use defaults */ }

      const newProfile = {
        uid,
        email:               req.user.email       || null,
        displayName:         req.user.name         || req.user.displayName || null,
        photoURL:            req.user.picture      || req.user.photoURL    || null,
        role:                'user',
        status:              'PENDING',
        isUnlimited:         false,
        dailyLimit:          defaultDailyLimit,
        freeTrialUsed:       0,
        freeTrialLimit,
        dailyCallsUsed:      0,
        dailyCallsResetDate: today,
        totalAiCalls:        0,
        banReason:           null,
        suspendedUntil:      null,
        suspendNote:         null,
        accessRequestId:     null,
        createdAt:           now,
        approvedAt:          null,
        approvedBy:          null,
      };

      await db.collection('users').doc(uid).set(newProfile);

      return res.json({
        profile: {
          ...newProfile,
          createdAt: new Date().toISOString(),
          // remaining trial count for the frontend
          freeTrialRemaining: freeTrialLimit,
        },
      });
    }

    const profile = doc.data();

    // Calculate remaining free trial (for UI display)
    const freeTrialRemaining = Math.max(
      0,
      (profile.freeTrialLimit ?? 3) - (profile.freeTrialUsed ?? 0)
    );

    // Daily quota info
    const dailyCallsRemaining = profile.isUnlimited
      ? Infinity
      : Math.max(0, (profile.dailyLimit ?? 20) - (profile.dailyCallsUsed ?? 0));

    return res.json({
      profile: {
        ...profile,
        // Computed fields for frontend convenience
        freeTrialRemaining,
        dailyCallsRemaining,
      },
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
