const admin = require('../config/firebase');
const { httpError } = require('../utils/httpError');
const { isValidDocId } = require('../utils/docId');

const db = admin.firestore();
const ROUND_STATUSES = ['pending', 'in-progress', 'passed', 'failed', 'locked'];

/**
 * Applies a round update and the loop's progression rules. Pure: mutates and returns `loop`.
 * Passing a round unlocks the next one; failing any round fails the loop.
 */
function applyRoundUpdate(loop, roundIndex, { status, score, sessionId } = {}) {
  if (!Number.isInteger(roundIndex) || roundIndex < 0 || !Array.isArray(loop?.rounds) || roundIndex >= loop.rounds.length) {
    throw httpError(400, 'Round does not exist on this loop.', 'INVALID_ROUND');
  }
  const round = loop.rounds[roundIndex];
  if (!round || typeof round !== 'object') throw httpError(400, 'Round does not exist on this loop.', 'INVALID_ROUND');
  if (status !== undefined && !ROUND_STATUSES.includes(status)) {
    throw httpError(400, `status must be one of: ${ROUND_STATUSES.join(', ')}`, 'INVALID_STATUS');
  }

  loop.rounds[roundIndex] = {
    ...round,
    ...(status !== undefined ? { status } : {}),
    ...(score !== undefined ? { score: typeof score === 'number' ? score : null } : {}),
    ...(sessionId !== undefined ? { sessionId } : {}),
  };

  if (status === 'failed') {
    loop.status = 'failed';
  } else if (status === 'passed') {
    if (roundIndex === loop.rounds.length - 1) {
      loop.status = 'passed';
    } else if (loop.currentRoundIndex === roundIndex) {
      loop.currentRoundIndex = roundIndex + 1;
      const nextRound = loop.rounds[roundIndex + 1];
      if (nextRound && nextRound.status === 'locked') {
        loop.rounds[roundIndex + 1] = { ...nextRound, status: 'pending' };
      }
    }
  }
  return loop;
}

async function getOwnedLoop(userId, loopId) {
  if (!isValidDocId(loopId)) throw httpError(400, 'Invalid loop ID.', 'INVALID_ID');
  const ref = db.collection('loops').doc(loopId);
  const doc = await ref.get();
  if (!doc.exists) throw httpError(404, 'Loop not found', 'NOT_FOUND');
  const loop = doc.data();
  if (loop.userId !== userId) throw httpError(403, 'Unauthorized access to this loop', 'FORBIDDEN');
  return { ref, loop, id: doc.id };
}

async function updateLoopRound(userId, loopId, roundIndex, patch) {
  const { ref, loop, id } = await getOwnedLoop(userId, loopId);
  applyRoundUpdate(loop, roundIndex, patch);
  await ref.update({
    rounds: loop.rounds,
    status: loop.status,
    currentRoundIndex: loop.currentRoundIndex,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { id, ...loop };
}

module.exports = { applyRoundUpdate, getOwnedLoop, updateLoopRound, ROUND_STATUSES };
