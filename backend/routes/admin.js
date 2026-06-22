const express = require('express');
const router  = express.Router();
const { verifyToken }   = require('../middleware/auth');
const { requireAdmin }  = require('../middleware/requireAdmin');
const { evictCache }    = require('../middleware/checkUserAccess');
const {
  sendApprovalEmail,
  sendDenialEmail,
  sendSuspensionEmail,
} = require('../services/emailService');
const admin = require('../config/firebase');

const db  = admin.firestore();

// All admin routes require a valid Firebase token + admin role
router.use(verifyToken, requireAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD STATS
// GET /api/admin/stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const [usersSnap, requestsSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('accessRequests').where('status', '==', 'pending').get(),
    ]);

    const counts = { total: 0, pending: 0, approved: 0, banned: 0, suspended: 0, unlimited: 0 };
    let totalAiCalls = 0;

    usersSnap.forEach(doc => {
      const d = doc.data();
      counts.total++;
      if (d.status === 'PENDING')   counts.pending++;
      if (d.status === 'APPROVED')  counts.approved++;
      if (d.status === 'BANNED')    counts.banned++;
      if (d.status === 'SUSPENDED') counts.suspended++;
      if (d.isUnlimited)            counts.unlimited++;
      totalAiCalls += d.totalAiCalls || 0;
    });

    res.json({
      users: counts,
      pendingRequests: requestsSnap.size,
      totalAiCalls,
    });
  } catch (err) { next(err); }
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
    const { status, search, page = 1 } = req.query;
    const PAGE_SIZE = 20;

    let query = db.collection('users');

    if (status && status !== 'ALL') {
      query = query.where('status', '==', status.toUpperCase());
    }

    const snap = await query.limit(200).get(); // cap at 200 for now
    let users = [];
    snap.forEach(doc => users.push({ uid: doc.id, ...doc.data() }));

    // Sort in-memory to avoid requiring a Firestore composite index (status + createdAt)
    users.sort((a, b) => {
      const tA = a.createdAt?.toMillis?.() || 0;
      const tB = b.createdAt?.toMillis?.() || 0;
      return tB - tA; // desc
    });

    // Client-side search (works across email + displayName)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      users = users.filter(u =>
        (u.email       || '').toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.uid         || '').toLowerCase().includes(q)
      );
    }

    const total = users.length;
    const start = (Number(page) - 1) * PAGE_SIZE;
    const paged = users.slice(start, start + PAGE_SIZE).map(u => ({
      ...u,
      isSuperAdmin: u.email === process.env.ADMIN_EMAIL
    }));

    res.json({ users: paged, total, page: Number(page), pageSize: PAGE_SIZE });
  } catch (err) { next(err); }
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
    if (profile?.email === process.env.ADMIN_EMAIL) {
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

    // 2. Delete the user profile from Firestore
    await db.collection('users').doc(uid).delete();

    // 3. Clean up other records asynchronously to not block the response
    const cleanup = async () => {
      try {
        const batch = db.batch();
        let ops = 0;

        const cleanupQuery = async (query) => {
          const snapshot = await query.get();
          for (const doc of snapshot.docs) {
            batch.delete(doc.ref);
            ops++;
            if (ops >= 400) {
              await batch.commit();
              ops = 0;
            }
          }
        };

        await cleanupQuery(db.collection('interviews').where('userId', '==', uid));
        await cleanupQuery(db.collection('loops').where('userId', '==', uid));
        await cleanupQuery(db.collection('accessRequests').where('uid', '==', uid));

        if (ops > 0) await batch.commit();
      } catch (err) {
        console.error('[Admin] Cleanup failed for user', uid, err.message);
      }
    };
    cleanup();

    res.json({ success: true, message: 'User deleted permanently' });
  } catch (err) { next(err); }
});

router.put('/users/:uid/status', async (req, res, next) => {
  try {
    const { uid }    = req.params;
    const { action, suspendDays, reason } = req.body;

    if (!['approve', 'suspend', 'ban', 'unban', 'unsuspend', 'promote', 'demote'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
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
      }).catch(e => console.error('[Email] approval:', e.message));
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
      }).catch(e => console.error('[Email] suspension:', e.message));
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
    const { status = 'pending' } = req.query;

    let query = db.collection('accessRequests');
    if (status !== 'all') {
      query = query.where('status', '==', status);
    }

    const snap = await query.limit(100).get();
    const requests = [];
    snap.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));

    // Sort in-memory to avoid requiring a Firestore composite index (status + createdAt)
    requests.sort((a, b) => {
      const getMs = (t) => {
        if (!t) return 0;
        if (typeof t.toMillis === 'function') return t.toMillis();
        if (t._seconds) return t._seconds * 1000;
        if (typeof t === 'string' || typeof t === 'number') return new Date(t).getTime();
        return 0;
      };
      return getMs(b.createdAt) - getMs(a.createdAt);
    });

    res.json({ requests });
  } catch (err) { next(err); }
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
      }).catch(e => console.error('[Email] approval:', e.message));
    }

    res.json({ success: true, requestId: req.params.id });
  } catch (err) { next(err); }
});

router.put('/requests/:id/deny', async (req, res, next) => {
  try {
    const { reason } = req.body;
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
      }).catch(e => console.error('[Email] denial:', e.message));
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
    res.json({ success: true, settings: update });
  } catch (err) { next(err); }
});

module.exports = router;
