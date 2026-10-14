const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { checkUserAccess, enforceGlobalStatus } = require('../middleware/checkUserAccess');
const { aiLimiter } = require('../middleware/rateLimits');
const { getQuestion } = require('../services/questionBank');
const { generateText } = require('../services/ai/gateway');
const registry = require('../services/ai/modelRegistry');
const { auditCode } = require('../services/openaiCodeAudit');
const { buildScorecardPrompt, parseScorecard, buildNotesPrompt, PASS_SCORE } = require('../services/evaluation');
const { getOwnedLoop, updateLoopRound } = require('../services/loops');
const store = require('../services/sessions/store');
const convo = require('../services/sessions/conversation');
const { VALID_INTERVIEW_TYPES, baseTypeOf } = require('../config/interviewTypes');
const { httpError } = require('../utils/httpError');
const { openEventStream } = require('../utils/sse');
const logger = require('../utils/logger');

const router = express.Router();

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'ANY'];
const CODE_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'cpp', 'c++', 'csharp', 'c#', 'go', 'rust', 'swift', 'kotlin', 'ruby', 'php'];
const MAX_MESSAGES = 100;
const MAX_MESSAGE_CHARS = 8000;
const MAX_CODE_CHARS = 20000;
const MAX_PINNED = 3;
const MAX_DRAFT_CHARS = 8000;
const CODE_REVIEW_INSTRUCTIONS = `---
CODE SUBMISSION: The candidate's latest message is code they wrote for the current problem. The interview is already in progress, so do not greet them or restate the problem.
Review it as the interviewer: say whether it solves the problem that was asked (if it solves a different problem, say so), point out bugs and missed edge cases, state its time and space complexity, and end with one follow-up question.
---`;

const createLimiter = aiLimiter({ max: 20, message: 'Too many new sessions. Please wait a few minutes.' });
const turnLimiter = aiLimiter({ max: 60, message: 'Too many messages. Please wait a few minutes before sending more.' });

router.use(verifyToken, enforceGlobalStatus);

// ── helpers ─────────────────────────────────────────────────────────────────

function cleanText(value, max) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw httpError(400, 'Invalid text field.', 'INVALID_REQUEST');
  const trimmed = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  if (trimmed.length > max) throw httpError(400, `Text must be at most ${max} characters.`, 'INVALID_REQUEST');
  return trimmed || null;
}

function modelOrNull(model) {
  if (!model) return null;
  const resolved = registry.resolveModelId(model);
  if (!resolved) throw httpError(400, 'Unknown AI model.', 'INVALID_MODEL');
  return resolved;
}

function parseConfig(config = {}) {
  const difficulty = String(config.difficulty || 'ANY').toUpperCase();
  return {
    company: cleanText(config.company, 100),
    difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : 'ANY',
    language: cleanText(config.language, 30),
    model: modelOrNull(config.model),
    scorecardModel: modelOrNull(config.scorecardModel),
  };
}

function parseSource(source) {
  if (!source) return null;
  if (source.kind === 'loop') {
    if (typeof source.loopId !== 'string' || !Number.isInteger(source.roundIndex) || source.roundIndex < 0) {
      throw httpError(400, 'Invalid loop source.', 'INVALID_REQUEST');
    }
    return { kind: 'loop', loopId: source.loopId, roundIndex: source.roundIndex };
  }
  if (source.kind === 'sheet') {
    return { kind: 'sheet', sheetId: cleanText(source.sheetId, 60), problemId: cleanText(source.problemId, 150) };
  }
  throw httpError(400, 'Invalid session source.', 'INVALID_REQUEST');
}

function modeFor(interviewType, source) {
  if (source?.kind === 'loop') return 'loop';
  if (source?.kind === 'sheet') return 'sheet';
  return convo.isTutorType(interviewType) ? 'tutor' : 'interview';
}

function publicQuestion(questionData) {
  if (!questionData) return null;
  // Managerial questions carry `question` as a plain string, so only read fields from objects.
  const question = questionData.question && typeof questionData.question === 'object' ? questionData.question : null;
  const problem = questionData.problem && typeof questionData.problem === 'object' ? questionData.problem : null;
  const title = questionData.title || question?.title || problem?.title;
  if (!title) return null;
  return { title, link: question?.link || null, companyName: questionData.companyName || null };
}

function assertActive(record) {
  if (record.data.status !== 'active') {
    throw httpError(409, 'This session has already ended. Start a new one to keep practicing.', 'SESSION_ENDED');
  }
}

