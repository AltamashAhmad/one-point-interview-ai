const express = require('express');
const router  = express.Router();
const { verifyToken, forgetVerifiedUser } = require('../middleware/auth');
const { requireAdmin }  = require('../middleware/requireAdmin');
const { evictCache, invalidatePlatformSettings } = require('../middleware/checkUserAccess');
const {
  sendApprovalEmail,
  sendDenialEmail,
  sendSuspensionEmail,
} = require('../services/emailService');
const admin = require('../config/firebase');
const logger = require('../utils/logger');
const { searchWords } = require('../services/userSearch');

const db  = admin.firestore();
const { AggregateField } = admin.firestore;

const PAGE_SIZE = 20;
const REQUEST_PAGE_SIZE = 20;
const MAX_REASON_CHARS = 500; // matches the limit on a user's own access-request message
const SEARCH_LIMIT = 200; // per search query; larger result sets are flagged as truncated
const USER_STATUSES = ['ALL', 'PENDING', 'APPROVED', 'BANNED', 'SUSPENDED'];
const REQUEST_STATUSES = ['pending', 'approved', 'denied', 'all'];

// Firestore reports a query whose composite index is missing or still building as FAILED_PRECONDITION (code 9).
function listError(err, req, res, next) {
  if (err.code !== 9) return next(err);
  logger.error('Admin list needs a Firestore index', { requestId: req.id, err: err.message });
  const building = /currently building/i.test(err.message);
  return res.status(503).json({
    error: building
      ? 'This list is still being prepared. Try again in a few minutes.'
      : 'This list needs a Firestore index that is not deployed yet.',
    code: 'INDEX_REQUIRED',
    requestId: req.id,
  });
}

// All admin routes require a valid Firebase token + admin role
router.use(verifyToken, requireAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD STATS
// GET /api/admin/stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const users = db.collection('users');
    const count = (query) => query.count().get().then((snap) => snap.data().count);
    const [total, pending, approved, banned, suspended, unlimited, pendingRequests, totalAiCalls] = await Promise.all([
      count(users),
      count(users.where('status', '==', 'PENDING')),
      count(users.where('status', '==', 'APPROVED')),
      count(users.where('status', '==', 'BANNED')),
      count(users.where('status', '==', 'SUSPENDED')),
      count(users.where('isUnlimited', '==', true)),
      count(db.collection('accessRequests').where('status', '==', 'pending')),
      users.aggregate({ calls: AggregateField.sum('totalAiCalls') }).get().then((snap) => snap.data().calls || 0),
    ]);

    res.json({
      users: { total, pending, approved, banned, suspended, unlimited },
      pendingRequests,
      totalAiCalls,
    });
  } catch (err) { listError(err, req, res, next); }
});

// ─────────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT
// GET  /api/admin/users          → list all users (search, filter, paginate)
// GET  /api/admin/users/:uid     → single user detail
// PUT  /api/admin/users/:uid/status  → approve / suspend / ban / unban
// PUT  /api/admin/users/:uid/quota   → set daily limit / toggle unlimited
// POST /api/admin/users/:uid/reset-quota → reset daily counter
// ─────────────────────────────────────────────────────────────────────────────

