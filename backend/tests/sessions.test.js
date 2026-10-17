process.env.GROQ_API_KEY = 'test';
process.env.GEMINI_API_KEY = 'test';
delete process.env.OPENAI_API_KEY;

const request = require('supertest');
const express = require('express');
const { createFakeFirestore } = require('./helpers/fakeFirestore');

const mockFake = createFakeFirestore();
let mockCurrentUser = { uid: 'u1', name: 'Alex Doe', email: 'alex@example.com' };

jest.mock('../config/firebase', () => {
  const firestore = () => mockFake.db;
  firestore.FieldValue = { serverTimestamp: () => new Date(), increment: (n) => n };
  return { firestore };
});
jest.mock('../middleware/auth', () => ({
  verifyToken: (req, res, next) => { req.user = mockCurrentUser; next(); },
}));
let mockQuotaCharges = 0;
jest.mock('../middleware/checkUserAccess', () => ({
  checkUserAccess: (req, res, next) => { mockQuotaCharges += 1; next(); },
  enforceGlobalStatus: (req, res, next) => { req.userProfile = { role: 'user' }; next(); },
}));
jest.mock('../services/questionBank', () => ({
  getQuestion: (type) => (type === 'managerial'
    ? { title: 'Behavioral & Leadership Principles', question: 'Tell me about your past experience.', companyName: null }
    : {
      question: { title: 'Two Sum', difficulty: 'EASY', topics: ['Array'], link: 'https://leetcode.com/problems/two-sum' },
      companyName: 'Google',
    }),
}));
jest.mock('../services/ai/gateway', () => ({ generateText: jest.fn() }));
jest.mock('../services/openaiCodeAudit', () => ({ auditCode: jest.fn() }));

const { generateText } = require('../services/ai/gateway');
const { errorHandler } = require('../utils/httpError');
const sessionsRouter = require('../routes/sessions');

const app = express();
app.use(express.json());
app.use('/api/sessions', sessionsRouter);
app.use(errorHandler);

function parseSse(text) {
  return text.trim().split('\n\n').filter(Boolean).map((block) => {
    const [eventLine, dataLine] = block.split('\n');
    return { event: eventLine.replace('event: ', ''), data: JSON.parse(dataLine.replace('data: ', '')) };
  });
}

function streamReply(text) {
  generateText.mockImplementationOnce(async ({ onToken }) => {
    onToken?.(text);
    return { text, model: 'qwen/qwen3.8-27b', fellBack: false };
  });
}

async function createSession(body = { interviewType: 'dsa', config: { language: 'Java' } }) {
  const res = await request(app).post('/api/sessions').send(body);
  expect(res.status).toBe(201);
  return res.body.session;
}