// Answers sent up to a minute after the deadline still count (slow networks, a sentence mid-send).
const TIME_GRACE_MS = 60_000;

function isTimeUp(record, graceMs = 0) {
  if (convo.isTutorType(record.data.interviewType)) return false;
  const endsAt = store.toIso(record.data.timerEndsAt);
  return Boolean(endsAt) && Date.now() > new Date(endsAt).getTime() + graceMs;
}

function assertTimeLeft(record) {
  if (isTimeUp(record, TIME_GRACE_MS)) {
    throw httpError(409, "Time's up for this interview. End it to get your scorecard.", 'TIME_UP');
  }
}

function assertRoomFor(record, count) {
  if ((record.data.messages || []).length + count > MAX_MESSAGES) {
    throw httpError(409, 'This session reached its message limit. End it and start a new one.', 'SESSION_FULL');
  }
}

/** The interview clock starts when the candidate first sees the problem, not when the session row is created. */
function timerStartPatch(record) {
  const minutes = record.data.timerMinutes;
  if (!minutes || record.data.timerEndsAt || (record.data.messages || []).length > 0) return {};
  return { timerEndsAt: new Date(Date.now() + minutes * 60_000) };
}

async function appendAndSave(record, newMessages, model, extra) {
  const expectedCount = (record.data.messages || []).length;
  const messages = [...(record.data.messages || []), ...newMessages];
  await store.saveMessages(record, messages, model || null, { expectedCount, extra });
  return messages;
}

const isAdmin = (req) => req.userProfile?.role === 'admin';

// A just-created session whose opening message is still streaming must not be swept up by another tab.
const UNSTARTED_GRACE_MS = 2 * 60_000;

async function closeSession(userId, record, endReason) {
  await store.update(record, { archived: true, endReason });
  if (record.data.source?.kind === 'loop') await reopenLoopRound(userId, record);
}

/**
 * Only one timed interview runs at a time (tutor lessons are exempt), like a real interview.
 * Dead leftovers are closed on the way: never-started sessions and timed-out ones with no answers.
 * Anything else blocks with 409 ACTIVE_INTERVIEW and its summary so the client can offer resume/discard.
 */
async function assertNoActiveInterview(userId, interviewType) {
  if (convo.isTutorType(interviewType)) return;
  const open = (await store.listForUser(userId)).filter((r) =>
    !r.legacy && r.data.status === 'active' && !convo.isTutorType(r.data.interviewType));

  for (const record of open) {
    const started = (record.data.messageCount || 0) > 0;
    const age = Date.now() - new Date(store.toIso(record.data.startedAt) || 0).getTime();
    if (!started && age > UNSTARTED_GRACE_MS) {
      await closeSession(userId, record, 'abandoned');
    } else if (started && !record.data.userMessageCount && isTimeUp(record)) {
      await closeSession(userId, record, 'timeout');
    } else {
      const err = httpError(409, 'You already have an interview in progress. Finish or discard it before starting another.', 'ACTIVE_INTERVIEW');
      err.details = { session: store.toApi(record, { includeMessages: false }) };
      throw err;
    }
  }
}

// ── routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/sessions?status=&interviewType=&mode=&question=&loopId=
 * Lists the user's sessions (new and legacy), newest first, without transcripts.
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, interviewType, mode, question, loopId } = req.query;
    const sessions = (await store.listForUser(req.user.uid))
      .map((r) => store.toApi(r, { includeMessages: false }))
      .filter((s) => !status || s.status === status)
      .filter((s) => !interviewType || s.interviewType === interviewType)
      .filter((s) => !mode || s.mode === mode)
      .filter((s) => !question || s.question?.title === question)
      .filter((s) => !loopId || s.source?.loopId === loopId);
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions
 * Body: { interviewType, config?: { company, difficulty, language, model, scorecardModel }, questionTitle?, source? }
 * Counts as one session against the user's quota (only after the request is valid).
 * The opening AI message comes from POST /:id/turns.
 */
