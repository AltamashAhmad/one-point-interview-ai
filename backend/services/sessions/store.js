/**
 * Session persistence. New sessions live in `sessions`; sessions created before the
 * sessions API still live in four legacy collections and are read (and updated) in place.
 */
const admin = require('../../config/firebase');
const { httpError } = require('../../utils/httpError');
const { isValidDocId } = require('../../utils/docId');

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const COLLECTION = 'sessions';
const LEGACY_COLLECTIONS = ['interviews', 'tutor_interviews', 'roadmap_interviews', 'loop_interviews'];
const LEGACY_MODE = { tutor_interviews: 'tutor', roadmap_interviews: 'sheet', loop_interviews: 'loop' };
// Scoring can take up to ~90s (AI timeout); a longer lease means a crashed request never blocks a retry for long.
const ENDING_LEASE_MS = 2 * 60_000;

const SUMMARY_FIELDS = [
  'userId', 'interviewType', 'mode', 'status', 'config', 'question', 'source', 'messageCount',
  'userMessageCount', 'startedAt', 'updatedAt', 'endedAt', 'timerEndsAt', 'timerMinutes', 'scorecard', 'hasNotes', 'isPinned', 'endReason',
];
const LEGACY_SUMMARY_FIELDS = [
  'userId', 'interviewType', 'modelUsed', 'company', 'difficulty', 'language', 'questionTitle',
  'questionLink', 'startedAt', 'updatedAt', 'scorecard', 'isPinned', 'isArchived', 'notes',
];

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value._seconds) return new Date(value._seconds * 1000).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function countUserMessages(messages) {
  return (messages || []).filter((m) => m.role === 'user').length;
}

function fromLegacy(data, collection) {
  const messages = Array.isArray(data.messages) ? data.messages : undefined;
  return {
    userId: data.userId,
    interviewType: data.interviewType,
    mode: LEGACY_MODE[collection] || (String(data.interviewType || '').startsWith('tutor') ? 'tutor' : 'interview'),
    status: data.isArchived ? 'archived' : data.scorecard ? 'completed' : 'active',
    config: {
      company: data.company || null,
      difficulty: data.difficulty || 'ANY',
      language: data.language || null,
      model: data.modelUsed || null,
      scorecardModel: null,
    },
    question: data.questionTitle
      ? { title: data.questionTitle, link: data.questionLink || null, companyName: data.company || null }
      : null,
    source: null,
    messages,
    messageCount: messages ? messages.length : null,
    userMessageCount: messages ? countUserMessages(messages) : null,
    startedAt: data.startedAt,
    updatedAt: data.updatedAt,
    endedAt: null,
    timerEndsAt: null,
    scorecard: data.scorecard || null,
    notes: data.notes,
    code: data.code,
    hasNotes: Boolean(data.notes),
    isPinned: Boolean(data.isPinned),
  };
}

/** A loaded session: its Firestore ref, the collection it lives in, and normalized data. */
function makeRecord(doc, collection) {
  const raw = doc.data();
  const data = collection === COLLECTION ? raw : fromLegacy(raw, collection);
  return { id: doc.id, ref: doc.ref, collection, legacy: collection !== COLLECTION, data };
}

/** Public shape sent to clients. Interviewer-only context (questionData) never leaves the server. */
function toApi(record, { includeMessages = true } = {}) {
  const d = record.data;
  const out = {
    id: record.id,
    interviewType: d.interviewType,
    mode: d.mode,
    status: d.status,
    config: d.config || {},
    question: d.question || null,
    source: d.source || null,
    messageCount: d.messageCount ?? null,
    userMessageCount: d.userMessageCount ?? null,
    startedAt: toIso(d.startedAt),
    updatedAt: toIso(d.updatedAt),
    endedAt: toIso(d.endedAt),
    timerEndsAt: toIso(d.timerEndsAt),
    timerMinutes: d.timerMinutes ?? null,
    scorecard: d.scorecard || null,
    hasNotes: Boolean(d.hasNotes || d.notes),
    isPinned: Boolean(d.isPinned),
    endReason: d.endReason || null,
    scoring: Boolean(d.endingAt && Date.now() - new Date(toIso(d.endingAt)).getTime() < ENDING_LEASE_MS),
    legacy: record.legacy,
    serverNow: new Date().toISOString(),
  };
  if (includeMessages) {
    out.messages = (d.messages || []).map(({ role, content, audit }) => (audit ? { role, content, audit } : { role, content }));
    out.notes = d.notes || null;
    out.code = d.code || '';
    out.draft = d.draft || '';
  }
  return out;
}

