const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { enforceGlobalStatus } = require('../middleware/checkUserAccess');
const admin = require('../config/firebase');

const db = admin.firestore();

const VALID_SHEETS = ['dsa-master', 'prep-plan'];
const ITEM_KEY_RE = /^[A-Za-z0-9:_-]{1,150}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOG_STATUSES = ['done', 'partial', 'not-done'];
const MAX_NOTE_LENGTH = 20000;
const MAX_TOPIC_LENGTH = 300;

function trackerCollection(uid) {
  return db.collection('users').doc(uid).collection('tracker');
}

/**
 * Builds a whitelisted Firestore patch from client input.
 * Returns { patch } on success or { error } on invalid input.
 */
function buildPatch(body) {
  const patch = {};
  if (!body || typeof body !== 'object') return { error: 'Body must be an object.' };

  if (body.done !== undefined) {
    if (typeof body.done !== 'boolean') return { error: 'done must be a boolean.' };
    patch.done = body.done;
  }
  if (body.important !== undefined) {
    if (typeof body.important !== 'boolean') return { error: 'important must be a boolean.' };
    patch.important = body.important;
  }
  if (body.note !== undefined) {
    if (typeof body.note !== 'string') return { error: 'note must be a string.' };
    if (body.note.length > MAX_NOTE_LENGTH) return { error: `note must be at most ${MAX_NOTE_LENGTH} characters.` };
    patch.note = body.note;
  }
  if (body.startDate !== undefined) {
    if (body.startDate !== null && (typeof body.startDate !== 'string' || !DATE_RE.test(body.startDate))) {
      return { error: 'startDate must be YYYY-MM-DD or null.' };
    }
    patch.startDate = body.startDate;
  }
  if (body.log !== undefined) {
    const { topic, minutes, status } = body.log || {};
    if (typeof topic !== 'string' || topic.length > MAX_TOPIC_LENGTH) {
      return { error: `log.topic must be a string of at most ${MAX_TOPIC_LENGTH} characters.` };
    }
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) {
      return { error: 'log.minutes must be an integer between 0 and 1440.' };
    }
    if (!LOG_STATUSES.includes(status)) {
      return { error: `log.status must be one of ${LOG_STATUSES.join(', ')}.` };
    }
    patch.log = { topic, minutes, status };
  }

  if (Object.keys(patch).length === 0) return { error: 'No valid fields to update.' };
  return { patch };
}

router.use(verifyToken, enforceGlobalStatus);

/**
 * GET /api/tracker/:sheetId
 * Returns every tracked item (done / important / note / log) for one sheet.
 */
router.get('/:sheetId', async (req, res, next) => {
  try {
    const { sheetId } = req.params;
    if (!VALID_SHEETS.includes(sheetId)) {
      return res.status(400).json({ error: 'Unknown sheet.' });
    }

    const snapshot = await trackerCollection(req.user.uid)
      .where('sheetId', '==', sheetId)
      .get();

    const items = {};
    snapshot.forEach((doc) => {
      const { itemKey, sheetId: _s, updatedAt, ...rest } = doc.data();
      if (itemKey) items[itemKey] = rest;
    });

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/tracker/:sheetId/items/:itemKey
 * Upserts a single tracked item. Body: { done?, important?, note?, startDate?, log? }
 */
router.put('/:sheetId/items/:itemKey', async (req, res, next) => {
  try {
    const { sheetId, itemKey } = req.params;
    if (!VALID_SHEETS.includes(sheetId)) {
      return res.status(400).json({ error: 'Unknown sheet.' });
    }
    if (!ITEM_KEY_RE.test(itemKey)) {
      return res.status(400).json({ error: 'Invalid item key.' });
    }

    const { patch, error } = buildPatch(req.body);
    if (error) return res.status(400).json({ error });

    await trackerCollection(req.user.uid)
      .doc(`${sheetId}__${itemKey}`)
      .set(
        { ...patch, sheetId, itemKey, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );

    res.json({ success: true, itemKey, item: patch });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/tracker/:sheetId/items/:itemKey
 * Removes a tracked item (used to delete a daily log entry).
 */
router.delete('/:sheetId/items/:itemKey', async (req, res, next) => {
  try {
    const { sheetId, itemKey } = req.params;
    if (!VALID_SHEETS.includes(sheetId) || !ITEM_KEY_RE.test(itemKey)) {
      return res.status(400).json({ error: 'Invalid sheet or item key.' });
    }
    await trackerCollection(req.user.uid).doc(`${sheetId}__${itemKey}`).delete();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
