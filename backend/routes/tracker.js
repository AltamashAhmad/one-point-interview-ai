const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { enforceGlobalStatus } = require('../middleware/checkUserAccess');
const { aiLimiter } = require('../middleware/rateLimits');
const { generateText } = require('../services/ai/gateway');
const { buildProblemNotesPrompt, buildPatternNotesPrompt } = require('../services/studyNotes');
const admin = require('../config/firebase');

const db = admin.firestore();

const VALID_SHEETS = ['dsa-master', 'prep-plan', 'study-notes'];
const ITEM_KEY_RE = /^[A-Za-z0-9:_-]{1,150}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOG_STATUSES = ['done', 'partial', 'not-done'];
const ITEM_TYPES = ['question', 'section'];
const NOTE_SOURCES = ['manual', 'ai'];
const MAX_NOTE_LENGTH = 20000;
const MAX_TOPIC_LENGTH = 300;
const MAX_TITLE_LENGTH = 300;

const notesLimiter = aiLimiter({ max: 30, message: 'Too many AI note generations. Please wait a few minutes.' });

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
  if (body.progress !== undefined) {
    if (!Number.isInteger(body.progress) || body.progress < 0 || body.progress > 100) {
      return { error: 'progress must be an integer between 0 and 100.' };
    }
    patch.progress = body.progress;
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
  // Denormalized context, kept alongside the note so a record is self-describing even if the sheet is reshuffled later.
  if (body.itemType !== undefined) {
    if (!ITEM_TYPES.includes(body.itemType)) return { error: `itemType must be one of: ${ITEM_TYPES.join(', ')}.` };
    patch.itemType = body.itemType;
  }
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.length > MAX_TITLE_LENGTH) {
      return { error: `title must be a string of at most ${MAX_TITLE_LENGTH} characters.` };
    }
    patch.title = body.title;
  }
  if (body.sectionTitle !== undefined) {
    if (typeof body.sectionTitle !== 'string' || body.sectionTitle.length > MAX_TITLE_LENGTH) {
      return { error: `sectionTitle must be a string of at most ${MAX_TITLE_LENGTH} characters.` };
    }
    patch.sectionTitle = body.sectionTitle;
  }
  if (body.noteSource !== undefined) {
    if (!NOTE_SOURCES.includes(body.noteSource)) return { error: `noteSource must be one of: ${NOTE_SOURCES.join(', ')}.` };
    patch.noteSource = body.noteSource;
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

    const ref = trackerCollection(req.user.uid).doc(`${sheetId}__${itemKey}`);
    const fields = { ...patch, sheetId, itemKey, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (patch.progress !== undefined) {
      // Reading progress only moves forward, so a stale tab cannot lower it.
      fields.progress = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const next = Math.max(snap.exists ? snap.data().progress || 0 : 0, patch.progress);
        tx.set(ref, { ...fields, progress: next }, { merge: true });
        return next;
      });
    } else {
      await ref.set(fields, { merge: true });
    }

    res.json({ success: true, itemKey, item: fields.progress !== undefined ? { ...patch, progress: fields.progress } : patch });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tracker/:sheetId/items/:itemKey/notes/generate
 * Body: { itemType: 'question'|'section', title, difficulty?, sectionTitle?, language? }
 * Generates a structured, pseudocode-only breakdown (pattern recognition, brute force, optimal, pitfalls).
 * Does not save anything — the caller reviews the draft and PUTs it like any manually-written note.
 */
router.post('/:sheetId/items/:itemKey/notes/generate', notesLimiter, async (req, res, next) => {
  try {
    const { sheetId, itemKey } = req.params;
    if (!VALID_SHEETS.includes(sheetId)) return res.status(400).json({ error: 'Unknown sheet.' });
    if (!ITEM_KEY_RE.test(itemKey)) return res.status(400).json({ error: 'Invalid item key.' });

    const { itemType, title, difficulty, sectionTitle, language } = req.body || {};
    if (!ITEM_TYPES.includes(itemType)) return res.status(400).json({ error: `itemType must be one of: ${ITEM_TYPES.join(', ')}.` });
    const cleanTitle = typeof title === 'string' ? title.trim().slice(0, MAX_TITLE_LENGTH) : '';
    if (!cleanTitle) return res.status(400).json({ error: 'title is required.' });
    const cleanSection = typeof sectionTitle === 'string' ? sectionTitle.trim().slice(0, MAX_TITLE_LENGTH) : '';
    const cleanDifficulty = typeof difficulty === 'string' ? difficulty.trim().slice(0, 20) : '';
    const cleanLanguage = typeof language === 'string' && language.trim() ? language.trim().slice(0, 30) : 'Java';

    const systemPrompt = itemType === 'section'
      ? buildPatternNotesPrompt(cleanTitle, cleanLanguage)
      : buildProblemNotesPrompt(cleanTitle, cleanDifficulty, cleanSection, cleanLanguage);

    const { text } = await generateText({
      messages: [{ role: 'user', content: itemType === 'section' ? 'Generate the pattern playbook.' : 'Generate my study notes for this problem.' }],
      systemPrompt,
      purpose: 'notes',
      maxTokens: 3072,
      isAdmin: req.userProfile?.role === 'admin',
    });

    res.json({ notes: text.trim() });
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