router.get('/users', async (req, res, next) => {
  try {
    const status = String(req.query.status || 'ALL').toUpperCase();
    const search = String(req.query.search || '').trim().toLowerCase();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    if (!USER_STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status filter.', code: 'INVALID_REQUEST' });

    const users = db.collection('users');
    const byStatus = status === 'ALL' ? users : users.where('status', '==', status);
    const withSuperAdmin = (u) => ({
      ...u,
      isSuperAdmin: (u.email || '').trim().toLowerCase() === (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    });

    if (!search) {
      const [countSnap, pageSnap] = await Promise.all([
        byStatus.count().get(),
        byStatus.orderBy('createdAt', 'desc').offset((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).get(),
      ]);
      const list = pageSnap.docs.map((doc) => withSuperAdmin({ uid: doc.id, ...doc.data() }));
      return res.json({ users: list, total: countSnap.data().count, page, pageSize: PAGE_SIZE, truncated: false });
    }

    // Word-start match on the searchTokens array (email and name), plus an exact uid.
    // The last typed word drives the indexed query; every typed word must match in memory.
    const words = searchWords(search);
    const rawId = String(req.query.search || '').trim();
    const idMatch = /^[A-Za-z0-9_-]{1,128}$/.test(rawId) ? users.doc(rawId).get() : null;
    const wordMatch = words.length
      ? users.where('searchTokens', 'array-contains', words[words.length - 1]).limit(SEARCH_LIMIT).get()
      : null;
    const [byWord, byId] = await Promise.all([wordMatch, idMatch]);

    const matches = new Map();
    byWord?.forEach((doc) => {
      const tokens = doc.data().searchTokens || [];
      if (words.every((word) => tokens.includes(word))) matches.set(doc.id, { uid: doc.id, ...doc.data() });
    });
    if (byId?.exists) matches.set(byId.id, { uid: byId.id, ...byId.data() });

    const sorted = [...matches.values()]
      .filter((u) => status === 'ALL' || u.status === status)
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const start = (page - 1) * PAGE_SIZE;
    res.json({
      users: sorted.slice(start, start + PAGE_SIZE).map(withSuperAdmin),
      total: sorted.length,
      page,
      pageSize: PAGE_SIZE,
      truncated: Boolean(byWord && byWord.size >= SEARCH_LIMIT),
    });
  } catch (err) { listError(err, req, res, next); }
});

router.get('/users/:uid', async (req, res, next) => {
  try {
    const doc = await db.collection('users').doc(req.params.uid).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { uid: doc.id, ...doc.data() } });
  } catch (err) { next(err); }
});

router.delete('/users/:uid', async (req, res, next) => {
  try {
    const { uid } = req.params;
    
    // Safety check - don't let admin delete themselves
    if (uid === req.user.uid) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const userDoc = await db.collection('users').doc(uid).get();
    const profile = userDoc.data();
    if ((profile?.email || '').trim().toLowerCase() === (process.env.ADMIN_EMAIL || '').trim().toLowerCase()) {
      return res.status(403).json({ error: 'The Super Admin cannot be deleted!' });
    }

    // 1. Delete from Firebase Auth
    try {
      await admin.auth().deleteUser(uid);
    } catch (authErr) {
      if (authErr.code !== 'auth/user-not-found') {
        throw authErr;
      }
    }
    forgetVerifiedUser(uid);
    evictCache(uid);

    // 2. Delete the profile together with its subcollections (study tracker items).
    await db.recursiveDelete(db.collection('users').doc(uid));

    // 3. Clean up the user's other records in the background so the response isn't blocked.
    const cleanup = async () => {
      const deleteAll = async (query) => {
        const snapshot = await query.get();
        // A committed batch can't be reused, and Firestore caps a batch at 500 writes.
        for (let i = 0; i < snapshot.docs.length; i += 400) {
          const batch = db.batch();
          snapshot.docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      };
      const byUser = ['sessions', 'interviews', 'tutor_interviews', 'roadmap_interviews', 'loop_interviews', 'loops'];
      const results = await Promise.allSettled([
        ...byUser.map((name) => deleteAll(db.collection(name).where('userId', '==', uid))),
        deleteAll(db.collection('accessRequests').where('uid', '==', uid)),
      ]);
      results
        .filter((r) => r.status === 'rejected')
        .forEach((r) => logger.error('User data cleanup failed', { uid, err: r.reason?.message }));
    };
    cleanup();

    res.json({ success: true, message: 'User deleted permanently' });
  } catch (err) { next(err); }
});

router.put('/users/:uid/status', async (req, res, next) => {
  try {
    const { uid }    = req.params;
    const { action, suspendDays, reason } = req.body || {};

    if (!['approve', 'suspend', 'ban', 'unban', 'unsuspend', 'promote', 'demote'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    if (reason !== undefined && reason !== null && (typeof reason !== 'string' || reason.length > MAX_REASON_CHARS)) {
      return res.status(400).json({ error: `reason must be text of at most ${MAX_REASON_CHARS} characters.`, code: 'INVALID_REQUEST' });
    }

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    const profile = userDoc.data();

    let update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    if (action === 'promote') {
      update.role = 'admin';
      update.isUnlimited = true;
    }

    if (action === 'demote') {
      if (uid === req.user.uid) {
        return res.status(400).json({ error: 'You cannot demote yourself. Ask another admin to do it.' });
      }
      if (profile.email === process.env.ADMIN_EMAIL) {
        return res.status(403).json({ error: 'The Super Admin (Supreme Leader) cannot be demoted!' });
      }
      update.role = 'user';
    }

    if (action === 'approve') {
      update.status    = 'APPROVED';
      update.approvedAt = admin.firestore.FieldValue.serverTimestamp();
      update.approvedBy = req.user.uid;

      // Also mark any pending request as approved
      if (profile.accessRequestId) {
        await db.collection('accessRequests').doc(profile.accessRequestId).update({
          status: 'approved', reviewedAt: admin.firestore.FieldValue.serverTimestamp(), reviewedBy: req.user.uid,
        });
      }

      // Send approval email (fire-and-forget)
      sendApprovalEmail({
        email: profile.email, displayName: profile.displayName, dailyLimit: profile.dailyLimit,
      }).catch(e => logger.error('Email send failed', { template: 'approval', err: e.message }));
    }

    if (action === 'ban') {
      if (profile.email === process.env.ADMIN_EMAIL) {
        return res.status(403).json({ error: 'The Super Admin cannot be banned!' });
      }
      update.status    = 'BANNED';
      update.banReason = reason || 'No reason provided';
    }

    if (action === 'unban') {
      update.status    = 'PENDING';
      update.banReason = null;
    }

    if (action === 'suspend') {
      if (profile.email === process.env.ADMIN_EMAIL) {
        return res.status(403).json({ error: 'The Super Admin cannot be suspended!' });
      }
      const days = Math.max(1, Math.min(365, Number(suspendDays) || 7));
      const until = new Date();
      until.setDate(until.getDate() + days);
      update.status         = 'SUSPENDED';
      update.suspendedUntil = until.toISOString();
      update.suspendNote    = reason || null;

      sendSuspensionEmail({
        email: profile.email, displayName: profile.displayName,
        suspendedUntil: until.toISOString(), reason,
      }).catch(e => logger.error('Email send failed', { template: 'suspension', err: e.message }));
    }

    if (action === 'unsuspend') {
      update.status         = 'APPROVED';
      update.suspendedUntil = null;
      update.suspendNote    = null;
    }

    await db.collection('users').doc(uid).update(update);
    evictCache(uid);

    res.json({ success: true, action, uid });
  } catch (err) { next(err); }
});

router.put('/users/:uid/quota', async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { dailyLimit, isUnlimited } = req.body;

    const userDoc = await db.collection('users').doc(uid).get();
    const profile = userDoc.data();

    if (profile?.email === process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'The Super Admin cannot have their unlimited access modified!' });
    }

    const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    if (typeof isUnlimited === 'boolean') update.isUnlimited = isUnlimited;
    if (typeof dailyLimit  === 'number'  && dailyLimit >= 1 && dailyLimit <= 10000) {
      update.dailyLimit = dailyLimit;
    }

    if (!('isUnlimited' in update) && !('dailyLimit' in update)) {
      return res.status(400).json({ error: 'Provide dailyLimit or isUnlimited' });
    }

    await db.collection('users').doc(uid).update(update);
    evictCache(uid);

    res.json({ success: true, uid, ...update });
  } catch (err) { next(err); }
});