async function validateCreate(req, res, next) {
  try {
    const { interviewType, questionTitle } = req.body || {};
    if (!VALID_INTERVIEW_TYPES.includes(interviewType)) {
      throw httpError(400, `interviewType must be one of: ${VALID_INTERVIEW_TYPES.join(', ')}`, 'INVALID_REQUEST');
    }
    const draft = {
      interviewType,
      config: parseConfig(req.body.config),
      source: parseSource(req.body.source),
      seed: cleanText(questionTitle, 200),
    };

    if (draft.source?.kind === 'loop') {
      const { source } = draft;
      const { loop } = await getOwnedLoop(req.user.uid, source.loopId);
      const round = loop.rounds?.[source.roundIndex];
      if (!round) throw httpError(400, 'Round does not exist on this loop.', 'INVALID_ROUND');
      if (round.type !== interviewType) throw httpError(400, 'This round uses a different interview type.', 'INVALID_ROUND');
      if (loop.status !== 'in-progress' || loop.currentRoundIndex !== source.roundIndex) {
        throw httpError(409, 'This round is not open. Continue from the current round of your loop.', 'ROUND_LOCKED');
      }
    }
    await assertNoActiveInterview(req.user.uid, interviewType);
    req.sessionDraft = draft;
    next();
  } catch (error) {
    next(error);
  }
}

router.post('/', createLimiter, validateCreate, checkUserAccess, async (req, res, next) => {
  try {
    const { interviewType, config, source, seed } = req.sessionDraft;

    const questionData = seed
      ? { title: seed, isSeed: true }
      : getQuestion(baseTypeOf(interviewType), config.company, config.difficulty, await store.practicedQuestionTitles(req.user.uid));

    const minutes = convo.timerMinutesFor(interviewType);
    const record = await store.create({
      userId: req.user.uid,
      interviewType,
      mode: modeFor(interviewType, source),
      config,
      source,
      question: publicQuestion(questionData),
      // Interviewer-only context (e.g. reference solutions); never sent to the client.
      questionData: questionData ? JSON.parse(JSON.stringify(questionData)) : null,
      timerMinutes: minutes,
      timerEndsAt: null,
    });

    if (source?.kind === 'loop') {
      await updateLoopRound(req.user.uid, source.loopId, source.roundIndex, { status: 'in-progress', sessionId: record.id });
    }

    res.status(201).json({ session: store.toApi(record) });
  } catch (error) {
    next(error);
  }
});

