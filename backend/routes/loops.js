const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const admin = require('../config/firebase');

const db = admin.firestore();

// Validates Firestore document IDs to prevent path traversal / malformed IDs
function isValidDocId(id) {
  if (!id || typeof id !== 'string') return false;
  if (id.length > 128) return false;
  if (id.includes('/') || id === '.' || id === '..') return false;
  if (/^__.*__$/.test(id)) return false;
  return true;
}

// Builds a clean, validated rounds array from arbitrary client input.
function sanitizeRounds(rounds) {
  if (!Array.isArray(rounds) || rounds.length === 0) return null;
  if (rounds.length > 20) return null;
  return rounds.map((r) => ({
    type: typeof r.type === 'string' ? r.type.slice(0, 50) : 'unknown',
    name: typeof r.name === 'string' ? r.name.slice(0, 200) : 'Round',
    status: ['pending', 'passed', 'failed', 'locked', 'in-progress'].includes(r.status)
      ? r.status
      : 'pending',
    score: typeof r.score === 'number' ? r.score : null,
    sessionId: typeof r.sessionId === 'string' ? r.sessionId : null,
  }));
}

const VALID_LOOP_STATUS = ['in-progress', 'passed', 'failed'];

/**
 * GET /api/loops
 * List all loops for the authenticated user (newest first).
 */
router.get('/', verifyToken, async (req, res, next) => {
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

/**
 * GET /api/loops/:id
 * Fetch a specific loop by ID.
 */
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.uid;
    if (!isValidDocId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid loop ID.' });
    }
    const doc = await db.collection('loops').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Loop not found' });
    }
    const data = doc.data();
    if (data.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to this loop' });
    }

    res.json({ loop: { id: doc.id, ...data } });
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
router.post('/', verifyToken, async (req, res, next) => {
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

/**
 * PUT /api/loops/:id/round
 * Update a single round's status/score/sessionId and apply progression logic.
 * Body: { roundIndex, status?, score?, sessionId? }
 */
router.put('/:id/round', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.uid;
    if (!isValidDocId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid loop ID.' });
    }

    const { roundIndex, status, score, sessionId } = req.body;
    if (!Number.isInteger(roundIndex) || roundIndex < 0) {
      return res.status(400).json({ error: 'A valid roundIndex is required.' });
    }

    const docRef = db.collection('loops').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Loop not found' });
    }
    const loop = doc.data();
    if (loop.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to this loop' });
    }
    if (!loop.rounds || !loop.rounds[roundIndex]) {
      return res.status(400).json({ error: 'Round does not exist on this loop.' });
    }

    const round = loop.rounds[roundIndex];
    if (status !== undefined) round.status = status;
    if (score !== undefined) round.score = score;
    if (sessionId !== undefined) round.sessionId = sessionId;

    // Progression logic (server is the source of truth)
    if (status === 'failed') {
      loop.status = 'failed';
    } else if (status === 'passed') {
      if (roundIndex === loop.rounds.length - 1) {
        loop.status = 'passed';
      } else if (loop.currentRoundIndex === roundIndex) {
        loop.currentRoundIndex = roundIndex + 1;
        const next = loop.rounds[roundIndex + 1];
        if (next.status === 'locked' || next.status === 'pending') {
          next.status = 'pending';
        }
      }
    }

    await docRef.update({
      rounds: loop.rounds,
      status: loop.status,
      currentRoundIndex: loop.currentRoundIndex,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ loop: { id: doc.id, ...loop } });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/loops/:id
 * Delete a specific loop.
 */
router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.uid;
    if (!isValidDocId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid loop ID.' });
    }
    const docRef = db.collection('loops').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Loop not found' });
    }
    if (doc.data().userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    await docRef.delete();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