async function findOwned(userId, id) {
  if (!isValidDocId(id)) throw httpError(400, 'Invalid session ID.', 'INVALID_ID');

  let doc = await db.collection(COLLECTION).doc(id).get();
  let collection = COLLECTION;
  if (!doc.exists) {
    const legacyDocs = await Promise.all(LEGACY_COLLECTIONS.map((c) => db.collection(c).doc(id).get()));
    const index = legacyDocs.findIndex((d) => d.exists);
    if (index === -1) throw httpError(404, 'Session not found.', 'NOT_FOUND');
    doc = legacyDocs[index];
    collection = LEGACY_COLLECTIONS[index];
  }

  const record = makeRecord(doc, collection);
  if (record.data.userId !== userId) throw httpError(403, 'You do not have access to this session.', 'FORBIDDEN');
  return record;
}

/**
 * Legacy collections are read-only, so a user with no documents in one never gains any. Remembering
 * which ones are non-empty per user saves up to four Firestore queries on every list.
 */
const legacyCollectionsByUser = new Map();
const LEGACY_CACHE_MAX_USERS = 10_000;

async function queryLegacy(userId, collection) {
  const snap = await db.collection(collection).where('userId', '==', userId).select(...LEGACY_SUMMARY_FIELDS).get();
  return snap.docs.map((doc) => makeRecord(doc, collection));
}

/** Every session of the user (new + legacy), without transcripts, newest first. */
async function listForUser(userId) {
  const known = legacyCollectionsByUser.get(userId);
  const legacyToQuery = known || LEGACY_COLLECTIONS;
  const [current, ...legacy] = await Promise.all([
    db.collection(COLLECTION).where('userId', '==', userId).select(...SUMMARY_FIELDS).get()
      .then((snap) => snap.docs.map((doc) => makeRecord(doc, COLLECTION))),
    ...legacyToQuery.map((c) => queryLegacy(userId, c)),
  ]);
  if (!known) {
    if (legacyCollectionsByUser.size >= LEGACY_CACHE_MAX_USERS) legacyCollectionsByUser.clear();
    legacyCollectionsByUser.set(userId, legacyToQuery.filter((_, i) => legacy[i].length > 0));
  }
  const records = [...current, ...legacy.flat()];
  const time = (r) => new Date(toIso(r.data.updatedAt) || toIso(r.data.startedAt) || 0).getTime();
  return records.sort((a, b) => time(b) - time(a));
}

async function practicedQuestionTitles(userId) {
  const records = await listForUser(userId);
  return [...new Set(records.map((r) => r.data.question?.title).filter(Boolean))];
}

async function create(data) {
  const now = FieldValue.serverTimestamp();
  const ref = db.collection(COLLECTION).doc();
  const doc = {
    ...data,
    status: 'active',
    messages: [],
    messageCount: 0,
    userMessageCount: 0,
    scorecard: null,
    hasNotes: false,
    isPinned: false,
    startedAt: now,
    updatedAt: now,
    endedAt: null,
  };
  await ref.set(doc);
  return { id: ref.id, ref, collection: COLLECTION, legacy: false, data: { ...doc, startedAt: new Date(), updatedAt: new Date() } };
}

/**
 * Persists the transcript after a successful turn, but only if nobody else changed it meanwhile
 * (another tab, a retried request). `extra` carries fields to set in the same write (e.g. timerEndsAt).
 * Throws 409 SESSION_CONFLICT when the stored transcript no longer has `expectedCount` messages.
 */
