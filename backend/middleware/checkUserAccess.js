const admin = require('../config/firebase');
const db    = admin.firestore();

// ── In-memory cache so we don't hit Firestore on every single message ────────
// Entries expire after 60 seconds. Admin changes (ban, suspend, etc.) take
// effect within 1 minute — acceptable for our use case.
const userCache = new Map(); // uid → { profile, expiresAt }
const CACHE_TTL_MS = 60_000; // 60 seconds

function getCached(uid) {
  const entry = userCache.get(uid);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { userCache.delete(uid); return null; }
  return entry.profile;
}

function setCache(uid, profile) {
  userCache.set(uid, { profile, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Evict a user from cache so the next request gets fresh data.
// Called after any write operation (ban, approve, quota reset, etc.)
function evictCache(uid) {
  userCache.delete(uid);
}

// ── Platform settings cache (refreshed every 5 min) ──────────────────────────
let platformSettings = null;
let settingsExpiry = 0;

async function getPlatformSettings() {
  if (Date.now() < settingsExpiry && platformSettings) return platformSettings;
  try {
    const doc = await db.collection('platformSettings').doc('main').get();
    platformSettings = doc.exists
      ? doc.data()
      : { allowNewSignups: true, maintenanceMode: false, freeTrialLimit: 3, defaultDailyLimit: 20 };
    settingsExpiry = Date.now() + 5 * 60_000; // 5 minutes
  } catch {
    // Fall back to defaults if Firestore is unreachable
    platformSettings = { allowNewSignups: true, maintenanceMode: false, freeTrialLimit: 3, defaultDailyLimit: 20 };
  }
  return platformSettings;
}

// ── Auto-create user profile on first login ──────────────────────────────────
async function createUserProfile(uid, firebaseUser) {
  const settings = await getPlatformSettings();
  const today    = new Date().toISOString().split('T')[0];
  const now      = admin.firestore.FieldValue.serverTimestamp();

  const newProfile = {
    uid,
    email:               firebaseUser.email       || null,
    displayName:         firebaseUser.displayName || null,
    photoURL:            firebaseUser.photoURL    || null,
    role:                'user',
    status:              'PENDING',
    isUnlimited:         false,
    dailyLimit:          settings.defaultDailyLimit ?? 20,
    freeTrialUsed:       0,
    freeTrialLimit:      settings.freeTrialLimit   ?? 3,
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
  // Return a plain object (serverTimestamp not yet resolved)
  return { ...newProfile, createdAt: new Date().toISOString(), approvedAt: null };
}

/**
 * checkUserAccess — main access control middleware.
 *
 * Must be placed AFTER verifyToken so req.user is available.
 *
 * Decision tree:
 *   1. Load user profile from Firestore (cached 60s)
 *   2. Auto-create if missing (first login)
 *   3. BANNED      → 403 BANNED
 *   4. SUSPENDED   → check if suspension expired (auto-lift) → 403 SUSPENDED
 *   5. isUnlimited → skip all quota checks (admin/trusted users)
 *   6. PENDING     → enforce free trial limit (default: 3 calls)
 *   7. APPROVED    → enforce daily quota (default: 20 calls/day, resets at midnight UTC)
 *   8. Increment usage counters atomically and proceed
 */
async function checkUserAccess(req, res, next) {
  try {
    const uid = req.user.uid;

    // ── 1. Load user profile ───────────────────────────────────────────────
    let profile = getCached(uid);

    if (!profile) {
      const doc = await db.collection('users').doc(uid).get();

      if (!doc.exists) {
        // ── 2. First login — create profile ───────────────────────────────
        profile = await createUserProfile(uid, req.user);
      } else {
        profile = doc.data();
      }
      setCache(uid, profile);
    }

    // ── 3. BANNED check ───────────────────────────────────────────────────
    if (profile.status === 'BANNED') {
      return res.status(403).json({
        code:      'BANNED',
        error:     'Your account has been permanently banned.',
        banReason: profile.banReason || 'No reason provided.',
      });
    }

    // ── 4. SUSPENDED check (with auto-lift) ───────────────────────────────
    if (profile.status === 'SUSPENDED') {
      const until = profile.suspendedUntil?.toDate
        ? profile.suspendedUntil.toDate()
        : profile.suspendedUntil ? new Date(profile.suspendedUntil) : null;

      if (until && Date.now() >= until.getTime()) {
        // Suspension expired — auto-lift to APPROVED
        await db.collection('users').doc(uid).update({
          status:        'APPROVED',
          suspendedUntil: null,
          suspendNote:   null,
        });
        evictCache(uid);
        profile = { ...profile, status: 'APPROVED', suspendedUntil: null };
      } else {
        return res.status(403).json({
          code:           'SUSPENDED',
          error:          'Your account is temporarily suspended.',
          suspendedUntil: until ? until.toISOString() : null,
          suspendNote:    profile.suspendNote || null,
        });
      }
    }

    // ── 5. UNLIMITED bypass (admin and trusted users) ─────────────────────
    if (profile.isUnlimited === true) {
      // Increment total call count only (no quota enforcement)
      db.collection('users').doc(uid).update({
        totalAiCalls: admin.firestore.FieldValue.increment(1),
      }).catch(() => {}); // fire-and-forget, don't block the response
      req.userProfile = profile;
      return next();
    }

    // ── 6. PENDING — free trial enforcement ──────────────────────────────
    if (profile.status === 'PENDING') {
      const freeTrialLimit = profile.freeTrialLimit ?? 3;
      const freeTrialUsed  = profile.freeTrialUsed  ?? 0;

      if (freeTrialUsed >= freeTrialLimit) {
        return res.status(403).json({
          code:           'FREE_TRIAL_EXHAUSTED',
          error:          `You've used all ${freeTrialLimit} free sessions.`,
          freeTrialUsed,
          freeTrialLimit,
        });
      }

      // Atomically increment free trial usage
      await db.collection('users').doc(uid).update({
        freeTrialUsed: admin.firestore.FieldValue.increment(1),
        totalAiCalls:  admin.firestore.FieldValue.increment(1),
      });
      evictCache(uid); // invalidate so next request sees updated count
      req.userProfile = { ...profile, freeTrialUsed: freeTrialUsed + 1 };
      return next();
    }

    // ── 7. APPROVED — daily quota enforcement ─────────────────────────────
    if (profile.status === 'APPROVED') {
      const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

      let dailyCallsUsed       = profile.dailyCallsUsed      ?? 0;
      const dailyLimit         = profile.dailyLimit           ?? 20;
      const dailyCallsResetDate = profile.dailyCallsResetDate ?? '';

      // Auto-reset if it's a new day (UTC)
      if (dailyCallsResetDate !== today) {
        dailyCallsUsed = 0;
        await db.collection('users').doc(uid).update({
          dailyCallsUsed:      0,
          dailyCallsResetDate: today,
        });
        evictCache(uid);
      }

      if (dailyCallsUsed >= dailyLimit) {
        // Calculate UTC midnight for the reset time hint
        const now       = new Date();
        const midnight  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
        const hoursLeft = Math.ceil((midnight - now) / 3_600_000);

        return res.status(429).json({
          code:       'DAILY_QUOTA_EXCEEDED',
          error:      `Daily limit of ${dailyLimit} sessions reached.`,
          limit:      dailyLimit,
          used:       dailyCallsUsed,
          resetsAt:   midnight.toISOString(),
          hoursLeft,
        });
      }

      // Atomically increment daily + total usage
      await db.collection('users').doc(uid).update({
        dailyCallsUsed: admin.firestore.FieldValue.increment(1),
        totalAiCalls:   admin.firestore.FieldValue.increment(1),
        dailyCallsResetDate: today,
      });
      evictCache(uid);
      req.userProfile = { ...profile, dailyCallsUsed: dailyCallsUsed + 1 };
      return next();
    }

    // ── Unknown status — deny as a safety net ─────────────────────────────
    return res.status(403).json({
      code:  'ACCESS_DENIED',
      error: 'Account access denied. Please contact support.',
    });

  } catch (err) {
    console.error('[checkUserAccess] Error:', err.message);
    // Fail open (allow the request) so a Firestore outage doesn't break the app for everyone
    // This is a design decision — change to next(err) if you prefer fail-closed
    next();
  }
}

module.exports = { checkUserAccess, evictCache, getPlatformSettings };
