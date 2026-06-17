const express = require('express');
const router  = express.Router();
const { verifyToken }              = require('../middleware/auth');
const { sendAccessRequestEmail }   = require('../services/emailService');
const admin = require('../config/firebase');

const db = admin.firestore();

// ── Input validation ──────────────────────────────────────────────────────────
const VALID_PURPOSES = ['job_prep', 'learning', 'academic', 'other'];

/**
 * POST /api/access/request
 *
 * Submit a full-access request. Only available to PENDING users who have
 * exhausted their free trial. Blocked if a pending request already exists.
 *
 * Body: { purpose: string, reason?: string }
 */
router.post('/request', verifyToken, async (req, res, next) => {
  try {
    const uid = req.user.uid;

    // ── Load user profile ──────────────────────────────────────────────────
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found. Please sign out and back in.' });
    }

    const profile = userDoc.data();

    // ── Only PENDING users can submit requests ─────────────────────────────
    if (profile.status === 'APPROVED') {
      return res.status(400).json({ error: 'Your account is already approved.' });
    }
    if (profile.status === 'BANNED') {
      return res.status(403).json({ error: 'Banned accounts cannot submit access requests.' });
    }

    // ── Check for duplicate pending request ────────────────────────────────
    const existingQuery = await db.collection('accessRequests')
      .where('uid', '==', uid)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      const existing = existingQuery.docs[0].data();
      return res.status(409).json({
        error:     'You already have a pending access request.',
        requestId: existingQuery.docs[0].id,
        status:    existing.status,
        createdAt: existing.createdAt,
      });
    }

    // ── Validate input ─────────────────────────────────────────────────────
    const { purpose, reason = '' } = req.body;

    if (!purpose || !VALID_PURPOSES.includes(purpose)) {
      return res.status(400).json({
        error: `purpose must be one of: ${VALID_PURPOSES.join(', ')}`,
      });
    }
    if (reason && reason.length > 500) {
      return res.status(400).json({ error: 'reason must be 500 characters or less.' });
    }

    // ── Create the access request document ────────────────────────────────
    const now = admin.firestore.FieldValue.serverTimestamp();
    const requestData = {
      uid,
      email:       profile.email       || req.user.email       || null,
      displayName: profile.displayName || req.user.displayName || null,
      purpose,
      reason:      reason.trim() || null,
      status:      'pending',
      createdAt:   now,
      reviewedAt:  null,
      reviewedBy:  null,
      reviewNote:  null,
    };

    const docRef = await db.collection('accessRequests').add(requestData);

    // ── Link request ID back to the user doc ─────────────────────────────
    await db.collection('users').doc(uid).update({
      accessRequestId: docRef.id,
    });

    // ── Send email to admin (fire-and-forget — don't block the response) ──
    sendAccessRequestEmail({
      uid,
      email:       requestData.email,
      displayName: requestData.displayName,
      purpose,
      reason:      requestData.reason,
      requestId:   docRef.id,
    }).catch((err) => {
      console.error('[Access] Failed to send admin email:', err.message);
    });

    return res.status(201).json({
      success:   true,
      requestId: docRef.id,
      message:   'Your access request has been submitted. We\'ll review it shortly.',
    });

  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/access/status
 *
 * Returns the current access request status for the authenticated user.
 * Frontend polls this to detect when the admin has approved/denied.
 *
 * Response: { status: 'none'|'pending'|'approved'|'denied', request?: object }
 */
router.get('/status', verifyToken, async (req, res, next) => {
  try {
    const uid = req.user.uid;

    // Check user profile status first
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.json({ status: 'none' });
    }

    const profile = userDoc.data();

    // If already approved, no need to check request
    if (profile.status === 'APPROVED') {
      return res.json({ status: 'approved', userStatus: 'APPROVED' });
    }

    // Look up the most recent access request for this user
    const query = await db.collection('accessRequests')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (query.empty) {
      return res.json({ status: 'none', userStatus: profile.status });
    }

    const doc     = query.docs[0];
    const request = { id: doc.id, ...doc.data() };

    return res.json({
      status:     request.status,   // 'pending' | 'approved' | 'denied'
      userStatus: profile.status,
      request: {
        id:         request.id,
        purpose:    request.purpose,
        reason:     request.reason,
        status:     request.status,
        createdAt:  request.createdAt,
        reviewNote: request.reviewNote,
      },
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