async function saveMessages(record, messages, model, { expectedCount, extra = {} } = {}) {
  const updatedAt = FieldValue.serverTimestamp();
  const patch = record.legacy
    ? { messages, modelUsed: model, updatedAt, ...extra }
    : { messages, messageCount: messages.length, userMessageCount: countUserMessages(messages), 'config.model': model, updatedAt, ...extra };

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(record.ref);
    const current = snap.data() || {};
    const currentCount = Array.isArray(current.messages) ? current.messages.length : 0;
    if (expectedCount !== undefined && currentCount !== expectedCount) {
      throw httpError(409, 'This session was updated from another tab. Reload to see the latest messages.', 'SESSION_CONFLICT');
    }
    const status = record.legacy ? (current.isArchived ? 'archived' : current.scorecard ? 'completed' : 'active') : current.status;
    if (status !== 'active') throw httpError(409, 'This session has already ended.', 'SESSION_ENDED');
    tx.update(record.ref, patch);
  });

  record.data.messages = messages;
  record.data.messageCount = messages.length;
  record.data.userMessageCount = countUserMessages(messages);
  record.data.config = { ...(record.data.config || {}), model };
  Object.assign(record.data, extra);
}

/** Marks a session as being scored so a second tab/request cannot score it at the same time. */
async function claimEnding(record) {
  await db.runTransaction(async (tx) => {
    const current = (await tx.get(record.ref)).data() || {};
    const since = toIso(current.endingAt);
    if (since && Date.now() - new Date(since).getTime() < ENDING_LEASE_MS) {
      throw httpError(409, 'Your scorecard is already being generated. It will be ready in a moment.', 'SCORING_IN_PROGRESS');
    }
    tx.update(record.ref, { endingAt: new Date() });
  });
}

async function releaseEnding(record) {
  await record.ref.update({ endingAt: null }).catch(() => {});
}

async function complete(record, { scorecard = null } = {}) {
  const updatedAt = FieldValue.serverTimestamp();
  // Legacy docs have no status field: a scorecard marks them done, otherwise archive so they stop showing as resumable.
  const patch = record.legacy
    ? { ...(scorecard ? { scorecard } : { isArchived: true }), endingAt: null, updatedAt }
    : { status: 'completed', ...(scorecard && { scorecard }), endedAt: updatedAt, endingAt: null, updatedAt };
  await record.ref.update(patch);
  record.data.status = 'completed';
  if (scorecard) record.data.scorecard = scorecard;
  record.data.endedAt = new Date();
}

async function update(record, { isPinned, notes, code, archived, endReason, draft }) {
  const patch = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof code === 'string') {
    patch.code = code;
    record.data.code = code;
  }
  if (typeof draft === 'string') {
    patch.draft = draft;
    record.data.draft = draft;
  }
  if (typeof isPinned === 'boolean') {
    patch.isPinned = isPinned;
    record.data.isPinned = isPinned;
  }
  if (typeof notes === 'string') {
    patch.notes = notes;
    if (!record.legacy) patch.hasNotes = Boolean(notes.trim());
    record.data.notes = notes;
    record.data.hasNotes = Boolean(notes.trim());
  }
  if (archived === true) {
    patch.draft = '';
    if (record.legacy) patch.isArchived = true;
    else {
      patch.status = 'archived';
      patch.endedAt = FieldValue.serverTimestamp();
      if (endReason) patch.endReason = endReason;
    }
    record.data.status = 'archived';
    if (endReason) record.data.endReason = endReason;
  }
  await record.ref.update(patch);
}

async function remove(record) {
  await record.ref.delete();
}

module.exports = {
  findOwned,
  listForUser,
  resetLegacyCache: () => legacyCollectionsByUser.clear(),
  practicedQuestionTitles,
  create,
  saveMessages,
  claimEnding,
  releaseEnding,
  complete,
  update,
  remove,
  toApi,
  toIso,
};