/** GET /api/sessions/:id — full session including transcript. */
router.get('/:id', async (req, res, next) => {
  try {
    const record = await store.findOwned(req.user.uid, req.params.id);
    res.json({ session: store.toApi(record) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions/:id/turns — body { content?, model?, turnId? }, answered as Server-Sent Events:
 *   token { text } … then done { message, model, fellBack, messageCount, timerEndsAt } or error { error, code }.
 * Without `content` on an empty session it produces the interviewer's opening message (and starts the clock).
 * The transcript is only saved once the reply completes, so a failed turn can simply be retried.
 * Retrying with the same `turnId` after a dropped connection returns the already-saved reply instead of duplicating it.
 */
router.post('/:id/turns', turnLimiter, async (req, res, next) => {
  let record;
  let userMessage = null;
  let model;
  try {
    record = await store.findOwned(req.user.uid, req.params.id);
    assertActive(record);
    const content = cleanText(req.body?.content, MAX_MESSAGE_CHARS);
    const turnId = cleanText(req.body?.turnId, 64);
    const existing = record.data.messages || [];
    if (!content && existing.length > 0) throw httpError(400, 'Message cannot be empty.', 'INVALID_REQUEST');

    const replayed = turnId && replayOf(existing, turnId);
    if (replayed) {
      const stream = openEventStream(res);
      stream.send('done', { message: replayed, model: record.data.config?.model || null, fellBack: false, messageCount: existing.length, timerEndsAt: store.toIso(record.data.timerEndsAt), replayed: true });
      return stream.end();
    }

    if (content) {
      assertTimeLeft(record);
      assertRoomFor(record, 2);
      userMessage = { role: 'user', content, ...(turnId && { turnId }) };
    }
    model = modelOrNull(req.body?.model) || record.data.config?.model;
  } catch (error) {
    return next(error);
  }

  const stream = openEventStream(res);
  try {
    const timerPatch = timerStartPatch(record);
    const result = await generateText({
      messages: convo.modelMessages(record.data, userMessage),
      systemPrompt: convo.systemPromptFor({ ...record.data, ...timerPatch }, convo.firstName(req.user)),
      model,
      isAdmin: isAdmin(req),
      signal: stream.signal,
      onToken: (text) => stream.send('token', { text }),
    });
    const assistantMessage = { role: 'assistant', content: result.text };
    const messages = await appendAndSave(record, [...(userMessage ? [userMessage] : []), assistantMessage], result.model, timerPatch);
    stream.send('done', {
      message: assistantMessage,
      model: result.model,
      fellBack: result.fellBack,
      messageCount: messages.length,
      timerEndsAt: store.toIso(record.data.timerEndsAt),
    });
  } catch (error) {
    stream.fail(error, `POST /api/sessions/${req.params.id}/turns`);
  } finally {
    stream.end();
  }
});

/** The assistant reply that followed the user message sent with `turnId`, if that turn was already saved. */
function replayOf(messages, turnId) {
  const index = messages.findIndex((m) => m.role === 'user' && m.turnId === turnId);
  const reply = index >= 0 ? messages[index + 1] : null;
  return reply?.role === 'assistant' ? { role: 'assistant', content: reply.content } : null;
}

/**
 * POST /api/sessions/:id/code-review — body { code, language }
 * Uses the structured OpenAI reviewer when configured, otherwise the session's interviewer model.
 * Responds with the two messages appended to the transcript.
 */
router.post('/:id/code-review', turnLimiter, async (req, res, next) => {
  try {
    const record = await store.findOwned(req.user.uid, req.params.id);
    assertActive(record);
    assertTimeLeft(record);
    assertRoomFor(record, 2);
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!code.trim()) throw httpError(400, 'Write some code before submitting it for review.', 'INVALID_REQUEST');
    if (code.length > MAX_CODE_CHARS) throw httpError(400, `Code must be at most ${MAX_CODE_CHARS} characters.`, 'INVALID_REQUEST');
    const language = (cleanText(req.body?.language, 20) || 'text').toLowerCase();
    const fence = CODE_LANGUAGES.includes(language) ? language : 'text';

    const userMessage = {
      role: 'user',
      content: `Here is my implementation in ${language}:\n\n\`\`\`${fence}\n${code}\n\`\`\`\n\nPlease review my code.`,
    };

    let assistantMessage = null;
    let model = record.data.config?.model;
    if (process.env.OPENAI_API_KEY) {
      try {
        const audit = await auditCode({
          code,
          language: fence,
          problemTitle: record.data.question?.title || '',
          promptContext: [
            record.data.config?.difficulty ? `Difficulty: ${record.data.config.difficulty}` : '',
            record.data.config?.company ? `Target company: ${record.data.config.company}` : '',
          ].filter(Boolean).join('. '),
        });
        assistantMessage = { role: 'assistant', content: audit.summary, audit };
      } catch (error) {
        logger.warn('OpenAI code review failed; using interviewer model', { requestId: req.id, err: error.message });
      }
    }
    if (!assistantMessage) {
      const result = await generateText({
        messages: convo.modelMessages(record.data, userMessage),
        systemPrompt: `${convo.systemPromptFor(record.data, convo.firstName(req.user))}\n\n${CODE_REVIEW_INSTRUCTIONS}`,
        model,
        isAdmin: isAdmin(req),
      });
      assistantMessage = { role: 'assistant', content: result.text };
      model = result.model;
    }

    const messages = await appendAndSave(record, [userMessage, assistantMessage], model);
    res.json({ messages: [userMessage, assistantMessage], messageCount: messages.length });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions/:id/end — body { scorecardModel? }
 * Interviews get an AI scorecard (and advance their loop round); tutor sessions just close.
 * An interview whose time ran out with no answers is closed as `archived` with endReason 'timeout'.
 * Idempotent: ending an already-scored session returns it, and a second concurrent request gets SCORING_IN_PROGRESS.
 */
router.post('/:id/end', turnLimiter, async (req, res, next) => {
  try {
    const record = await store.findOwned(req.user.uid, req.params.id);
    if (record.data.status !== 'active') {
      return res.json({ session: store.toApi(record) });
    }

    if (convo.isTutorType(record.data.interviewType)) {
      await store.complete(record);
      return res.json({ session: store.toApi(record) });
    }

    const messages = record.data.messages || [];
    if (!messages.some((m) => m.role === 'user')) {
      if (!isTimeUp(record)) {
        throw httpError(400, "Answer at least one question before ending the interview so there's something to score.", 'NO_ANSWERS');
      }
      await store.update(record, { archived: true, endReason: 'timeout' });
      if (record.data.source?.kind === 'loop') await reopenLoopRound(req.user.uid, record);
      return res.json({ session: store.toApi(record) });
    }

    await store.claimEnding(record);
    let scorecard;
    try {
      const { text } = await generateText({
        messages: [{ role: 'user', content: 'Generate the scorecard for this interview.' }],
        systemPrompt: buildScorecardPrompt(messages),
        model: modelOrNull(req.body?.scorecardModel) || record.data.config?.scorecardModel,
        purpose: 'scorecard',
        isAdmin: isAdmin(req),
      });
      scorecard = parseScorecard(text);
      if (!scorecard) throw httpError(502, 'The AI returned an unreadable scorecard. Please try ending the interview again.', 'SCORECARD_INVALID');
    } catch (error) {
      await store.releaseEnding(record);
      throw error;
    }

    await store.complete(record, { scorecard });

    const source = record.data.source;
    if (source?.kind === 'loop') {
      await updateLoopRound(req.user.uid, source.loopId, source.roundIndex, {
        status: scorecard.score >= PASS_SCORE ? 'passed' : 'failed',
        score: scorecard.score,
        sessionId: record.id,
      }).catch((error) => logger.error('Loop round update after scorecard failed', { requestId: req.id, loopId: source.loopId, err: error.message }));
    }

    res.json({ session: store.toApi(record) });
  } catch (error) {
    next(error);
  }
});

/** A loop round whose interview was abandoned goes back to pending so the candidate can retake it. */
async function reopenLoopRound(userId, record) {
  const { loopId, roundIndex } = record.data.source;
  await updateLoopRound(userId, loopId, roundIndex, { status: 'pending', sessionId: null })
    .catch((error) => logger.error('Reopening loop round failed', { loopId, roundIndex, err: error.message }));
}

/** POST /api/sessions/:id/notes — generates personalised revision notes once, then returns them. */
router.post('/:id/notes', turnLimiter, async (req, res, next) => {
  try {
    const record = await store.findOwned(req.user.uid, req.params.id);
    if (record.data.notes) return res.json({ notes: record.data.notes });

    const messages = record.data.messages || [];
    if (messages.length === 0) throw httpError(400, 'There is no transcript to make notes from yet.', 'NO_TRANSCRIPT');

    const { text } = await generateText({
      messages: [{ role: 'user', content: 'Generate my personalized revision notes in Markdown.' }],
      systemPrompt: buildNotesPrompt(messages, record.data.config?.language),
      purpose: 'notes',
      maxTokens: 4096,
      isAdmin: isAdmin(req),
    });
    await store.update(record, { notes: text.trim() });
    res.json({ notes: record.data.notes });
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/sessions/:id — body { isPinned?, notes?, code?, draft?, status?: 'archived' } */
router.patch('/:id', async (req, res, next) => {
  try {
    const record = await store.findOwned(req.user.uid, req.params.id);
    const { isPinned, notes, code, status, draft } = req.body || {};

    if (code !== undefined) {
      if (typeof code !== 'string' || code.length > MAX_CODE_CHARS) {
        throw httpError(400, `Code must be text of at most ${MAX_CODE_CHARS} characters.`, 'INVALID_REQUEST');
      }
      assertActive(record);
    }

    if (draft !== undefined) {
      if (typeof draft !== 'string' || draft.length > MAX_DRAFT_CHARS) {
        throw httpError(400, `Draft must be text of at most ${MAX_DRAFT_CHARS} characters.`, 'INVALID_REQUEST');
      }
      assertActive(record);
    }
    if (isPinned !== undefined && typeof isPinned !== 'boolean') throw httpError(400, 'isPinned must be true or false.', 'INVALID_REQUEST');
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 50_000)) {
      throw httpError(400, 'Notes must be text of at most 50,000 characters.', 'INVALID_REQUEST');
    }
    if (status !== undefined && status !== 'archived') throw httpError(400, 'Only status "archived" can be set.', 'INVALID_REQUEST');

    if (isPinned === true && !record.data.isPinned) {
      const pinned = (await store.listForUser(req.user.uid)).filter((r) => r.data.isPinned).length;
      if (pinned >= MAX_PINNED) throw httpError(400, `You can pin up to ${MAX_PINNED} sessions. Unpin one first.`, 'PIN_LIMIT');
    }

    const archiving = status === 'archived' && record.data.status === 'active';
    await store.update(record, { isPinned, notes, code, draft, archived: archiving, endReason: archiving ? 'abandoned' : undefined });
    if (archiving && record.data.source?.kind === 'loop') await reopenLoopRound(req.user.uid, record);
    res.json({ session: store.toApi(record, { includeMessages: false }) });
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/sessions/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    const record = await store.findOwned(req.user.uid, req.params.id);
    await store.remove(record);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