router.post('/users/:uid/reset-quota', async (req, res, next) => {
  try {
    const { uid } = req.params;
    const today   = new Date().toISOString().split('T')[0];
    await db.collection('users').doc(uid).update({
      dailyCallsUsed:      0,
      dailyCallsResetDate: today,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    evictCache(uid);
    res.json({ success: true, uid });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ACCESS REQUESTS
// GET /api/admin/requests
// PUT /api/admin/requests/:id/approve
// PUT /api/admin/requests/:id/deny
// ─────────────────────────────────────────────────────────────────────────────

router.get('/requests', async (req, res, next) => {
  try {
    const status = String(req.query.status || 'pending');
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    if (!REQUEST_STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status filter.', code: 'INVALID_REQUEST' });

    const base = db.collection('accessRequests');
    const filtered = status === 'all' ? base : base.where('status', '==', status);
    const [countSnap, pageSnap] = await Promise.all([
      filtered.count().get(),
      filtered.orderBy('createdAt', 'desc').offset((page - 1) * REQUEST_PAGE_SIZE).limit(REQUEST_PAGE_SIZE).get(),
    ]);
    res.json({
      requests: pageSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      total: countSnap.data().count,
      page,
      pageSize: REQUEST_PAGE_SIZE,
    });
  } catch (err) { listError(err, req, res, next); }
});

router.put('/requests/:id/approve', async (req, res, next) => {
  try {
    const requestDoc = await db.collection('accessRequests').doc(req.params.id).get();
    if (!requestDoc.exists) return res.status(404).json({ error: 'Request not found' });

    const request = requestDoc.data();
    const now     = admin.firestore.FieldValue.serverTimestamp();

    // Update request status
    await db.collection('accessRequests').doc(req.params.id).update({
      status: 'approved', reviewedAt: now, reviewedBy: req.user.uid,
    });

    // Update user status
    const userRef = db.collection('users').doc(request.uid);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      const profile = userDoc.data();
      await userRef.update({
        status: 'APPROVED', approvedAt: now, approvedBy: req.user.uid,
        updatedAt: now,
      });
      evictCache(request.uid);

      sendApprovalEmail({
        email: profile.email, displayName: profile.displayName, dailyLimit: profile.dailyLimit,
      }).catch(e => logger.error('Email send failed', { template: 'approval', err: e.message }));
    }

    res.json({ success: true, requestId: req.params.id });
  } catch (err) { next(err); }
});

router.put('/requests/:id/deny', async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    if (reason !== undefined && reason !== null && (typeof reason !== 'string' || reason.length > MAX_REASON_CHARS)) {
      return res.status(400).json({ error: `reason must be text of at most ${MAX_REASON_CHARS} characters.`, code: 'INVALID_REQUEST' });
    }
    const requestDoc = await db.collection('accessRequests').doc(req.params.id).get();
    if (!requestDoc.exists) return res.status(404).json({ error: 'Request not found' });

    const request = requestDoc.data();
    const now     = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('accessRequests').doc(req.params.id).update({
      status: 'denied', reviewedAt: now, reviewedBy: req.user.uid, reviewNote: reason || null,
    });

    // Get user profile for email
    const userDoc = await db.collection('users').doc(request.uid).get();
    if (userDoc.exists) {
      const profile = userDoc.data();
      sendDenialEmail({
        email: profile.email, displayName: profile.displayName, reason,
      }).catch(e => logger.error('Email send failed', { template: 'denial', err: e.message }));
    }

    res.json({ success: true, requestId: req.params.id });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM SETTINGS
// GET /api/admin/settings
// PUT /api/admin/settings
// ─────────────────────────────────────────────────────────────────────────────

router.get('/settings', async (req, res, next) => {
  try {
    const doc = await db.collection('platformSettings').doc('main').get();
    const settings = doc.exists ? doc.data() : {
      allowNewSignups:   true,
      maintenanceMode:   false,
      freeTrialLimit:    3,
      defaultDailyLimit: 20,
    };
    res.json({ settings });
  } catch (err) { next(err); }
});

router.put('/settings', async (req, res, next) => {
  try {
    const allowed = ['allowNewSignups', 'maintenanceMode', 'freeTrialLimit', 'defaultDailyLimit'];
    const update  = {};
    for (const key of allowed) {
      if (key in req.body) update[key] = req.body[key];
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No valid settings fields provided' });
    }
    update.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    update.updatedBy = req.user.uid;

    await db.collection('platformSettings').doc('main').set(update, { merge: true });
    invalidatePlatformSettings();
    res.json({ success: true, settings: update });
  } catch (err) { next(err); }
});

module.exports = router;
