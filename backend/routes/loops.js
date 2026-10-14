const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { enforceGlobalStatus } = require('../middleware/checkUserAccess');
const admin = require('../config/firebase');
const { getOwnedLoop, ROUND_STATUSES } = require('../services/loops');

const db = admin.firestore();

// Builds a clean, validated rounds array from arbitrary client input.
function sanitizeRounds(rounds) {
  if (!Array.isArray(rounds) || rounds.length === 0) return null;
  if (rounds.length > 20) return null;
  return rounds.map((r) => ({
    type: typeof r.type === 'string' ? r.type.slice(0, 50) : 'unknown',
    name: typeof r.name === 'string' ? r.name.slice(0, 200) : 'Round',
    status: ROUND_STATUSES.includes(r.status) ? r.status : 'pending',
    score: typeof r.score === 'number' ? r.score : null,
    sessionId: typeof r.sessionId === 'string' ? r.sessionId : null,
  }));
}

const VALID_LOOP_STATUS = ['in-progress', 'passed', 'failed'];

router.use(verifyToken, enforceGlobalStatus);

/** GET /api/loops — the user's loops, newest first. */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.uid;
    // Avoid a composite index requirement: filter by userId, sort in memory.
    const snapshot = await db.collection('loops')
      .where('userId', '==', userId)
      .get();

    const loops = [];
    snapshot.forEach((doc) => {
      loops.push({ id: doc.id, ...doc.data() });
    });

    loops.sort((a, b) => {
      const at = a.updatedAt?._seconds || a.updatedAt?.seconds || 0;
      const bt = b.updatedAt?._seconds || b.updatedAt?.seconds || 0;
      return bt - at;
    });

    res.json({ loops });
  } catch (error) {
    next(error);
  }
});

/** GET /api/loops/:id */
router.get('/:id', async (req, res, next) => {
  try {
    const { id, loop } = await getOwnedLoop(req.user.uid, req.params.id);
    res.json({ loop: { id, ...loop } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/loops
 * Create a new loop. The server generates the document ID.
 * Body: { company, level, rounds: [{ type, name }], status?, currentRoundIndex? }
 * The optional status / currentRoundIndex / round states are accepted so that
 * existing localStorage loops can be migrated without losing progress.
 */
router.post('/', async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const { company, level, rounds, status, currentRoundIndex } = req.body;

    if (!company || typeof company !== 'string' || !company.trim()) {
      return res.status(400).json({ error: 'Company name is required.' });
    }

    const cleanRounds = sanitizeRounds(rounds);
    if (!cleanRounds) {
      return res.status(400).json({ error: 'A valid rounds array is required.' });
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const loopData = {
      userId,
      company: company.trim().slice(0, 100),
      level: typeof level === 'string' ? level.slice(0, 20) : 'L4',
      status: VALID_LOOP_STATUS.includes(status) ? status : 'in-progress',
      currentRoundIndex:
        Number.isInteger(currentRoundIndex) &&
        currentRoundIndex >= 0 &&
        currentRoundIndex < cleanRounds.length
          ? currentRoundIndex
          : 0,
      rounds: cleanRounds,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await db.collection('loops').add(loopData);
    res.json({ loop: { id: docRef.id, ...loopData } });
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/loops/:id — round progress itself is only changed by the sessions API. */
router.delete('/:id', async (req, res, next) => {
  try {
    const { ref } = await getOwnedLoop(req.user.uid, req.params.id);
    await ref.delete();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