beforeEach(() => {
  mockFake.tables.clear();
  require('../services/sessions/store').resetLegacyCache();
  mockCurrentUser = { uid: 'u1', name: 'Alex Doe', email: 'alex@example.com' };
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('POST /api/sessions', () => {
  it('creates an active session with a server-chosen question; the clock starts with the opening message', async () => {
    const session = await createSession();
    expect(session).toMatchObject({
      interviewType: 'dsa',
      mode: 'interview',
      status: 'active',
      question: { title: 'Two Sum', link: 'https://leetcode.com/problems/two-sum', companyName: 'Google' },
      messages: [],
      config: { language: 'Java', difficulty: 'ANY' },
      timerMinutes: 45,
      timerEndsAt: null,
    });
    expect(session.questionData).toBeUndefined();
    expect(Date.parse(session.serverNow)).toBeGreaterThan(0);

    streamReply('Here is the problem.');
    const res = await request(app).post(`/api/sessions/${session.id}/turns`).send({});
    const done = parseSse(res.text).pop();
    expect(new Date(done.data.timerEndsAt).getTime()).toBeGreaterThan(Date.now() + 44 * 60_000);
  });

  it('uses the chosen problem for sheet practice and has no timer for tutoring', async () => {
    const session = await createSession({
      interviewType: 'tutorDsa',
      questionTitle: 'Koko Eating Bananas',
      source: { kind: 'sheet', sheetId: 'dsa-master', problemId: 'm2-l3-koko' },
    });
    expect(session).toMatchObject({ mode: 'sheet', question: { title: 'Koko Eating Bananas' }, timerEndsAt: null });
  });

  it('rejects unknown interview types and models without charging quota', async () => {
    mockQuotaCharges = 0;
    expect((await request(app).post('/api/sessions').send({ interviewType: 'nope' })).status).toBe(400);
    expect((await request(app).post('/api/sessions').send({ interviewType: 'dsa', config: { model: 'gpt-9000' } })).status).toBe(400);
    expect(mockQuotaCharges).toBe(0);
  });

  it('creates managerial sessions (whose question is plain text)', async () => {
    const session = await createSession({ interviewType: 'managerial' });
    expect(session.question).toEqual({ title: 'Behavioral & Leadership Principles', link: null, companyName: null });
  });

  it('stores a null model when the code review runs on a legacy session without one', async () => {
    mockFake.seed('interviews', 'legacyNoModel', { userId: 'u1', interviewType: 'dsa', messages: [{ role: 'assistant', content: 'Q' }] });
    generateText.mockResolvedValueOnce({ text: 'Review', model: undefined });
    const res = await request(app).post('/api/sessions/legacyNoModel/code-review').send({ code: 'x = 1', language: 'python' });
    expect(res.status).toBe(200);
  });

  it('links a loop round to the new session and marks it in progress', async () => {
    mockFake.seed('loops', 'loop1', {
      userId: 'u1', status: 'in-progress', currentRoundIndex: 0,
      rounds: [{ type: 'dsa', name: 'Coding', status: 'pending', score: null, sessionId: null }],
    });
    const session = await createSession({ interviewType: 'dsa', source: { kind: 'loop', loopId: 'loop1', roundIndex: 0 } });
    const loop = mockFake.tables.get('loops').get('loop1');
    expect(loop.rounds[0]).toMatchObject({ status: 'in-progress', sessionId: session.id });
    expect(session.mode).toBe('loop');
  });

  it('refuses to start a round that is not the current one', async () => {
    mockFake.seed('loops', 'loop1', {
      userId: 'u1', status: 'in-progress', currentRoundIndex: 0,
      rounds: [
        { type: 'dsa', name: 'Coding', status: 'pending', score: null, sessionId: null },
        { type: 'dsa', name: 'Coding 2', status: 'locked', score: null, sessionId: null },
      ],
    });
    const res = await request(app).post('/api/sessions').send({ interviewType: 'dsa', source: { kind: 'loop', loopId: 'loop1', roundIndex: 1 } });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ROUND_LOCKED');
  });
});

describe('POST /api/sessions/:id/turns', () => {
  it('streams the opening message and stores only visible messages', async () => {
    const { id } = await createSession();
    streamReply('Welcome! Here is Two Sum.');
    const res = await request(app).post(`/api/sessions/${id}/turns`).send({});
    const events = parseSse(res.text);
    expect(events.map((e) => e.event)).toEqual(['token', 'done']);
    expect(events[1].data).toMatchObject({ message: { role: 'assistant', content: 'Welcome! Here is Two Sum.' }, messageCount: 1 });

    const { messages: sent, systemPrompt } = generateText.mock.calls[0][0];
    expect(sent[0].content).toMatch(/ready to start the interview/);
    expect(systemPrompt).toMatch(/Two Sum/);

    const saved = (await request(app).get(`/api/sessions/${id}`)).body.session;
    expect(saved.messages).toEqual([{ role: 'assistant', content: 'Welcome! Here is Two Sum.' }]);
  });

  it('appends the user message and reply, and keeps the question in context on every turn', async () => {
    const { id } = await createSession();
    streamReply('Question…');
    await request(app).post(`/api/sessions/${id}/turns`).send({});
    streamReply('Good idea, what about duplicates?');
    await request(app).post(`/api/sessions/${id}/turns`).send({ content: 'Use a hash map' });

    const second = generateText.mock.calls[1][0];
    expect(second.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(second.systemPrompt).toMatch(/Two Sum/);
    const saved = (await request(app).get(`/api/sessions/${id}`)).body.session;
    expect(saved.messages.map((m) => m.content)).toEqual(['Question…', 'Use a hash map', 'Good idea, what about duplicates?']);
    expect(saved.userMessageCount).toBe(1);
  });

  it('saves nothing when the AI fails so the turn can be retried', async () => {
    const { id } = await createSession();
    generateText.mockRejectedValueOnce(new Error('provider exploded'));
    const res = await request(app).post(`/api/sessions/${id}/turns`).send({});
    const last = parseSse(res.text).pop();
    expect(last).toMatchObject({ event: 'error', data: { code: 'INTERNAL_ERROR' } });
    expect((await request(app).get(`/api/sessions/${id}`)).body.session.messages).toEqual([]);
  });

  it('requires content once the conversation has started', async () => {
    const { id } = await createSession();
    streamReply('Hi');
    await request(app).post(`/api/sessions/${id}/turns`).send({});
    const res = await request(app).post(`/api/sessions/${id}/turns`).send({ content: '   ' });
    expect(res.status).toBe(400);
  });

  it("doesn't let another user read or write the session", async () => {
    const { id } = await createSession();
    mockCurrentUser = { uid: 'intruder' };
    expect((await request(app).get(`/api/sessions/${id}`)).status).toBe(403);
    expect((await request(app).post(`/api/sessions/${id}/turns`).send({ content: 'hi' })).status).toBe(403);
  });
});

describe('POST /api/sessions/:id/end', () => {
  it('scores the interview, completes it and advances the loop round', async () => {
    mockFake.seed('loops', 'loop1', {
      userId: 'u1', status: 'in-progress', currentRoundIndex: 0,
      rounds: [
        { type: 'dsa', name: 'Coding', status: 'pending', score: null, sessionId: null },
        { type: 'systemDesign', name: 'SD', status: 'locked', score: null, sessionId: null },
      ],
    });
    const { id } = await createSession({ interviewType: 'dsa', source: { kind: 'loop', loopId: 'loop1', roundIndex: 0 } });
    streamReply('Question');
    await request(app).post(`/api/sessions/${id}/turns`).send({});
    streamReply('Nice');
    await request(app).post(`/api/sessions/${id}/turns`).send({ content: 'my answer with code' });

    generateText.mockResolvedValueOnce({
      text: '```json\n{"score": 82, "verdict": "Hire", "strengths": ["a"], "weaknesses": ["b"], "problemSolving": "p", "communication": "c"}\n```',
      model: 'openai/gpt-oss-120b',
    });
    const res = await request(app).post(`/api/sessions/${id}/end`).send({});
    expect(res.status).toBe(200);
    expect(res.body.session).toMatchObject({ status: 'completed', scorecard: { score: 82, verdict: 'Hire' } });

    const loop = mockFake.tables.get('loops').get('loop1');
    expect(loop.rounds[0]).toMatchObject({ status: 'passed', score: 82, sessionId: id });
    expect(loop.currentRoundIndex).toBe(1);
    expect(loop.rounds[1].status).toBe('pending');

    const again = await request(app).post(`/api/sessions/${id}/end`).send({});
    expect(again.body.session.scorecard.score).toBe(82);
    expect(generateText).toHaveBeenCalledTimes(3);
  });

  it('refuses to score an interview the candidate never answered', async () => {
    const { id } = await createSession();
    const res = await request(app).post(`/api/sessions/${id}/end`).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NO_ANSWERS');
  });

  it('closes tutor sessions without a scorecard', async () => {
    const { id } = await createSession({ interviewType: 'tutorDsa' });
    const res = await request(app).post(`/api/sessions/${id}/end`).send({});
    expect(res.body.session).toMatchObject({ status: 'completed', scorecard: null });
    expect(generateText).not.toHaveBeenCalled();
  });

  it('blocks new turns after the session ended', async () => {
    const { id } = await createSession({ interviewType: 'tutorDsa' });
    await request(app).post(`/api/sessions/${id}/end`).send({});
    const res = await request(app).post(`/api/sessions/${id}/turns`).send({ content: 'hello?' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SESSION_ENDED');
  });
});

describe('code review', () => {
  it('falls back to the interviewer model when OpenAI is not configured', async () => {
    const { id } = await createSession();
    generateText.mockResolvedValueOnce({ text: 'Looks correct, O(n).', model: 'qwen/qwen3.8-27b' });
    const res = await request(app).post(`/api/sessions/${id}/code-review`).send({ code: 'class Solution {}', language: 'java' });
    expect(res.status).toBe(200);
    expect(res.body.messages[0].content).toMatch(/```java\nclass Solution {}/);
    expect(res.body.messages[1]).toEqual({ role: 'assistant', content: 'Looks correct, O(n).' });
  });
});

describe('legacy sessions', () => {
  beforeEach(() => {
    mockFake.seed('tutor_interviews', 'old1', {
      userId: 'u1', interviewType: 'tutorDsa', modelUsed: 'llama-3.1-8b-instant', questionTitle: 'Two Sum',
      messages: [{ role: 'assistant', content: 'Old lesson' }], startedAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02'),
    });
    mockFake.seed('interviews', 'old2', {
      userId: 'u1', interviewType: 'dsa', scorecard: { score: 40 }, isPinned: true,
      messages: [{ role: 'user', content: 'x' }], updatedAt: new Date('2026-01-03'),
    });
  });

  it('lists new and legacy sessions together, newest first, with normalised status and mode', async () => {
    const { id } = await createSession();
    const { sessions } = (await request(app).get('/api/sessions')).body;
    expect(sessions.map((s) => s.id)).toEqual([id, 'old2', 'old1']);
    expect(sessions.find((s) => s.id === 'old1')).toMatchObject({ mode: 'tutor', status: 'active', legacy: true });
    expect(sessions.find((s) => s.id === 'old2')).toMatchObject({ mode: 'interview', status: 'completed', isPinned: true });
    expect(sessions[0].messages).toBeUndefined();
  });

  it('filters the list', async () => {
    const { sessions } = (await request(app).get('/api/sessions?status=active&interviewType=tutorDsa')).body;
    expect(sessions.map((s) => s.id)).toEqual(['old1']);
  });

  it('stops querying legacy collections the user has no data in', async () => {
    await request(app).get('/api/sessions');
    // Only possible in tests: legacy collections are never written to in production.
    mockFake.seed('loop_interviews', 'late', { userId: 'u1', interviewType: 'dsa', updatedAt: new Date('2026-02-01') });
    const { sessions } = (await request(app).get('/api/sessions')).body;
    expect(sessions.map((s) => s.id)).toEqual(['old2', 'old1']);
  });

  it('resumes a legacy session in place', async () => {
    streamReply('Continuing the lesson');
    await request(app).post('/api/sessions/old1/turns').send({ content: 'continue please' });
    const doc = mockFake.tables.get('tutor_interviews').get('old1');
    expect(doc.messages.map((m) => m.content)).toEqual(['Old lesson', 'continue please', 'Continuing the lesson']);
    expect(doc.modelUsed).toBe('qwen/qwen3.8-27b');
  });
});

describe('PATCH and DELETE', () => {
  it('limits pinned sessions to three', async () => {
    const ids = [];
    for (let i = 0; i < 4; i++) ids.push((await createSession({ interviewType: 'tutorDsa' })).id);
    for (const id of ids.slice(0, 3)) {
      expect((await request(app).patch(`/api/sessions/${id}`).send({ isPinned: true })).status).toBe(200);
    }
    const res = await request(app).patch(`/api/sessions/${ids[3]}`).send({ isPinned: true });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PIN_LIMIT');
  });

  it('archives an active session and deletes sessions', async () => {
    const { id } = await createSession();
    const archived = await request(app).patch(`/api/sessions/${id}`).send({ status: 'archived' });
    expect(archived.body.session.status).toBe('archived');
    expect((await request(app).delete(`/api/sessions/${id}`)).status).toBe(200);
    expect((await request(app).get(`/api/sessions/${id}`)).status).toBe(404);
  });
});

describe('interview edge cases', () => {
  const stored = (id) => mockFake.tables.get('sessions').get(id);
  const expire = (id) => { stored(id).timerEndsAt = new Date(Date.now() - 5 * 60_000); };

  async function startedInterview(body) {
    const session = await createSession(body);
    streamReply('Question');
    await request(app).post(`/api/sessions/${session.id}/turns`).send({});
    return session.id;
  }

  function seedLoop() {
    mockFake.seed('loops', 'loop1', {
      userId: 'u1', status: 'in-progress', currentRoundIndex: 0,
      rounds: [{ type: 'dsa', name: 'Coding', status: 'pending', score: null, sessionId: null }],
    });
  }

  it('tells the interviewer how much time is left so it can pace and wrap up', async () => {
    const id = await startedInterview();
    stored(id).timerEndsAt = new Date(Date.now() + 3 * 60_000);
    streamReply('Let us wrap up');
    await request(app).post(`/api/sessions/${id}/turns`).send({ content: 'my answer' });
    expect(generateText.mock.calls[1][0].systemPrompt).toMatch(/INTERVIEW CLOCK: about 3 minute\(s\) remain\. Start wrapping up/);
  });

  it('replays the saved reply when a turn is retried with the same turnId (dropped connection)', async () => {
    const id = await startedInterview();
    streamReply('First reply');
    await request(app).post(`/api/sessions/${id}/turns`).send({ content: 'hash map', turnId: 't-1' });

    const retry = await request(app).post(`/api/sessions/${id}/turns`).send({ content: 'hash map', turnId: 't-1' });
    const done = parseSse(retry.text).pop();

    expect(done).toMatchObject({ event: 'done', data: { message: { content: 'First reply' }, replayed: true } });
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(stored(id).messages.map((m) => m.content)).toEqual(['Question', 'hash map', 'First reply']);
  });

  it('refuses to overwrite a transcript that changed while the reply was generating', async () => {
    const id = await startedInterview();
    generateText.mockImplementationOnce(async () => {
      stored(id).messages.push({ role: 'user', content: 'sent from another tab' });
      return { text: 'late reply', model: 'qwen/qwen3.8-27b', fellBack: false };
    });
    const res = await request(app).post(`/api/sessions/${id}/turns`).send({ content: 'hi' });

    expect(parseSse(res.text).pop()).toMatchObject({ event: 'error', data: { code: 'SESSION_CONFLICT' } });
    expect(stored(id).messages.map((m) => m.content)).toEqual(['Question', 'sent from another tab']);
  });

  it('rejects answers and code reviews after time is up', async () => {
    const id = await startedInterview();
    expire(id);
    const turn = await request(app).post(`/api/sessions/${id}/turns`).send({ content: 'late answer' });
    const review = await request(app).post(`/api/sessions/${id}/code-review`).send({ code: 'x', language: 'java' });
    expect([turn.status, turn.body.code]).toEqual([409, 'TIME_UP']);
    expect([review.status, review.body.code]).toEqual([409, 'TIME_UP']);
  });

  it('still scores an expired interview that has answers', async () => {
    const id = await startedInterview();
    streamReply('ok');
    await request(app).post(`/api/sessions/${id}/turns`).send({ content: 'answer' });
    expire(id);
    generateText.mockResolvedValueOnce({ text: '{"score": 40, "verdict": "No Hire", "strengths": [], "weaknesses": [], "problemSolving": "", "communication": ""}' });

    const res = await request(app).post(`/api/sessions/${id}/end`).send({});
    expect(res.body.session).toMatchObject({ status: 'completed', scorecard: { score: 40 } });
  });

  it('closes an expired interview with no answers as a timeout and reopens its loop round', async () => {
    seedLoop();
    const id = await startedInterview({ interviewType: 'dsa', source: { kind: 'loop', loopId: 'loop1', roundIndex: 0 } });
    expire(id);

    const res = await request(app).post(`/api/sessions/${id}/end`).send({});
    expect(res.status).toBe(200);
    expect(res.body.session).toMatchObject({ status: 'archived', endReason: 'timeout', scorecard: null });
    expect(mockFake.tables.get('loops').get('loop1').rounds[0]).toMatchObject({ status: 'pending', sessionId: null });
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('refuses to score the same interview twice at once, and frees the lease if scoring fails', async () => {
    const id = await startedInterview();
    streamReply('ok');
    await request(app).post(`/api/sessions/${id}/turns`).send({ content: 'answer' });

    stored(id).endingAt = new Date();
    const busy = await request(app).post(`/api/sessions/${id}/end`).send({});
    expect([busy.status, busy.body.code]).toEqual([409, 'SCORING_IN_PROGRESS']);

    stored(id).endingAt = null;
    generateText.mockResolvedValueOnce({ text: 'not json' });
    const bad = await request(app).post(`/api/sessions/${id}/end`).send({});
    expect(bad.body.code).toBe('SCORECARD_INVALID');
    expect(stored(id).endingAt).toBeNull();
  });

  it('ending an archived session just returns it', async () => {
    const id = await startedInterview();
    await request(app).patch(`/api/sessions/${id}`).send({ status: 'archived' });
    const res = await request(app).post(`/api/sessions/${id}/end`).send({});
    expect(res.body.session).toMatchObject({ status: 'archived', endReason: 'abandoned' });
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('abandoning a loop round session reopens the round', async () => {
    seedLoop();
    const session = await createSession({ interviewType: 'dsa', source: { kind: 'loop', loopId: 'loop1', roundIndex: 0 } });
    await request(app).patch(`/api/sessions/${session.id}`).send({ status: 'archived' });
    expect(mockFake.tables.get('loops').get('loop1').rounds[0]).toMatchObject({ status: 'pending', sessionId: null });
  });

  it('caps code reviews by the message limit', async () => {
    const id = await startedInterview();
    stored(id).messages = Array.from({ length: 99 }, (_, i) => ({ role: i % 2 ? 'user' : 'assistant', content: `m${i}` }));
    const res = await request(app).post(`/api/sessions/${id}/code-review`).send({ code: 'x', language: 'java' });
    expect([res.status, res.body.code]).toEqual([409, 'SESSION_FULL']);
  });
});

describe('one interview at a time', () => {
  const stored = (id) => mockFake.tables.get('sessions').get(id);

  async function startedInterview(body) {
    const session = await createSession(body);
    streamReply('Question');
    await request(app).post(`/api/sessions/${session.id}/turns`).send({});
    return session.id;
  }

  it('blocks a second interview (any type) without charging quota, and names the running one', async () => {
    const id = await startedInterview();
    mockQuotaCharges = 0;
    const res = await request(app).post('/api/sessions').send({ interviewType: 'systemDesign' });
    expect([res.status, res.body.code]).toEqual([409, 'ACTIVE_INTERVIEW']);
    expect(res.body.details.session).toMatchObject({ id, interviewType: 'dsa', status: 'active' });
    expect(res.body.details.session.messages).toBeUndefined();
    expect(mockQuotaCharges).toBe(0);
  });

  it('allows a new interview once the running one is ended or discarded', async () => {
    const id = await startedInterview();
    await request(app).patch(`/api/sessions/${id}`).send({ status: 'archived' });
    await createSession();
  });

  it('never blocks tutor lessons, in either direction', async () => {
    await startedInterview();
    await createSession({ interviewType: 'tutorDsa' });
  });

  it('closes leftovers that can never be resumed: stale unstarted and timed out with no answers', async () => {
    const unstarted = (await createSession()).id;
    stored(unstarted).startedAt = new Date(Date.now() - 10 * 60_000);
    const fresh = await createSession();
    expect(stored(unstarted)).toMatchObject({ status: 'archived', endReason: 'abandoned' });

    // Its opening message may still be streaming, so a just-created session blocks.
    expect((await request(app).post('/api/sessions').send({ interviewType: 'dsa' })).body.code).toBe('ACTIVE_INTERVIEW');
    stored(fresh.id).startedAt = new Date(Date.now() - 10 * 60_000);

    const silent = await startedInterview();
    stored(silent).timerEndsAt = new Date(Date.now() - 60_000);
    await createSession();
    expect(stored(silent)).toMatchObject({ status: 'archived', endReason: 'timeout' });
  });

  it('still blocks a timed-out interview that has answers, so it gets scored instead of lost', async () => {
    const id = await startedInterview();
    streamReply('ok');
    await request(app).post(`/api/sessions/${id}/turns`).send({ content: 'answer' });
    stored(id).timerEndsAt = new Date(Date.now() - 60_000);
    const res = await request(app).post('/api/sessions').send({ interviewType: 'dsa' });
    expect(res.body.code).toBe('ACTIVE_INTERVIEW');
  });
});

describe('chat draft', () => {
  it('keeps the draft on the session so it follows the candidate to another device', async () => {
    const { id } = await createSession();
    const res = await request(app).patch(`/api/sessions/${id}`).send({ draft: 'half an answer' });
    expect(res.status).toBe(200);
    expect((await request(app).get(`/api/sessions/${id}`)).body.session.draft).toBe('half an answer');
  });

  it('rejects oversized drafts and drafts on an ended session', async () => {
    const { id } = await createSession({ interviewType: 'tutorDsa' });
    expect((await request(app).patch(`/api/sessions/${id}`).send({ draft: 'x'.repeat(8001) })).status).toBe(400);
    await request(app).post(`/api/sessions/${id}/end`).send({});
    const res = await request(app).patch(`/api/sessions/${id}`).send({ draft: 'late' });
    expect([res.status, res.body.code]).toEqual([409, 'SESSION_ENDED']);
  });

  it('clears the draft when the session is archived', async () => {
    const { id } = await createSession();
    await request(app).patch(`/api/sessions/${id}`).send({ draft: 'unsent' });
    await request(app).patch(`/api/sessions/${id}`).send({ status: 'archived' });
    expect((await request(app).get(`/api/sessions/${id}`)).body.session.draft).toBe('');
  });
});

describe('editor code', () => {
  it('saves code on the server so it follows the candidate to another device', async () => {
    const { id } = await createSession();
    const res = await request(app).patch(`/api/sessions/${id}`).send({ code: 'class Solution {}' });
    expect(res.status).toBe(200);
    expect((await request(app).get(`/api/sessions/${id}`)).body.session.code).toBe('class Solution {}');
  });

  it('rejects code on an ended session and oversized code', async () => {
    const { id } = await createSession({ interviewType: 'tutorDsa' });
    expect((await request(app).patch(`/api/sessions/${id}`).send({ code: 'x'.repeat(20001) })).status).toBe(400);
    await request(app).post(`/api/sessions/${id}/end`).send({});
    const res = await request(app).patch(`/api/sessions/${id}`).send({ code: 'late' });
    expect([res.status, res.body.code]).toEqual([409, 'SESSION_ENDED']);
  });
});

describe('scorecard verdict normalization', () => {
  const { parseScorecard, PASS_SCORE } = require('../services/evaluation');

  it('normalizes Hire to Lean Hire if score is below PASS_SCORE (70)', () => {
    const result = parseScorecard(JSON.stringify({
      score: 68,
      verdict: 'Hire',
      strengths: ['Good communication'],
      weaknesses: ['Minor bug'],
    }));
    expect(result.score).toBe(68);
    expect(result.verdict).toBe('Lean Hire');
  });

  it('preserves Hire if score is at or above PASS_SCORE', () => {
    const result = parseScorecard(JSON.stringify({
      score: PASS_SCORE,
      verdict: 'Hire',
      strengths: ['Great code'],
      weaknesses: [],
    }));
    expect(result.score).toBe(70);
    expect(result.verdict).toBe('Hire');
  });

  it('normalizes No Hire to Lean Hire if score is below 50', () => {
    const result = parseScorecard(JSON.stringify({
      score: 40,
      verdict: 'Hire',
      strengths: [],
      weaknesses: ['Failed implementation'],
    }));
    expect(result.score).toBe(40);
    expect(result.verdict).toBe('No Hire');
  });
});
